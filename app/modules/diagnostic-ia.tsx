import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { YoutubeSuggestions } from '../../src/components/YoutubeSuggestions';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { stubAcoustic, stubAiDiagnose } from '../../src/services/stubs';
import { searchYoutubeVideos, type YoutubeVideoHit } from '../../src/services/youtube/youtubeSearch';
import { colors } from '../../src/theme/colors';

type PhotoOutcome = {
  kind: 'ok' | 'polite_refuse';
  media: 'photo' | 'video';
  problem: string;
  partName: string;
  partPrice: number;
  laborPrice: number;
  currency: string;
  causes: string[];
  tools: string[];
  summary: string;
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

/** Module 4 — diagnostic IA photo → pièce+prix+devis, questions, politesse, acoustique. */
export default function DiagnosticIaScreen() {
  useModuleVisit(4);
  const { active } = useFleet();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [photoOutcome, setPhotoOutcome] = useState<PhotoOutcome | null>(null);
  const [acousticPhase, setAcousticPhase] = useState<'idle' | 'listening' | 'done'>('idle');
  const [acousticFocus, setAcousticFocus] = useState<string | null>(null);
  const [acousticGuess, setAcousticGuess] = useState<string | null>(null);
  const [acousticBars] = useState(() => [4, 10, 6, 14, 8, 12, 5, 11, 7, 13]);
  const [qResult, setQResult] = useState<string | null>(null);
  const [freeResult, setFreeResult] = useState<string | null>(null);
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

  const simulateMedia = (offTopic: boolean, media: 'photo' | 'video' = 'photo') => {
    if (offTopic) {
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
        summary:
          'Merci pour l’envoi. Cette image ne semble pas liée à un véhicule ou une pièce mécanique. Pour vous aider, photographiez une fuite, un composant rouillé/cassé, un voyant ou le compartiment moteur — je recentre volontiers le diagnostic.',
      });
      return;
    }
    const partName = active?.vehicleClass === 'poids_lourd' ? 'Capteur NOx amont' : 'Plaquettes avant';
    const partPrice = active?.vehicleClass === 'poids_lourd' ? 310 : 55;
    const laborPrice = active?.vehicleClass === 'poids_lourd' ? 198 : 102;
    const outcome: PhotoOutcome = {
      kind: 'ok',
      media,
      problem: media === 'video' ? 'Fuite / usure visible en mouvement (mock vidéo)' : 'Usure / composant à remplacer (mock photo)',
      partName,
      partPrice,
      laborPrice,
      currency: active?.currency ?? 'EUR',
      causes: ['Usure normale', 'Surcharge thermique', 'Entretien différé'],
      tools: ['Cric / chandelles', 'Clé dynamométrique', 'Douilles standard'],
      summary: stubAiDiagnose(`photo:${partName}`).data.summary,
    };
    setPhotoOutcome(outcome);
    void loadYoutube(`${partName} remplacement`);
  };

  const answer = (yes: boolean) => {
    const next = [...answers, yes ? 'oui' : 'non'];
    setAnswers(next);
    if (step + 1 >= QUESTIONS.length) {
      const r = stubAiDiagnose(`Q:${next.join(',')}`);
      setQResult(`${r.label}\n${r.data.summary}`);
      void loadYoutube('bruit moteur voyant diagnostic automobile');
    } else setStep(step + 1);
  };

  const resetQuestions = () => {
    setStep(0);
    setAnswers([]);
    setQResult(null);
  };

  const runAcoustic = () => {
    setAcousticPhase('listening');
    setAcousticGuess(null);
    setTimeout(() => {
      const a = stubAcoustic();
      setAcousticGuess(`${a.label}\n${a.data.guess}`);
      setAcousticPhase('done');
      void loadYoutube('bruit moteur courroie roulement');
    }, 900);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Diagnostic IA' }} />
      <Screen
        title="Diagnostic intelligent"
        subtitle={`Module 4 · ${active?.make ?? '—'} ${active?.model ?? ''}`.trim()}
      >
        <StubBanner text="STUB IA — photo/vidéo/micro non branchés ; YouTube via Data API si clé .env" />

        <Card title="Photo → pièce + prix + devis">
          <Text style={styles.hint}>
            Photographiez une pièce cassée, rouillée ou une fuite. L’IA mock identifie le problème, la pièce, le prix et
            un petit devis (pièce + pose).
          </Text>
          <View style={styles.row}>
            <Pressable style={styles.btn} onPress={() => simulateMedia(false, 'photo')}>
              <Text style={styles.btnTxt}>Simuler photo</Text>
            </Pressable>
            <Pressable style={styles.btnDark} onPress={() => simulateMedia(false, 'video')}>
              <Text style={styles.btnTxt}>Simuler vidéo live</Text>
            </Pressable>
          </View>
          <Pressable style={styles.btnWarn} onPress={() => simulateMedia(true, 'photo')}>
            <Text style={styles.btnTxt}>Photo hors sujet (filtre politesse)</Text>
          </Pressable>
          {photoOutcome?.kind === 'polite_refuse' ? (
            <View style={styles.politeBox}>
              <Text style={styles.politeTitle}>Filtre de politesse</Text>
              <Text style={styles.polite}>{photoOutcome.summary}</Text>
            </View>
          ) : null}
          {photoOutcome?.kind === 'ok' ? (
            <View style={styles.resultStack}>
              <View style={styles.resultBox}>
                <Text style={styles.resultTitle}>Problème ({photoOutcome.media})</Text>
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
                <Pressable style={styles.yes} onPress={() => answer(true)}>
                  <Text style={styles.btnTxt}>Oui</Text>
                </Pressable>
                <Pressable style={styles.no} onPress={() => answer(false)}>
                  <Text style={styles.btnTxt}>Non</Text>
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
            Écoute mock du bruit moteur (micro non utilisé) — courroie, injecteur, bielle, roulement.
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
              {acousticPhase === 'listening' ? 'Écoute en cours…' : 'Écouter (stub micro)'}
            </Text>
          </Pressable>
          {acousticGuess ? <Text style={styles.result}>{acousticGuess}</Text> : null}
          {acousticPhase === 'done' ? (
            <Link href="/modules/pieces" asChild>
              <Pressable style={styles.linkCta}>
                <Text style={styles.btnTxt}>Pièce suspecte → catalogue →</Text>
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
            style={styles.btn}
            onPress={() => {
              const problem = note || 'panne inconnue';
              const r = stubAiDiagnose(problem);
              setFreeResult(
                `${r.label}\n${r.data.summary}\nOutils mock · budget estimé 120–380 ${active?.currency ?? 'EUR'}`,
              );
              void loadYoutube(problem);
            }}
          >
            <Text style={styles.btnTxt}>Lancer diagnostic</Text>
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
