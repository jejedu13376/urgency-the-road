import { useState } from 'react';
import * as Speech from 'expo-speech';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { YoutubeSuggestions } from '../../src/components/YoutubeSuggestions';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { stubAiDiagnose } from '../../src/services/stubs';
import { searchYoutubeVideos, type YoutubeVideoHit } from '../../src/services/youtube/youtubeSearch';
import { colors } from '../../src/theme/colors';

const ALL_MODELS = ['Claude', 'Gemini', 'GPT-4o', 'Grok', 'Mistral', 'DeepSeek'] as const;

type ChatMsg = { role: 'user' | 'assistant'; text: string; at: string };

type RecallStub = {
  id: string;
  title: string;
  source: string;
  severity: 'info' | 'warn' | 'critique';
  region: string;
};

const RECALL_STUBS: RecallStub[] = [
  {
    id: 'r1',
    title: 'Rappel freinage — plaquettes / étriers (mock TSB)',
    source: 'TSB constructeur (web stub)',
    severity: 'warn',
    region: 'EU / NA',
  },
  {
    id: 'r2',
    title: 'Bulletin AdBlue / NOx — calibrage logiciel PL',
    source: 'Recall mock SAE',
    severity: 'critique',
    region: 'EU',
  },
  {
    id: 'r3',
    title: 'Disponibilité pièce OEM — délai 3–7 j (mock stock)',
    source: 'Recherche web pièces',
    severity: 'info',
    region: 'Monde',
  },
];

/** Module 6 — multi-IA conversationnelle + YouTube suggestions. */
export default function MultiIaScreen() {
  useModuleVisit(6);
  const { active } = useFleet();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_MODELS.map((m) => [m, true])),
  );
  const [q, setQ] = useState('remplacement plaquettes de frein');
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [out, setOut] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [yt, setYt] = useState<YoutubeVideoHit[]>([]);
  const [ytLabel, setYtLabel] = useState<string | undefined>();
  const [recallsVisible, setRecallsVisible] = useState(true);

  const activeModels = ALL_MODELS.filter((m) => enabled[m]);

  const run = async () => {
    const prompt = q.trim();
    if (!prompt) return;
    const ctx = [
      active?.vin ? `VIN ${active.vin}` : null,
      active ? `${active.make} ${active.model} ${active.year}` : null,
      active?.vehicleClass,
    ]
      .filter(Boolean)
      .join(' · ');
    const r = stubAiDiagnose(ctx ? `${prompt} | ctx:${ctx}` : prompt);
    const modelsLine = activeModels.length ? activeModels.join(', ') : 'aucun (réactivez un moteur)';
    const text = [
      r.label,
      `Routeur mock — moteurs croisés : ${modelsLine}`,
      ctx ? `Contexte flotte : ${ctx}` : 'Aucun véhicule actif — résultats génériques.',
      'Web live recalls/TSB : stubs locaux (pas d’API constructeur).',
      r.data.summary,
      'Pistes : catalogue pièces (M3), OBD (M5), tutoriels YouTube (M11).',
    ].join('\n');
    setOut(text);
    const now = new Date().toISOString();
    setChat((prev) => [
      ...prev,
      { role: 'user', text: prompt, at: now },
      { role: 'assistant', text, at: now },
    ]);
    const searchQ = [active?.make, active?.model, prompt].filter(Boolean).join(' ');
    const ytRes = await searchYoutubeVideos(searchQ || prompt, 5);
    setYt(ytRes.items);
    setYtLabel(
      ytRes.ok
        ? `YouTube API HTTP ${ytRes.httpStatus} · ${ytRes.items.length} résultat(s)`
        : ytRes.error ?? `YouTube HTTP ${ytRes.httpStatus}`,
    );
  };

  const speak = () => {
    const text = out ?? 'Coach vocal prêt. Lancez d’abord une analyse.';
    setSpeaking(true);
    Speech.speak(text.slice(0, 280), {
      language: 'fr-FR',
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
    });
  };

  const stopVoice = () => {
    Speech.stop();
    setSpeaking(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Multi-IA' }} />
      <Screen title="Routeur multi-IA" subtitle="Module 6 — coach vocal + chat + YouTube">
        <StubBanner text="STUB IA — multi-modèles mock ; YouTube Data API si EXPO_PUBLIC_YOUTUBE_API_KEY" />

        <Card title="Moteurs ciblés (routeur)">
          <Text style={styles.hint}>
            Claude · Gemini · GPT-4o · Grok · Mistral · DeepSeek — activez/désactivez pour simuler le croisement.
          </Text>
          <View style={styles.chips}>
            {ALL_MODELS.map((m) => (
              <Pressable
                key={m}
                style={[styles.chip, enabled[m] && styles.chipOn]}
                onPress={() => setEnabled((prev) => ({ ...prev, [m]: !prev[m] }))}
              >
                <Text style={[styles.chipTxt, enabled[m] && styles.chipTxtOn]}>
                  {m}
                  {enabled[m] ? '' : ' off'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.meta}>{activeModels.length} moteur(s) actifs · * = mock non connecté</Text>
        </Card>

        <Card title="Contexte véhicule">
          {active ? (
            <>
              <Text style={styles.ctxTitle}>
                {active.label} — {active.make} {active.model} {active.year}
              </Text>
              <Text style={styles.meta}>
                {active.vin ? `VIN ${active.vin}` : 'Sans VIN'} · {active.vehicleClass} · {active.currency}
              </Text>
            </>
          ) : (
            <Text style={styles.hint}>Aucun véhicule actif — réponses moins précises.</Text>
          )}
          <Link href="/(tabs)/mon-vehicule" asChild>
            <Pressable style={styles.linkSoft}>
              <Text style={styles.linkSoftTxt}>Mon véhicule / VIN (M1) →</Text>
            </Pressable>
          </Link>
        </Card>

        <Card title="Chat / talk-to-AI (texte)">
          <Text style={styles.hint}>Parlez ou tapez pour diagnostiquer, trouver des pièces et comprendre les réparations.</Text>
          {chat.length > 0 ? (
            <View style={styles.chatBox}>
              {chat.slice(-8).map((m, i) => (
                <View
                  key={`${m.at}-${i}`}
                  style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}
                >
                  <Text style={styles.bubbleRole}>{m.role === 'user' ? 'Vous' : 'Multi-IA'}</Text>
                  <Text style={styles.bubbleTxt}>{m.text}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <TextInput
            value={q}
            onChangeText={setQ}
            style={styles.input}
            placeholder="Ex. bruit métallique à froid…"
            placeholderTextColor={colors.muted}
            multiline
          />
          <Pressable style={styles.btnFull} onPress={() => void run()}>
            <Text style={styles.btnTxt}>Diagnostiquer + suggérer YouTube</Text>
          </Pressable>
          {chat.length ? (
            <Pressable style={styles.clearChat} onPress={() => setChat([])}>
              <Text style={styles.clearTxt}>Effacer l’historique chat</Text>
            </Pressable>
          ) : null}
        </Card>

        <Card title="Coach vocal mains-libres">
          <Text style={styles.hint}>Synthèse vocale (expo-speech) — bouton Stop Voix instantané.</Text>
          <View style={styles.row}>
            <Pressable style={styles.btn} onPress={speak}>
              <Text style={styles.btnTxt}>{speaking ? 'Lecture…' : 'Parler'}</Text>
            </Pressable>
            <Pressable style={styles.stop} onPress={stopVoice}>
              <Text style={styles.btnTxt}>Stop Voix</Text>
            </Pressable>
          </View>
        </Card>

        <Card title="Recherche web — recalls / TSB (stubs)">
          <Pressable onPress={() => setRecallsVisible((v) => !v)}>
            <Text style={styles.section}>
              {recallsVisible ? 'Masquer' : 'Afficher'} rappels constructeurs mock
            </Text>
          </Pressable>
          {recallsVisible
            ? RECALL_STUBS.map((r) => (
                <View key={r.id} style={styles.recallRow}>
                  <Text style={styles.recallTitle}>{r.title}</Text>
                  <Text style={styles.meta}>
                    {r.source} · {r.region} · {r.severity}
                  </Text>
                </View>
              ))
            : null}
          <Text style={styles.hint}>Accès internet temps réel non branché — stubs locaux pour UX.</Text>
        </Card>

        {out ? (
          <Card title="Dernière sortie">
            <Text style={styles.out}>{out}</Text>
            <View style={styles.linkCol}>
              <Link href="/modules/pieces" asChild>
                <Pressable style={styles.linkCta}>
                  <Text style={styles.btnTxt}>Catalogue / devis (M3) →</Text>
                </Pressable>
              </Link>
              <Link href="/modules/obd" asChild>
                <Pressable style={styles.linkSoft}>
                  <Text style={styles.linkSoftTxt}>Valider via OBD (M5) →</Text>
                </Pressable>
              </Link>
              <Link href="/modules/tutoriels" asChild>
                <Pressable style={styles.linkSoft}>
                  <Text style={styles.linkSoftTxt}>Tutoriels / YouTube (M11) →</Text>
                </Pressable>
              </Link>
            </View>
          </Card>
        ) : null}

        <Card title="Suggestions YouTube">
          <Text style={styles.hint}>Aucune vidéo embarquée — redirection YouTube uniquement.</Text>
          <YoutubeSuggestions items={yt} statusLabel={ytLabel} />
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.mist, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { fontWeight: '700', color: colors.slate, fontSize: 12 },
  chipTxtOn: { color: colors.white },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  meta: { color: colors.muted, fontSize: 12 },
  section: { fontWeight: '800', color: colors.ink },
  ctxTitle: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    color: colors.ink,
    backgroundColor: colors.mist,
    minHeight: 56,
  },
  btn: { flex: 1, backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnFull: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  stop: { flex: 1, backgroundColor: colors.danger, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnTxt: { color: colors.white, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
  out: { color: colors.slate, lineHeight: 20 },
  chatBox: { gap: 8, maxHeight: 320 },
  bubble: { borderRadius: 10, padding: 10, gap: 2 },
  bubbleUser: { backgroundColor: colors.signalSoft, alignSelf: 'flex-end', maxWidth: '92%' },
  bubbleAi: { backgroundColor: colors.mist, alignSelf: 'flex-start', maxWidth: '92%', borderWidth: 1, borderColor: colors.line },
  bubbleRole: { fontSize: 10, fontWeight: '800', color: colors.slate },
  bubbleTxt: { color: colors.ink, fontSize: 13, lineHeight: 18 },
  clearChat: { alignItems: 'center', padding: 6 },
  clearTxt: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  recallRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 2 },
  recallTitle: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  linkCol: { gap: 6, marginTop: 8 },
  linkCta: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  linkSoft: {
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  linkSoftTxt: { color: colors.ink, fontWeight: '700', fontSize: 13 },
});
