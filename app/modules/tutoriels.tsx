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
import { useI18n } from '../../src/context/I18nContext';

const EXTRA_TUTORIALS = [
  {
    id: 't3',
    title: 'Remplacer filtre habitacle',
    make: 'Ford',
    model: 'F-150',
    durationMin: 20,
    steps: [
      'Ouvrir boîte à gants / trappe filtre',
      'Retirer l’ancien filtre',
      'Noter le sens du flux d’air',
      'Insérer le neuf et refermer',
    ],
  },
  {
    id: 't4',
    title: 'Contrôle niveau AdBlue',
    make: 'Mercedes-Benz',
    model: 'Actros',
    durationMin: 15,
    steps: [
      'Stationner à plat',
      'Localiser trappe AdBlue',
      'Lire niveau / jauge',
      'Compléter si besoin (qualité ISO)',
    ],
  },
];

/** Module 11 — schémas locaux + suggestions YouTube (redirection, jamais de vidéo embarquée). */
export default function TutorielsScreen() {
  const { t } = useI18n();
  useModuleVisit(11);
  const { active } = useFleet();
  const [query, setQuery] = useState('remplacer plaquettes de frein');
  const tutorials = [...MOCK_TUTORIALS, ...EXTRA_TUTORIALS];
  const [openId, setOpenId] = useState<string | null>(tutorials[0]?.id ?? null);
  const [yt, setYt] = useState<YoutubeVideoHit[]>([]);
  const [ytLabel, setYtLabel] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [stepDone, setStepDone] = useState<Record<string, boolean>>({});

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

  const toggleStep = (key: string) =>
    setStepDone((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
      <Stack.Screen options={{ title: t('moduleTitles.tutoriels') }} />
      <Screen
        variant="stack" title={t('moduleTitles.tutoriels')} subtitle={t('moduleTitles.tutorielsSub')}>
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

        <Card title="Suggestions YouTube (redirection)">
          <Text style={styles.meta}>
            Aucun lecteur intégré — chaque suggestion ouvre YouTube (Watch ou recherche).
          </Text>
          <YoutubeSuggestions items={yt} statusLabel={ytLabel} />
        </Card>

        <Card title="Schémas / étapes (texte local)">
          <Text style={styles.meta}>
            Montage côté app en texte — cochez les étapes. Pas de lecteur vidéo intégré.
          </Text>
          {tutorials.map((t) => (
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
                  {t.steps.map((s, i) => {
                    const key = `${t.id}-${i}`;
                    const done = !!stepDone[key];
                    return (
                      <Pressable key={key} style={styles.stepRow} onPress={() => toggleStep(key)}>
                        <Text style={[styles.stepCheck, done && styles.stepCheckOn]}>
                          {done ? '✓' : '○'}
                        </Text>
                        <Text style={[styles.step, done && styles.stepDone]}>
                          {i + 1}. {s}
                        </Text>
                      </Pressable>
                    );
                  })}
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
  steps: { gap: 6, backgroundColor: colors.mist, borderRadius: 8, padding: 10, marginTop: 4 },
  stepRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  stepCheck: { fontWeight: '900', color: colors.muted, width: 16 },
  stepCheckOn: { color: colors.garage },
  step: { color: colors.slate, flex: 1 },
  stepDone: { textDecorationLine: 'line-through', color: colors.muted },
});
