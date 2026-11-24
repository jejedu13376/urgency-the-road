import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { CatalogProductCard } from '../../src/components/CatalogProductCard';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useFleet } from '../../src/context/FleetContext';
import { useI18n } from '../../src/context/I18nContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { listPartsForVin } from '../../src/services/firebase';
import type { PartDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

const CAT_ICON: Record<PartDoc['category'], keyof typeof Ionicons.glyphMap> = {
  mecanique: 'construct-outline',
  electrique: 'flash-outline',
  carrosserie: 'car-outline',
  fluide: 'water-outline',
  filtre: 'funnel-outline',
};

const CAT_TONE: Record<PartDoc['category'], string> = {
  mecanique: '#E4E9EE',
  electrique: '#F3E2C8',
  carrosserie: '#D9E8F2',
  fluide: '#D7EDE3',
  filtre: '#F5E9B8',
};

function formatPrice(amount: number, currency: string) {
  return `${Math.round(amount)} ${currency}`;
}

/** Module 3 — catalogue type Canadian Tire / Amazon : recherche → photo + nom + prix. */
export default function PiecesScreen() {
  const { t } = useI18n();
  useModuleVisit(3);
  const { active } = useFleet();
  const [parts, setParts] = useState<PartDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await listPartsForVin(active?.vin, {
          isHeavyTruck: active?.vehicleClass === 'poids_lourd',
          make: active?.make,
          model: active?.model,
          year: active?.year,
          currency: active?.currency,
        });
        setParts(res.data ?? []);
        setLabel(res.stubLabel);
        setSelectedId(null);
      } catch (e) {
        setParts([]);
        setLabel(e instanceof Error ? `Pièces soft — ${e.message}` : 'Pièces soft — mock');
      }
    })();
  }, [active?.vin, active?.vehicleClass, active?.make, active?.model, active?.year, active?.currency]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.oemSku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [parts, query]);

  const selected = parts.find((p) => p.id === selectedId) ?? null;

  return (
    <>
      <Stack.Screen options={{ title: t('moduleTitles.pieces') }} />
      <Screen
        variant="stack"
        title={t('moduleTitles.pieces')}
        subtitle={
          active?.make
            ? `${active.make} ${active.model ?? ''} · VIN ${active.vin ?? '—'}`.trim()
            : t('moduleTitles.piecesSub')
        }
      >
        <BackendStatusBanner />
        {label ? <StubBanner text={label} /> : null}

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={22} color={colors.ink} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher une pièce…"
            placeholderTextColor={colors.muted}
            style={styles.search}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            accessibilityLabel="Rechercher une pièce"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Effacer la recherche">
              <Ionicons name="close-circle" size={22} color={colors.slate} />
            </Pressable>
          ) : null}
        </View>

        {!active?.vin ? (
          <Text style={styles.warn}>Activez un véhicule (M1/M2) pour la liste compatible.</Text>
        ) : null}

        {filtered.length === 0 ? (
          <Text style={styles.empty}>
            {query.trim() ? `Aucune pièce pour « ${query.trim()} ».` : 'Aucune pièce pour ce VIN.'}
          </Text>
        ) : (
          <View style={styles.grid}>
            {filtered.map((p) => (
              <CatalogProductCard
                key={p.id}
                title={p.name}
                priceLine={formatPrice(p.priceAftermarket, p.currency)}
                icon={CAT_ICON[p.category]}
                photoTone={CAT_TONE[p.category]}
                selected={selectedId === p.id}
                onPress={() => setSelectedId((cur) => (cur === p.id ? null : p.id))}
              />
            ))}
          </View>
        )}

        {selected ? (
          <View style={styles.detail}>
            <Text style={styles.detailName}>{selected.name}</Text>
            <Text style={styles.detailPrice}>
              {formatPrice(selected.priceAftermarket, selected.currency)}
            </Text>
            {(selected.buyUrls?.length
              ? selected.buyUrls
              : selected.buyUrlStub
                ? [{ label: 'Acheter', url: selected.buyUrlStub }]
                : []
            ).map((b) => (
              <Pressable
                key={b.label}
                style={styles.buyBtn}
                onPress={() => void Linking.openURL(b.url)}
                accessibilityRole="link"
              >
                <Text style={styles.buyTxt}>{b.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  search: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    padding: 0,
    minHeight: 28,
  },
  warn: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 22,
  },
  empty: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  detail: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  detailName: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.ink,
    lineHeight: 28,
  },
  detailPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.signal,
  },
  buyBtn: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buyTxt: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 17,
  },
});
