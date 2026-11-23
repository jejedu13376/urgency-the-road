import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { MOCK_TUTORIALS } from '../../src/data/mocks';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { suggestYoutube } from '../../src/services/firebase';
import type { YoutubeSuggestionDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

/** Module 11 — steps local + YouTube URL stubs (no embedded video). */
export default function TutorielsScreen() {
  useModuleVisit(11);
  const { active } = useFleet();
  const [openId, setOpenId] = useState<string | null>(MOCK_TUTORIALS[0]?.id ?? null);
  const [yt, setYt] = useState<YoutubeSuggestionDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      const res = await suggestYoutube('remplacer plaquettes', active?.make, active?.model);
      setYt(res.data);
      setLabel(res.stubLabel);
    })();
  }, [active?.make, active?.model]);

  return (
    <>
      <Stack.Screen options={{ title: 'Tutoriels' }} />
      <Screen title="Tutoriels" subtitle="Module 11 — pas de vidéo embarquée">
        <BackendStatusBanner />
        {label ? <StubBanner text={label} /> : null}
        <Card title="Suggestions YouTube (redirection)">
          {yt.map((v) => (
            <Pressable key={v.id} onPress={() => void Linking.openURL(v.youtubeUrl)}>
              <Text style={styles.link}>▶ {v.title}</Text>
            </Pressable>
          ))}
        </Card>
        {MOCK_TUTORIALS.map((t) => (
          <Card key={t.id} title={t.title}>
            <Text style={styles.meta}>{t.make} {t.model} · {t.durationMin} min</Text>
            <Pressable onPress={() => setOpenId(openId === t.id ? null : t.id)}>
              <Text style={styles.link}>{openId === t.id ? 'Masquer étapes' : 'Voir étapes'}</Text>
            </Pressable>
            {openId === t.id ? (
              <View style={styles.steps}>
                {t.steps.map((s, i) => (
                  <Text key={s} style={styles.step}>{i + 1}. {s}</Text>
                ))}
              </View>
            ) : null}
          </Card>
        ))}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 12 },
  link: { color: colors.signal, fontWeight: '800' },
  steps: { gap: 4, backgroundColor: colors.mist, borderRadius: 8, padding: 10 },
  step: { color: colors.slate },
});
