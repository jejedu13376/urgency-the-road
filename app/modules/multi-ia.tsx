import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { SpeakButton } from '../../src/components/speech/SpeakButton';
import { StubBanner } from '../../src/components/StubBanner';
import { YoutubeSuggestions } from '../../src/components/YoutubeSuggestions';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import {
  listIaEngines,
  runMultiIaDiagnostic,
  type IaEngineId,
} from '../../src/services/ai/multiIaRouter';
import { resendEmailVerification } from '../../src/services/firebase/authService';
import { recordLearnedFailure } from '../../src/services/firebase/learnedFailuresService';
import { fetchRecallsByVehicle, type RecallHit } from '../../src/services/recalls/nhtsaRecalls';
import { stopAppSpeech } from '../../src/services/speech/appSpeech';
import { searchYoutubeVideos, type YoutubeVideoHit } from '../../src/services/youtube/youtubeSearch';
import { colors } from '../../src/theme/colors';
import { useI18n } from '../../src/context/I18nContext';

const ALL_MODELS = listIaEngines();

type ChatMsg = { role: 'user' | 'assistant'; text: string; at: string };

/** Module 6 — multi-IA conversationnelle + YouTube suggestions. */
export default function MultiIaScreen() {
  const { t } = useI18n();
  useModuleVisit(6);
  const { active } = useFleet();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_MODELS.map((m) => [m, true])),
  );
  const [q, setQ] = useState('remplacement plaquettes de frein');
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [out, setOut] = useState<string | null>(null);
  const [yt, setYt] = useState<YoutubeVideoHit[]>([]);
  const [ytLabel, setYtLabel] = useState<string | undefined>();
  const [recallsVisible, setRecallsVisible] = useState(true);
  const [recalls, setRecalls] = useState<RecallHit[]>([]);
  const [recallLabel, setRecallLabel] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [needVerify, setNeedVerify] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  const activeModels = ALL_MODELS.filter((m) => enabled[m]) as IaEngineId[];

  const onResendVerify = async () => {
    const r = await resendEmailVerification();
    setVerifyMsg(r.stubLabel ?? (r.ok ? 'Email renvoyé' : 'Échec renvoi'));
  };

  const run = async () => {
    const prompt = q.trim();
    if (!prompt || busy) return;
    setBusy(true);
    try {
      const ctx = [
        active?.vin ? `VIN ${active.vin}` : null,
        active ? `${active.make} ${active.model} ${active.year}` : null,
        active?.vehicleClass,
      ]
        .filter(Boolean)
        .join(' · ');
      const modelsLine = activeModels.length
        ? activeModels.join(', ')
        : 'aucun (réactivez un moteur)';
      const [diag, recallRes, ytRes] = await Promise.all([
        runMultiIaDiagnostic({ prompt, context: ctx, enabled: activeModels }),
        fetchRecallsByVehicle({
          make: active?.make,
          model: active?.model,
          year: active?.year,
        }),
        searchYoutubeVideos(
          [active?.make, active?.model, prompt].filter(Boolean).join(' ') || prompt,
          5,
        ),
      ]);
      setRecalls(recallRes.items);
      setRecallLabel(recallRes.label);
      const engineLines = diag.engines
        .map((e) => `· ${e.engine} [${e.source}/${e.latencyMs}ms]: ${e.summary}`)
        .join('\n');
      const text = [
        diag.label,
        `Moteurs : ${modelsLine}`,
        ctx ? `Contexte flotte : ${ctx}` : 'Aucun véhicule actif — résultats génériques.',
        diag.consensus,
        engineLines,
        recallRes.label,
        'Pistes : catalogue pièces (M3), OBD (M5), tutoriels YouTube (M11).',
      ].join('\n');
      setOut(text);
      setNeedVerify(Boolean(diag.emailVerificationRequired));
      const now = new Date().toISOString();
      setChat((prev) => [
        ...prev,
        { role: 'user', text: prompt, at: now },
        { role: 'assistant', text, at: now },
      ]);
      setYt(ytRes.items);
      setYtLabel(
        ytRes.ok
          ? `YouTube ${ytRes.source} HTTP ${ytRes.httpStatus} · ${ytRes.items.length} résultat(s)${ytRes.cached ? ' · cache' : ''}`
          : ytRes.error ?? `YouTube HTTP ${ytRes.httpStatus}`,
      );
      void recordLearnedFailure({
        summary: diag.consensus.slice(0, 400),
        likelyParts: diag.likelyParts,
        make: active?.make,
        model: active?.model,
        // vin intentionally omitted — never persisted to learnedFailures
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('moduleTitles.multiIa') }} />
      <Screen
        variant="stack" title={t('moduleTitles.multiIa')} subtitle={t('moduleTitles.multiIaSub')}>
        <StubBanner text="Multi-IA : heuristique croisée ; LIVE via proxy serveur uniquement ; recalls NHTSA + YouTube" />

        {needVerify ? (
          <Card title="Vérifie ton email">
            <Text style={styles.hint}>
              Le proxy LIVE exige un email vérifié. Ouvre le lien reçu, puis relance l’analyse.
            </Text>
            <Pressable style={styles.btnFull} onPress={() => void onResendVerify()}>
              <Text style={styles.btnTxt}>Renvoyer l’email de vérification</Text>
            </Pressable>
            {verifyMsg ? <Text style={styles.meta}>{verifyMsg}</Text> : null}
          </Card>
        ) : null}

        <Card title="Moteurs ciblés (routeur)">
          <Text style={styles.hint}>
            Claude · Gemini · GPT-4o · Grok · Mistral · DeepSeek — votes parallèles + consensus.
            Clés LLM côté serveur uniquement (EXPO_PUBLIC_MULTI_IA_PROXY_URL).
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
          <Text style={styles.meta}>{activeModels.length} moteur(s) actifs · parallel Promise.all</Text>
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
          <Pressable
            style={[styles.btnFull, busy && { opacity: 0.6 }]}
            onPress={() => void run()}
            disabled={busy}
          >
            <Text style={styles.btnTxt}>
              {busy ? 'Analyse multi-IA…' : 'Diagnostiquer + YouTube + recalls'}
            </Text>
          </Pressable>
          {chat.length ? (
            <Pressable style={styles.clearChat} onPress={() => setChat([])}>
              <Text style={styles.clearTxt}>Effacer l’historique chat</Text>
            </Pressable>
          ) : null}
        </Card>

        <Card title="Coach vocal mains-libres">
          <Text style={styles.hint}>
            Synthèse vocale (expo-speech) — langue FR/EN/ES active, rythme dyslexie-friendly. Mute global sur
            la carte GPS.
          </Text>
          <SpeakButton
            text={out ?? t('tts.coachReady')}
            labelKey="tts.speakDiag"
            testID="multiia-speak"
          />
          <Pressable
            style={[styles.stop, { marginTop: 8 }]}
            onPress={() => stopAppSpeech()}
            accessibilityRole="button"
            accessibilityLabel={t('tts.stop')}
          >
            <Text style={styles.btnTxt}>{t('tts.stop')}</Text>
          </Pressable>
        </Card>

        <Card title="Recherche web — recalls NHTSA (live)">
          <Pressable onPress={() => setRecallsVisible((v) => !v)}>
            <Text style={styles.section}>
              {recallsVisible ? 'Masquer' : 'Afficher'} rappels constructeurs
            </Text>
          </Pressable>
          {recallLabel ? <Text style={styles.meta}>{recallLabel}</Text> : null}
          {recallsVisible ? (
            recalls.length ? (
              recalls.map((r) => (
                <View key={r.id} style={styles.recallRow}>
                  <Text style={styles.recallTitle}>{r.title}</Text>
                  <Text style={styles.meta}>
                    {r.source} · {r.region} · {r.severity}
                    {r.component ? ` · ${r.component}` : ''}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.meta}>
                Aucun rappel pour ce véhicule / région (NHTSA vide ou non chargé).
              </Text>
            )
          ) : null}
          <Text style={styles.hint}>
            API NHTSA gratuite (NA). EU/AU TSB : à croiser via proxy Multi-IA quand disponible.
          </Text>
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
