import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { stubAcoustic, stubAiDiagnose } from '../../src/services/stubs';
import { colors } from '../../src/theme/colors';

const QUESTIONS = [
  'Entendez-vous un bruit métallique ?',
  'Y a-t-il de la fumée ? Couleur ?',
  'Un voyant est-il allumé ?',
  'Le comportement change-t-il en charge ?',
];

/** Module 4 — diagnostic IA photo/vidéo/questions/acoustique. */
export default function DiagnosticIaScreen() {
  useModuleVisit(4);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [polite, setPolite] = useState<string | null>(null);

  const answer = (yes: boolean) => {
    const next = [...answers, yes ? 'oui' : 'non'];
    setAnswers(next);
    if (step + 1 >= QUESTIONS.length) {
      const r = stubAiDiagnose(`Q:${next.join(',')}`);
      setResult(`${r.label}\n${r.data.summary}`);
    } else setStep(step + 1);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Diagnostic IA' }} />
      <Screen title="Diagnostic intelligent" subtitle="Module 4">
        <StubBanner text="STUB IA — photo/vidéo/micro non branchés ; parcours questions local" />
        <Card title="Photo / vidéo pièce">
          <Pressable
            style={styles.btn}
            onPress={() =>
              setPolite(
                'Filtre de politesse (mock) : envoyez une photo liée à une pièce, fuite ou voyant véhicule — hors sujet refusé poliment.',
              )
            }
          >
            <Text style={styles.btnTxt}>Simuler envoi photo</Text>
          </Pressable>
          {polite ? <Text style={styles.polite}>{polite}</Text> : null}
        </Card>
        <Card title={`Questions intelligentes (${step + 1}/${QUESTIONS.length})`}>
          <Text style={styles.q}>{QUESTIONS[Math.min(step, QUESTIONS.length - 1)]}</Text>
          <View style={styles.row}>
            <Pressable style={styles.yes} onPress={() => answer(true)}>
              <Text style={styles.btnTxt}>Oui</Text>
            </Pressable>
            <Pressable style={styles.no} onPress={() => answer(false)}>
              <Text style={styles.btnTxt}>Non</Text>
            </Pressable>
          </View>
        </Card>
        <Card title="Analyseur acoustique moteur">
          <Pressable
            style={styles.btnDark}
            onPress={() => {
              const a = stubAcoustic();
              setResult(`${a.label}\n${a.data.guess}`);
            }}
          >
            <Text style={styles.btnTxt}>Écouter (stub micro)</Text>
          </Pressable>
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
              const r = stubAiDiagnose(note || 'panne inconnue');
              setResult(`${r.label}\n${r.data.summary}\nOutils mock · budget estimé 120–380 EUR`);
            }}
          >
            <Text style={styles.btnTxt}>Lancer diagnostic</Text>
          </Pressable>
        </Card>
        {result ? (
          <Card title="Résultat">
            <Text style={styles.result}>{result}</Text>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnDark: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnTxt: { color: colors.white, fontWeight: '800' },
  polite: { color: colors.slate, fontSize: 13 },
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
});
