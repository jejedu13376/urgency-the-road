import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Link, Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { YoutubeSuggestions } from '../../src/components/YoutubeSuggestions';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { runMultiIaDiagnostic } from '../../src/services/ai/multiIaRouter';
import {
  analyzeAcousticCapture,
  MIC_AUDIO_LIVE,
  type AcousticFocus,
} from '../../src/services/diagnostic/acousticMic';
import {
  VISION_PIXELS_BLOCKED,
  quoteFromCameraText,
} from '../../src/services/diagnostic/cameraTextDiag';
import { stubAcoustic } from '../../src/services/stubs';
import { searchYoutubeVideos, type YoutubeVideoHit } from '../../src/services/youtube/youtubeSearch';
import { colors } from '../../src/theme/colors';
import { useI18n } from '../../src/context/I18nContext';

type PhotoOutcome = {
  kind: 'ok' | 'polite_refuse' | 'captured_pending';
  media: 'photo' | 'video';
  problem: string;
  partName: string;
  partPrice: number;
  laborPrice: number;
  currency: string;
  causes: string[];
  tools: string[];
  summary: string;
  visionLive: boolean;
  photoUri?: string;
  matchedFromCatalog?: boolean;
};

const QUESTIONS = [
  { q: 'Entendez-vous un bruit métallique ?', hint: 'Cliquetis, cognement, frottement' },
  { q: 'Y a-t-il de la fumée ? Couleur ?', hint: 'Blanche / bleue / noire' },
  { q: 'Un voyant est-il allumé ?', hint: 'Moteur, ABS, AdBlue, température' },
  { q: 'Le comportement change-t-il en charge ?', hint: 'Côte, remorque, accélération' },
];

const HAZARD_KINDS_ACOUSTIC = [
  { id: 'courroie', label: 'Courroie / galet' },
  { id: 'injecteur', label: 'Injecteur' },
  { id: 'bielle', label: 'Bielle' },
  { id: 'roulement', label: 'Roulement' },
] as const;

/** Module 4 — diagnostic IA : caméra réelle + Multi-IA texte ; pas de vision fake-success. */
export default function DiagnosticIaScreen() {
  const { t } = useI18n();
  useModuleVisit(4);
  const { active } = useFleet();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [photoOutcome, setPhotoOutcome] = useState<PhotoOutcome | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [mediaNote, setMediaNote] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [acousticPhase, setAcousticPhase] = useState<'idle' | 'listening' | 'done'>('idle');
  const [acousticFocus, setAcousticFocus] = useState<AcousticFocus | null>(null);
  const [acousticGuess, setAcousticGuess] = useState<string | null>(null);
  const [acousticLabel, setAcousticLabel] = useState<string | null>(null);
  const [acousticBars, setAcousticBars] = useState(() => [4, 10, 6, 14, 8, 12, 5, 11, 7, 13]);
  const peakMeteringRef = useRef<number | null>(null);
  const acousticBusyRef = useRef(false);
  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(audioRecorder, 120);
  const [qResult, setQResult] = useState<string | null>(null);
  const [qBusy, setQBusy] = useState(false);
  const [freeResult, setFreeResult] = useState<string | null>(null);
  const [freeBusy, setFreeBusy] = useState(false);
  const [yt, setYt] = useState<YoutubeVideoHit[]>([]);
  const [ytLabel, setYtLabel] = useState<string | undefined>();

  const loadYoutube = async (problem: string) => {
    const q = [active?.make, active?.model, problem].filter(Boolean).join(' ');
    const res = await searchYoutubeVideos(q || problem, 5);
    setYt(res.items);
    setYtLabel(
      res.ok
        ? `YouTube API HTTP ${res.httpStatus} · ${res.items.length} résultat(s)`
        : res.error ?? `YouTube HTTP ${res.httpStatus}`,
    );
  };

  const politeRefuse = (media: 'photo' | 'video') => {
    setPhotoOutcome({
      kind: 'polite_refuse',
      media,
      problem: '',
      partName: '',
      partPrice: 0,
      laborPrice: 0,
      currency: 'EUR',
      causes: [],
      tools: [],
      visionLive: false,
      summary:
        'Merci pour l’envoi. Cette description ne semble pas liée à un véhicule ou une pièce mécanique. Photographiez / décrivez une fuite, un composant rouillé/cassé, un voyant ou le compartiment moteur.',
    });
  };

  const analyzeMediaDescription = async (media: 'photo' | 'video') => {
    const desc = mediaNote.trim();
    if (!desc) {
      setPhotoOutcome({
        kind: 'captured_pending',
        media,
        problem: '',
        partName: '',
        partPrice: 0,
        laborPrice: 0,
        currency: active?.currency ?? 'EUR',
        causes: [],
        tools: [],
        visionLive: false,
        photoUri: capturedUri ?? undefined,
        summary: capturedUri
          ? `${VISION_PIXELS_BLOCKED} Photo capturée — décrivez la panne visible pour lancer le diagnostic Multi-IA texte.`
          : media === 'video'
            ? 'Flux caméra ouvert — aucune IA vision live. Décrivez ce que vous filmez (pièce, fuite, voyant) pour lancer le diagnostic Multi-IA texte.'
            : 'Caméra prête — aucune IA vision live. Décrivez la pièce / panne visible pour lancer le diagnostic Multi-IA texte (proxy si configuré).',
      });
      return;
    }
    const offTopic =
      /chat|selfie|repas|vacances|meme|hors.?sujet/i.test(desc) &&
      !/moteur|fuite|frein|pneu|voyant|huile|batterie|courroie|injecteur/i.test(desc);
    if (offTopic) {
      politeRefuse(media);
      return;
    }
    setMediaBusy(true);
    try {
      const ctx = active ? `${active.make} ${active.model} ${active.year}` : '';
      const r = await runMultiIaDiagnostic({
        prompt: `Diagnostic ${media} (description utilisateur, pas de vision pixels)${
          capturedUri ? ' · photo locale capturée' : ''
        } : ${desc}`,
        context: ctx,
      });
      const quote = quoteFromCameraText({
        description: desc,
        vin: active?.vin,
        isHeavyTruck: active?.vehicleClass === 'poids_lourd',
        make: active?.make,
        model: active?.model,
        year: active?.year,
        currency: active?.currency,
        likelyParts: r.likelyParts,
      });
      setPhotoOutcome({
        kind: 'ok',
        media,
        problem: desc.slice(0, 160),
        partName: quote.partName,
        partPrice: quote.partPrice,
        laborPrice: quote.laborPrice,
        currency: quote.currency,
        causes: ['Hypothèse Multi-IA texte', quote.matchedFromCatalog ? 'Match catalogue local M3' : 'À confirmer OBD / garage'],
        tools: ['Cric / chandelles', 'Clé dynamométrique', 'Douilles standard'],
        visionLive: false,
        photoUri: capturedUri ?? undefined,
        matchedFromCatalog: quote.matchedFromCatalog,
        summary: `${r.label}\n${r.consensus}\n${VISION_PIXELS_BLOCKED}`,
      });
      void loadYoutube(`${quote.partName} remplacement`);
    } finally {
      setMediaBusy(false);
    }
  };

  const openCameraPath = async (media: 'photo' | 'video') => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setPhotoOutcome({
          kind: 'captured_pending',
          media,
          problem: '',
          partName: '',
          partPrice: 0,
          laborPrice: 0,
          currency: active?.currency ?? 'EUR',
          causes: [],
          tools: [],
          visionLive: false,
          summary: 'Permission caméra refusée — décrivez la panne ci-dessous (Multi-IA texte).',
        });
        return;
      }
    }
    // If CameraView is already mounted, keep cameraReady — onCameraReady won't re-fire.
    // Only reset ready when opening a fresh mount.
    if (!showCamera) {
      setCameraReady(false);
      setShowCamera(true);
    } else {
      setShowCamera(true);
    }
    setPhotoOutcome({
      kind: 'captured_pending',
      media,
      problem: '',
      partName: '',
      partPrice: 0,
      laborPrice: 0,
      currency: active?.currency ?? 'EUR',
      causes: [],
      tools: [],
      visionLive: false,
      summary:
        media === 'photo'
          ? `Caméra LIVE. ${VISION_PIXELS_BLOCKED} Capturez une photo puis décrivez → analyse texte.`
          : `Caméra LIVE (aperçu vidéo). ${VISION_PIXELS_BLOCKED} Décrivez ce que vous voyez puis lancez l’analyse texte.`,
    });
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || !cameraReady) return;
    try {
      const shot = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });
      if (shot?.uri) {
        setCapturedUri(shot.uri);
        setPhotoOutcome((prev) => ({
          kind: 'captured_pending',
          media: prev?.media ?? 'photo',
          problem: '',
          partName: '',
          partPrice: 0,
          laborPrice: 0,
          currency: active?.currency ?? 'EUR',
          causes: [],
          tools: [],
          visionLive: false,
          photoUri: shot.uri,
          summary: `Photo capturée (${shot.width ?? '?'}×${shot.height ?? '?'}). ${VISION_PIXELS_BLOCKED} Ajoutez une description puis lancez l’analyse texte.`,
        }));
      }
    } catch {
      setPhotoOutcome({
        kind: 'captured_pending',
        media: 'photo',
        problem: '',
        partName: '',
        partPrice: 0,
        laborPrice: 0,
        currency: active?.currency ?? 'EUR',
        causes: [],
        tools: [],
        visionLive: false,
        summary: 'Capture photo indisponible sur cet appareil — décrivez la panne en texte (chemin camera-text).',
      });
    }
  };

  const answer = (yes: boolean) => {
    if (qBusy) return;
    const next = [...answers, yes ? 'oui' : 'non'];
    setAnswers(next);
    if (step + 1 >= QUESTIONS.length) {
      const prompt = `Questionnaire diagnostic: ${QUESTIONS.map((q, i) => `${q.q}=${next[i]}`).join(' ; ')}`;
      const ctx = active
        ? `${active.make} ${active.model} ${active.year}`
        : '';
      setQBusy(true);
      void (async () => {
        try {
          const r = await runMultiIaDiagnostic({ prompt, context: ctx });
          setQResult(`${r.label}\n${r.consensus}\nPièces: ${r.likelyParts.join(', ') || '—'}`);
          void loadYoutube('bruit moteur voyant diagnostic automobile');
        } finally {
          setQBusy(false);
        }
      })();
    } else setStep(step + 1);
  };

  const resetQuestions = () => {
    if (qBusy) return;
    setStep(0);
    setAnswers([]);
    setQResult(null);
  };

  useEffect(() => {
    if (acousticPhase !== 'listening') return;
    const m = recorderState.metering;
    if (typeof m !== 'number' || !Number.isFinite(m)) return;
    peakMeteringRef.current =
      peakMeteringRef.current == null ? m : Math.max(peakMeteringRef.current, m);
    const norm = Math.max(0, Math.min(1, (m + 60) / 60));
    const t = setTimeout(() => {
      setAcousticBars((prev) => prev.map((h, i) => 4 + Math.round(norm * (10 + ((h + i) % 8)))));
    }, 0);
    return () => clearTimeout(t);
  }, [recorderState.metering, acousticPhase]);

  // Stop any in-flight recording if the screen unmounts mid-capture.
  useEffect(() => {
    return () => {
      acousticBusyRef.current = false;
      void (async () => {
        try {
          const st = audioRecorder.getStatus();
          if (st.isRecording) await audioRecorder.stop();
        } catch {
          /* ignore unmount stop errors */
        }
        try {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        } catch {
          /* ignore */
        }
      })();
    };
    // audioRecorder identity is stable for the screen lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAcoustic = () => {
    if (acousticBusyRef.current || acousticPhase === 'listening') return;
    acousticBusyRef.current = true;
    setAcousticPhase('listening');
    setAcousticGuess(null);
    setAcousticLabel(null);
    peakMeteringRef.current = null;
    const focusAtStart = acousticFocus;
    void (async () => {
      try {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          const a = stubAcoustic();
          setAcousticGuess(`${a.label}\n${a.data.guess}`);
          setAcousticLabel('Permission micro refusée');
          setAcousticPhase('done');
          return;
        }
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        await new Promise((r) => setTimeout(r, 2500));
        if (!acousticBusyRef.current) {
          try {
            const st = audioRecorder.getStatus();
            if (st.isRecording) await audioRecorder.stop();
          } catch {
            /* unmounted */
          }
          return;
        }
        await audioRecorder.stop();
        const status = audioRecorder.getStatus();
        const analysis = analyzeAcousticCapture({
          durationMs: status.durationMillis ?? 2500,
          peakMeteringDb: peakMeteringRef.current ?? status.metering,
          focus: focusAtStart,
        });
        setAcousticGuess(analysis.guess);
        setAcousticLabel(analysis.label);
        setAcousticPhase('done');
        if (focusAtStart) void loadYoutube(`bruit moteur ${focusAtStart}`);
      } catch {
        const a = stubAcoustic();
        setAcousticGuess(`${a.label}\n${a.data.guess}`);
        setAcousticLabel('Runtime micro KO — fallback honnête');
        setAcousticPhase('done');
      } finally {
        acousticBusyRef.current = false;
        try {
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        } catch {
          /* ignore mode reset */
        }
      }
    })();
  };

  return (
    <>
      <Stack.Screen options={{ title: t('moduleTitles.diagnosticIa') }} />
      <Screen
        variant="stack"
        title={t('moduleTitles.diagnosticIa')}
        subtitle={`Module 4 · ${active?.make ?? '—'} ${active?.model ?? ''}`.trim()}
      >
        <StubBanner text={`Caméra LIVE + capture photo · ${VISION_PIXELS_BLOCKED}`} />
        <StubBanner text={MIC_AUDIO_LIVE} />

        <Card title="Photo / vidéo → description → pièce + devis">
          <Text style={styles.hint}>
            Chemin camera-text : ouvrez la caméra, capturez une photo réelle, décrivez la panne, puis lancez le
            diagnostic Multi-IA texte + match catalogue local. Aucune « identification visuelle réussie » inventée.
          </Text>
          <View style={styles.row}>
            <Pressable style={styles.btn} onPress={() => void openCameraPath('photo')}>
              <Text style={styles.btnTxt}>Ouvrir caméra photo</Text>
            </Pressable>
            <Pressable style={styles.btnDark} onPress={() => void openCameraPath('video')}>
              <Text style={styles.btnTxt}>Ouvrir caméra vidéo</Text>
            </Pressable>
          </View>
          {showCamera && permission?.granted ? (
            <View style={styles.cameraWrap}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="back"
                onCameraReady={() => setCameraReady(true)}
              />
              <View style={styles.row}>
                <Pressable
                  style={[styles.btn, !cameraReady && styles.btnDisabled]}
                  disabled={!cameraReady}
                  onPress={() => void capturePhoto()}
                >
                  <Text style={styles.btnTxt}>{cameraReady ? 'Capturer photo' : 'Caméra…'}</Text>
                </Pressable>
                <Pressable
                  style={styles.btnWarn}
                  onPress={() => {
                    setShowCamera(false);
                    setCameraReady(false);
                  }}
                >
                  <Text style={styles.btnTxt}>Fermer</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {capturedUri ? (
            <View style={styles.thumbWrap}>
              <Image source={{ uri: capturedUri }} style={styles.thumb} accessibilityLabel="Photo capturée" />
              <Text style={styles.meta}>Photo locale capturée — non analysée en pixels</Text>
            </View>
          ) : null}
          <TextInput
            value={mediaNote}
            onChangeText={setMediaNote}
            placeholder="Décrivez ce que vous voyez (fuite, pièce, voyant…)"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, mediaBusy && styles.btnDisabled]}
              disabled={mediaBusy}
              onPress={() => void analyzeMediaDescription(photoOutcome?.media ?? 'photo')}
            >
              <Text style={styles.btnTxt}>{mediaBusy ? 'Analyse…' : 'Analyser (camera-text)'}</Text>
            </Pressable>
            <Pressable style={styles.btnWarn} onPress={() => politeRefuse('photo')}>
              <Text style={styles.btnTxt}>Filtre politesse</Text>
            </Pressable>
          </View>
          {photoOutcome?.kind === 'polite_refuse' ? (
            <View style={styles.politeBox}>
              <Text style={styles.politeTitle}>Filtre de politesse</Text>
              <Text style={styles.polite}>{photoOutcome.summary}</Text>
            </View>
          ) : null}
          {photoOutcome?.kind === 'captured_pending' ? (
            <View style={styles.politeBox}>
              <Text style={styles.politeTitle}>Média · en attente d’analyse</Text>
              <Text style={styles.polite}>{photoOutcome.summary}</Text>
            </View>
          ) : null}
          {photoOutcome?.kind === 'ok' ? (
            <View style={styles.resultStack}>
              <View style={styles.resultBox}>
                <Text style={styles.resultTitle}>
                  Problème ({photoOutcome.media}
                  {photoOutcome.visionLive ? '' : ' · texte, pas vision'})
                </Text>
                <Text style={styles.meta}>{photoOutcome.problem}</Text>
                <Text style={styles.polite}>{photoOutcome.summary}</Text>
              </View>
              <View style={styles.partCard}>
                <Text style={styles.partLabel}>Pièce identifiée</Text>
                <Text style={styles.partName}>{photoOutcome.partName}</Text>
                <Text style={styles.meta}>
                  {photoOutcome.matchedFromCatalog
                    ? 'Match catalogue local M3'
                    : 'Hors catalogue — devis indicatif'}
                </Text>
                <Text style={styles.meta}>Causes : {photoOutcome.causes.join(' · ')}</Text>
                <Text style={styles.meta}>Outils : {photoOutcome.tools.join(' · ')}</Text>
              </View>
              <View style={styles.priceCard}>
                <Text style={styles.partLabel}>Prix & devis approx.</Text>
                <Text style={styles.devis}>
                  Pièce {photoOutcome.partPrice} + pose {photoOutcome.laborPrice} ={' '}
                  {photoOutcome.partPrice + photoOutcome.laborPrice} {photoOutcome.currency}
                </Text>
              </View>
              <View style={styles.linkCol}>
                <Link href="/modules/pieces" asChild>
                  <Pressable style={styles.linkCta}>
                    <Text style={styles.btnTxt}>Où acheter / devis (M3) →</Text>
                  </Pressable>
                </Link>
                <Link href="/modules/tutoriels" asChild>
                  <Pressable style={styles.linkCtaAlt}>
                    <Text style={styles.btnTxt}>Réparation YouTube / étapes (M11) →</Text>
                  </Pressable>
                </Link>
                <Link href="/modules/obd" asChild>
                  <Pressable style={styles.linkSoft}>
                    <Text style={styles.linkSoftTxt}>Confirmer via OBD (M5) →</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
          ) : null}
        </Card>

        <Card title={`Questions intelligentes (${Math.min(step + 1, QUESTIONS.length)}/${QUESTIONS.length})`}>
          {!qResult ? (
            <>
              <Text style={styles.q}>{QUESTIONS[Math.min(step, QUESTIONS.length - 1)].q}</Text>
              <Text style={styles.hint}>{QUESTIONS[Math.min(step, QUESTIONS.length - 1)].hint}</Text>
              <View style={styles.row}>
                <Pressable
                  style={[styles.yes, qBusy && styles.btnDisabled]}
                  disabled={qBusy}
                  onPress={() => answer(true)}
                >
                  <Text style={styles.btnTxt}>{qBusy ? 'Analyse…' : 'Oui'}</Text>
                </Pressable>
                <Pressable
                  style={[styles.no, qBusy && styles.btnDisabled]}
                  disabled={qBusy}
                  onPress={() => answer(false)}
                >
                  <Text style={styles.btnTxt}>{qBusy ? 'Analyse…' : 'Non'}</Text>
                </Pressable>
              </View>
              {answers.length ? (
                <Text style={styles.meta}>Réponses : {answers.map((a, i) => `Q${i + 1}=${a}`).join(' · ')}</Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.result}>{qResult}</Text>
              <Pressable style={styles.linkSoft} onPress={resetQuestions}>
                <Text style={styles.linkSoftTxt}>Recommencer le questionnaire</Text>
              </Pressable>
              <Link href="/modules/pieces" asChild>
                <Pressable style={styles.linkCta}>
                  <Text style={styles.btnTxt}>Voir pièces & devis →</Text>
                </Pressable>
              </Link>
            </>
          )}
        </Card>

        <Card title="Analyseur acoustique moteur">
          <Text style={styles.hint}>{MIC_AUDIO_LIVE}</Text>
          <View style={styles.waveRow}>
            {acousticBars.map((h, i) => (
              <View
                key={`bar-${i}`}
                style={[
                  styles.waveBar,
                  { height: acousticPhase === 'listening' ? Math.max(6, h) : h + 4 },
                  acousticPhase === 'listening' && styles.waveBarLive,
                ]}
              />
            ))}
          </View>
          <View style={styles.tags}>
            {HAZARD_KINDS_ACOUSTIC.map((k) => (
              <Pressable
                key={k.id}
                style={[styles.tag, acousticFocus === k.id && styles.tagOn]}
                onPress={() => setAcousticFocus(k.id)}
              >
                <Text style={[styles.tagTxt, acousticFocus === k.id && styles.tagTxtOn]}>{k.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.btnDark, acousticPhase === 'listening' && styles.btnDisabled]}
            onPress={runAcoustic}
            disabled={acousticPhase === 'listening'}
          >
            <Text style={styles.btnTxt}>
              {acousticPhase === 'listening' ? 'Écoute micro (~2,5 s)…' : 'Enregistrer micro + analyser'}
            </Text>
          </Pressable>
          {acousticLabel ? <Text style={styles.meta}>{acousticLabel}</Text> : null}
          {acousticGuess ? <Text style={styles.result}>{acousticGuess}</Text> : null}
          {acousticPhase === 'done' && acousticFocus ? (
            <Link href="/modules/pieces" asChild>
              <Pressable style={styles.linkCta}>
                <Text style={styles.btnTxt}>Piste {acousticFocus} → catalogue →</Text>
              </Pressable>
            </Link>
          ) : null}
        </Card>

        <Card title="Description libre">
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Décrivez la panne…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable
            style={[styles.btn, freeBusy && styles.btnDisabled]}
            disabled={freeBusy}
            onPress={() => {
              if (freeBusy) return;
              const problem = note.trim() || 'panne inconnue';
              setFreeBusy(true);
              void (async () => {
                try {
                  const ctx = active
                    ? `${active.make} ${active.model} ${active.year}`
                    : '';
                  const r = await runMultiIaDiagnostic({ prompt: problem, context: ctx });
                  const quote = quoteFromCameraText({
                    description: problem,
                    vin: active?.vin,
                    isHeavyTruck: active?.vehicleClass === 'poids_lourd',
                    make: active?.make,
                    model: active?.model,
                    year: active?.year,
                    currency: active?.currency,
                    likelyParts: r.likelyParts,
                  });
                  setFreeResult(
                    `${r.label}\n${r.consensus}\nPièces: ${r.likelyParts.join(', ') || '—'}\nDevis indicatif ${quote.partName}: ${quote.partPrice + quote.laborPrice} ${quote.currency}`,
                  );
                  void loadYoutube(problem);
                } finally {
                  setFreeBusy(false);
                }
              })();
            }}
          >
            <Text style={styles.btnTxt}>
              {freeBusy ? 'Analyse en cours…' : 'Lancer diagnostic'}
            </Text>
          </Pressable>
          {freeResult ? <Text style={styles.result}>{freeResult}</Text> : null}
        </Card>

        <Card title="Suggestions YouTube">
          <YoutubeSuggestions items={yt} statusLabel={ytLabel} />
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  btn: { flex: 1, backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnWarn: { flex: 1, backgroundColor: colors.warn, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnDark: { flex: 1, backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnTxt: { color: colors.white, fontWeight: '800', fontSize: 13 },
  politeBox: { backgroundColor: colors.warnSoft, borderRadius: 10, padding: 10, gap: 4 },
  politeTitle: { fontWeight: '800', color: colors.warn },
  polite: { color: colors.slate, fontSize: 13, lineHeight: 19 },
  resultStack: { gap: 8 },
  partCard: {
    backgroundColor: colors.signalSoft,
    borderRadius: 10,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.signal,
  },
  priceCard: {
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  partLabel: { fontSize: 11, fontWeight: '800', color: colors.slate },
  partName: { fontWeight: '900', fontSize: 16, color: colors.ink },
  resultBox: { backgroundColor: colors.garageSoft, borderRadius: 10, padding: 10, gap: 6 },
  resultTitle: { fontWeight: '800', color: colors.garage, fontSize: 15 },
  meta: { color: colors.muted, fontSize: 12 },
  devis: { fontWeight: '800', color: colors.signal },
  linkCol: { gap: 6, marginTop: 4 },
  linkCta: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  linkCtaAlt: { backgroundColor: colors.garage, borderRadius: 10, padding: 12, alignItems: 'center' },
  linkSoft: {
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  linkSoftTxt: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  q: { fontWeight: '700', color: colors.ink, fontSize: 15 },
  row: { flexDirection: 'row', gap: 8 },
  yes: { flex: 1, backgroundColor: colors.garage, borderRadius: 10, padding: 12, alignItems: 'center' },
  no: { flex: 1, backgroundColor: colors.slate, borderRadius: 10, padding: 12, alignItems: 'center' },
  input: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    color: colors.ink,
    backgroundColor: colors.mist,
  },
  result: { color: colors.slate, lineHeight: 20 },
  cameraWrap: { gap: 8, marginTop: 8 },
  camera: { height: 180, borderRadius: 12, overflow: 'hidden' },
  thumbWrap: { gap: 4 },
  thumb: { height: 120, borderRadius: 10, backgroundColor: colors.mist },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 36,
    paddingHorizontal: 4,
  },
  waveBar: { width: 8, borderRadius: 3, backgroundColor: colors.mist },
  waveBarLive: { backgroundColor: colors.signal },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tagOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  tagTxt: { fontSize: 11, fontWeight: '700', color: colors.slate },
  tagTxtOn: { color: colors.white },
});
