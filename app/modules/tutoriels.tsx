import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { YoutubeSuggestions } from '../../src/components/YoutubeSuggestions';
import { useFleet } from '../../src/context/FleetContext';
import { MOCK_TUTORIALS } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import {
  isYoutubeApiConfigured,
  searchYoutubeVideos,
  type YoutubeVideoHit,
} from '../../src/services/youtube/youtubeSearch';
import { colors } from '../../src/theme/colors';

/** Module 11 — schémas locaux + suggestions YouTube (redirection, jamais de vidéo embarquée). */
export default function TutorielsScreen() {
  useModuleVisit(11);
  const { active } = useFleet();
  const [query, setQuery] = useState('remplacer plaquettes de frein');
  const [openId, setOpenId] = useState<string | null>(MOCK_TUTORIALS[0]?.id ?? null);
  const [yt, setYt] = useState<YoutubeVideoHit[]>([]);
  const [ytLabel, setYtLabel] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (problem: string) => {
      setLoading(true);
      const q = [active?.make, active?.model, problem].filter(Boolean).join(' ');
      const res = await searchYoutubeVideos(q || problem, 6);
      setYt(res.items);
      if (res.ok) {
        setYtLabel(`YouTube API · ${res.items.length} suggestion(s) — ouverture Watch uniquement`);
      } else if (res.source === 'fallback_search_url') {
        setYtLabel(res.error ?? 'Clé YouTube absente — utilisez la recherche YouTube ci-dessous');
      } else {
        setYtLabel(res.error ?? `YouTube HTTP ${res.httpStatus}`);
      }
      setLoading(false);
    },
    [active?.make, active?.model],
  );

  useEffect(() => {
    void load(query);
  }, [load, query]);

  const openSearchFallback = () => {
    const q = encodeURIComponent([active?.make, active?.model, query].filter(Boolean).join(' '));
    void Linking.openURL(`https://www.youtube.com/results?search_query=${q}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Tutoriels' }} />
      <Screen title="Tutoriels" subtitle="Module 11 — aucune vidéo embarquée">
        <StubBanner text="Pas de fichier vidéo dans l’app : suggestions YouTube + redirection Watch / recherche" />

        <Card title="Rechercher une opération">
          <Text style={styles.meta}>
            Véhicule : {active ? `${active.make} ${active.model}` : 'non sélectionné'} · API{' '}
            {isYoutubeApiConfigured() ? 'configurée' : 'non configurée'}
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="ex. courroie distribution, NOx, plaquettes…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <View style={styles.row}>
            <Pressable style={styles.btn} onPress={() => void load(query)} disabled={loading}>
              <Text style={styles.btnTxt}>{loading ? 'Recherche…' : 'Suggérer YouTube'}</Text>
            </Pressable>
            <Pressable style={styles.btnDark} onPress={openSearchFallback}>
              <Text style={styles.btnTxt}>Ouvrir YouTube</Text>
            </Pressable>
          </View>
        </Card>

        <Card title="Suggestions YouTube">
          <YoutubeSuggestions items={yt} statusLabel={ytLabel} />
        </Card>

        <Card title="Schémas / étapes (texte local)">
          <Text style={styles.meta}>Montage côté app en texte — pas de lecteur vidéo intégré.</Text>
          {MOCK_TUTORIALS.map((t) => (
            <View key={t.id} style={styles.tut}>
              <Text style={styles.tutTitle}>{t.title}</Text>
              <Text style={styles.meta}>
                {t.make} {t.model} · {t.durationMin} min
              </Text>
              <Pressable onPress={() => setOpenId(openId === t.id ? null : t.id)}>
                <Text style={styles.link}>{openId === t.id ? 'Masquer étapes' : 'Voir étapes'}</Text>
              </Pressable>
              {openId === t.id ? (
                <View style={styles.steps}>
                  {t.steps.map((s, i) => (
                    <Text key={s} style={styles.step}>
                      {i + 1}. {s}
                    </Text>
                  ))}
                </View>
              ) : null}
              <Pressable
                onPress={() => {
                  setQuery(t.title);
                  void load(t.title);
                }}
              >
                <Text style={styles.link}>Voir sur YouTube →</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
    marginTop: 6,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { flex: 1, backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnDark: { flex: 1, backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
  btnTxt: { color: colors.white, fontWeight: '800', fontSize: 12 },
  link: { color: colors.signal, fontWeight: '800', marginTop: 4 },
  tut: { gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  tutTitle: { fontWeight: '800', color: colors.ink },
  steps: { gap: 4, backgroundColor: colors.mist, borderRadius: 8, padding: 10, marginTop: 4 },
  step: { color: colors.slate },
});
