import { useState } from 'react';
import * as Speech from 'expo-speech';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { stubAiDiagnose } from '../../src/services/stubs';
import { colors } from '../../src/theme/colors';

const MODELS = ['Claude', 'Gemini', 'GPT-4o', 'Grok', 'Mistral', 'DeepSeek'];

/** Module 6 — multi-IA + coach vocal. */
export default function MultiIaScreen() {
  useModuleVisit(6);
  const [q, setQ] = useState('Rappel constructeur F-150 camphaser ?');
  const [out, setOut] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const run = () => {
    const r = stubAiDiagnose(q);
    const text = `${r.label}\nModèles croisés (mock) : ${r.data.models.join(', ')}\nWeb live recalls/TSB : non branché.\n${r.data.summary}`;
    setOut(text);
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

  return (
    <>
      <Stack.Screen options={{ title: 'Multi-IA' }} />
      <Screen title="Routeur multi-IA" subtitle="Module 6 — coach vocal">
        <StubBanner text="STUB IA — aucun appel Claude/GPT/Gemini/Grok/Mistral/DeepSeek live" />
        <Card title="Moteurs ciblés">
          <View style={styles.chips}>
            {MODELS.map((m) => (
              <View key={m} style={styles.chip}>
                <Text style={styles.chipTxt}>{m}*</Text>
              </View>
            ))}
          </View>
        </Card>
        <Card title="Recherche + croisement">
          <TextInput value={q} onChangeText={setQ} style={styles.input} placeholderTextColor={colors.muted} />
          <Pressable style={styles.btn} onPress={run}>
            <Text style={styles.btnTxt}>Croiser diagnostics (stub)</Text>
          </Pressable>
        </Card>
        <Card title="Coach vocal mains-libres">
          <View style={styles.row}>
            <Pressable style={styles.btn} onPress={speak}>
              <Text style={styles.btnTxt}>{speaking ? 'Lecture…' : 'Parler'}</Text>
            </Pressable>
            <Pressable
              style={styles.stop}
              onPress={() => {
                Speech.stop();
                setSpeaking(false);
              }}
            >
              <Text style={styles.btnTxt}>Stop Voix</Text>
            </Pressable>
          </View>
        </Card>
        {out ? (
          <Card title="Sortie">
            <Text style={styles.out}>{out}</Text>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.mist, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  chipTxt: { fontWeight: '700', color: colors.slate, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    color: colors.ink,
    backgroundColor: colors.mist,
  },
  btn: { flex: 1, backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  stop: { flex: 1, backgroundColor: colors.danger, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnTxt: { color: colors.white, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 8 },
  out: { color: colors.slate, lineHeight: 20 },
});
