import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Link, Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { YoutubeSuggestions } from '../../src/components/YoutubeSuggestions';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { runMultiIaDiagnostic } from '../../src/services/ai/multiIaRouter';
import { stubAcoustic } from '../../src/services/stubs';
import { searchYoutubeVideos, type YoutubeVideoHit } from '../../src/services/youtube/youtubeSearch';
import { colors } from '../../src/theme/colors';

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
  useModuleVisit(4);
  const { active } = useFleet();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [photoOutcome, setPhotoOutcome] = useState<PhotoOutcome | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [mediaNote, setMediaNote] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [acousticPhase, setAcousticPhase] = useState<'idle' | 'listening' | 'done'>('idle');
  const [acousticFocus, setAcousticFocus] = useState<string | null>(null);
  const [acousticGuess, setAcousticGuess] = useState<string | null>(null);
  const [acousticBars] = useState(() => [4, 10, 6, 14, 8, 12, 5, 11, 7, 13]);
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
        summary:
          media === 'video'
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
        prompt: `Diagnostic ${media} (description utilisateur, pas de vision pixels) : ${desc}`,
        context: ctx,
      });
      const partName = r.likelyParts[0] ?? (active?.vehicleClass === 'poids_lourd' ? 'Capteur NOx' : 'Pièce à confirmer');
      const partPrice = active?.vehicleClass === 'poids_lourd' ? 310 : 55;
      const laborPrice = active?.vehicleClass === 'poids_lourd' ? 198 : 102;
      setPhotoOutcome({
        kind: 'ok',
        media,
        problem: desc.slice(0, 160),
        partName,
        partPrice,
        laborPrice,
        currency: active?.currency ?? 'EUR',
        causes: ['Hypothèse Multi-IA texte', 'À confirmer OBD / garage'],
        tools: ['Cric / chandelles', 'Clé dynamométrique', 'Douilles standard'],
        visionLive: false,
        summary: `${r.label}\n${r.consensus}`,
      });
      void loadYoutube(`${partName} remplacement`);
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
    setShowCamera(true);
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
        'Caméra LIVE ouverte. Vision IA pixels non branchée (proxy vision à venir) — décrivez ce que vous voyez puis lancez l’analyse texte.',
    });
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

  const runAcoustic = () => {
    setAcousticPhase('listening');
    setAcousticGuess(null);
    setTimeout(() => {
      const a = stubAcoustic();
      const focusBit = acousticFocus
        ? `Piste sélectionnée : ${HAZARD_KINDS_ACOUSTIC.find((k) => k.id === acousticFocus)?.label ?? acousticFocus}.`
        : 'Aucune piste sélectionnée.';
      setAcousticGuess(`${a.label}\n${a.data.guess}\n${focusBit}`);
      setAcousticPhase('done');
      if (acousticFocus) void loadYoutube(`bruit moteur ${acousticFocus}`);
    }, 600);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Diagnostic IA' }} />
      <Screen
        title="Diagnostic intelligent"
        subtitle={`Module 4 · ${active?.make ?? '—'} ${active?.model ?? ''}`.trim()}
      >
        <StubBanner text="Caméra LIVE possible · vision pixels non branchée · Multi-IA texte / YouTube si clés .env" />

        <Card title="Photo / vidéo → description → pièce + devis">
          <Text style={styles.hint}>
            Ouvrez la caméra (média réel), décrivez la panne, puis lancez le diagnostic Multi-IA texte. Aucune
            « identification visuelle réussie » inventée sans backend vision.
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
              <CameraView style={styles.camera} facing="back" />
              <Pressable style={styles.btnWarn} onPress={() => setShowCamera(false)}>
                <Text style={styles.btnTxt}>Fermer la caméra</Text>
              </Pressable>
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
              <Text style={styles.btnTxt}>{mediaBusy ? 'Analyse…' : 'Analyser (Multi-IA texte)'}</Text>
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
          <Text style={styles.hint}>
            Micro non capturé dans cette build — sélectionnez une piste et lancez : message honnête, pas de faux
            diagnostic audio.
          </Text>
          <View style={styles.waveRow}>
            {acousticBars.map((h, i) => (
              <View
                key={`bar-${i}`}
                style={[
                  styles.waveBar,
                  { height: acousticPhase === 'listening' ? 8 + ((h + i) % 14) : h + 4 },
                  acousticPhase === 'listening' && styles.waveBarLive,
                ]}
              />
            ))}
          </View>
          <View style={styles.tags}>
            {HAZARD_KINDS_ACOUSTIC.map((k) => (
              <Pressable key={k.id} style={[styles.tag, acousticFocus === k.id && styles.tagOn]} onPress={() => setAcousticFocus(k.id)}>
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
              {acousticPhase === 'listening' ? 'Vérification…' : 'Lancer (honnête — pas de micro)'}
            </Text>
          </Pressable>
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
                  setFreeResult(
                    `${r.label}\n${r.consensus}\nPièces: ${r.likelyParts.join(', ') || '—'}\nBudget indicatif 120–380 ${active?.currency ?? 'EUR'}`,
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
  btnWarn: { backgroundColor: colors.warn, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
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
