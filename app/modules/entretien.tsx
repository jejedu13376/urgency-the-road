import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { CatalogProductCard } from '../../src/components/CatalogProductCard';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useFleet } from '../../src/context/FleetContext';
import { useI18n } from '../../src/context/I18nContext';
import { MOCK_MAINTENANCE } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { loadCarnet, saveCarnet } from '../../src/services/carnet/carnetStorage';
import {
  shareCarnetHtmlLite,
  shareCarnetPdf,
  shareCarnetText,
} from '../../src/services/carnet/exportCarnet';
import type { MaintenanceItem } from '../../src/types/modules';
import { colors } from '../../src/theme/colors';
import { FadeInBlock, PressScale } from '../../src/theme/motion';

type CarnetEntry = {
  id: string;
  title: string;
  km: number;
  dateIso: string;
  cost?: number;
  currency?: string;
  invoiceRef?: string;
};

const STATUS_CYCLE: MaintenanceItem['status'][] = ['a_faire', 'planifie', 'fait'];

function nextStatus(s: MaintenanceItem['status']): MaintenanceItem['status'] {
  const i = STATUS_CYCLE.indexOf(s);
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
}

function statusLabel(s: MaintenanceItem['status']): string {
  if (s === 'fait') return 'Fait';
  if (s === 'planifie') return 'Planifié';
  return 'À faire';
}

/** Sentinel dueKm used for date-only admin jobs (assurance, etc.). */
const DATE_ONLY_KM = 900_000;

/** Local calendar YYYY-MM-DD — avoid UTC `toISOString()` day shifts. */
function localDateIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function maintScheduleLine(m: MaintenanceItem): string {
  if (m.dueDateIso && m.dueKm >= DATE_ONLY_KM) return m.dueDateIso;
  const kmBit = `${m.dueKm.toLocaleString('fr-FR')} km`;
  return m.dueDateIso ? `${kmBit} · ${m.dueDateIso}` : kmBit;
}

function maintOverdue(m: MaintenanceItem, odometerKm: number, todayIso: string): boolean {
  if (m.status === 'fait') return false;
  if (m.dueDateIso && m.dueDateIso <= todayIso) return true;
  if (m.dueKm < DATE_ONLY_KM && m.dueKm <= odometerKm) return true;
  return false;
}

function maintIcon(title: string): 'water-outline' | 'car-sport-outline' | 'document-text-outline' | 'shield-checkmark-outline' | 'construct-outline' {
  const t = title.toLowerCase();
  if (t.includes('vidange') || t.includes('huile') || t.includes('filtre')) return 'water-outline';
  if (t.includes('pneu') || t.includes('frein')) return 'car-sport-outline';
  if (t.includes('assurance') || t.includes('contrôle') || t.includes('inspection')) {
    return 'shield-checkmark-outline';
  }
  if (t.includes('distribution') || t.includes('chaîne') || t.includes('chaine')) return 'construct-outline';
  return 'document-text-outline';
}

function maintTone(status: MaintenanceItem['status']): string {
  if (status === 'fait') return colors.garageSoft;
  if (status === 'planifie') return colors.warnSoft;
  return colors.signalSoft;
}

const DEFAULT_ITEMS: MaintenanceItem[] = [
  ...MOCK_MAINTENANCE,
  { id: 'm5', title: 'Distribution / chaîne', dueKm: 120000, status: 'planifie' },
  { id: 'm6', title: 'Pneus (usure / pression)', dueKm: 75000, status: 'a_faire' },
];

const INITIAL_CARNET: CarnetEntry[] = [
  {
    id: 'c1',
    title: 'Vidange + filtre huile',
    km: 62000,
    dateIso: '2026-06-12',
    cost: 189,
    currency: 'EUR',
    invoiceRef: 'FAC-2606-014',
  },
  {
    id: 'c2',
    title: 'Pneus avant (2×)',
    km: 64800,
    dateIso: '2026-09-03',
    cost: 220,
    currency: 'EUR',
    invoiceRef: 'FAC-2609-088',
  },
];

/** Module 10 — fiches entretien type catalogue : photo + nom + info clé. */
export default function EntretienScreen() {
  const { t } = useI18n();
  useModuleVisit(10);
  const { active } = useFleet();
  const km = active?.odometerKm ?? 0;
  const vehicleKey = active?.id ?? active?.vin ?? 'default';
  const [items, setItems] = useState<MaintenanceItem[]>(DEFAULT_ITEMS);
  const [carnet, setCarnet] = useState<CarnetEntry[]>(INITIAL_CARNET);
  const [query, setQuery] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setHydrated(false);
      void (async () => {
        const stored = await loadCarnet(vehicleKey);
        if (cancelled) return;
        if (stored) {
          setCarnet(
            stored.entries.map((e, i) => ({
              id: `c-${vehicleKey}-${i}-${e.dateIso}`,
              title: e.title,
              km: e.km,
              dateIso: e.dateIso,
              cost: e.cost,
              currency: e.currency,
              invoiceRef: e.invoiceRef,
            })),
          );
          if (stored.maintenance?.length) setItems(stored.maintenance);
        } else {
          setCarnet(INITIAL_CARNET);
          setItems(DEFAULT_ITEMS);
        }
        setHydrated(true);
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [vehicleKey]);

  useEffect(() => {
    if (!hydrated) return;
    void saveCarnet({
      vehicleKey,
      entries: carnet,
      maintenance: items,
      updatedAt: new Date().toISOString(),
    });
  }, [carnet, items, vehicleKey, hydrated]);

  const vehicleTitle = active
    ? `${active.make ?? ''} ${active.model ?? ''}`.trim() || active.label
    : 'Aucun véhicule';

  const vehicleKeyInfo = active
    ? `${km.toLocaleString('fr-FR')} km · ${active.year ?? '—'} · ${active.currency ?? ''}`
    : 'Activez un véhicule (M2)';

  const filteredMaint = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => m.title.toLowerCase().includes(q));
  }, [items, query]);

  const filteredCarnet = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return carnet;
    return carnet.filter((e) => e.title.toLowerCase().includes(q));
  }, [carnet, query]);

  const cycleItem = (id: string) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status: nextStatus(x.status) } : x)));

  const addCarnet = () => {
    const title = newTitle.trim();
    if (!title) return;
    setCarnet((prev) => [
      {
        id: `c-${Date.now()}`,
        title,
        km,
        dateIso: localDateIso(),
        cost: undefined,
        currency: active?.currency ?? 'EUR',
      },
      ...prev,
    ]);
    setNewTitle('');
    // Clear search so the newly added row is visible immediately.
    setQuery('');
  };

  const exportPayload = () => ({
    vehicleLabel: active?.label ?? vehicleTitle,
    vin: active?.vin,
    odometerKm: km,
    entries: carnet,
    maintenanceDone: items.filter((i) => i.status === 'fait').map((i) => i.title),
  });

  const todayIso = localDateIso();

  return (
    <>
      <Stack.Screen options={{ title: t('moduleTitles.entretien') }} />
      <Screen
        variant="stack"
        title={t('moduleTitles.entretien')}
        subtitle={t('moduleTitles.entretienSub')}
      >
        <StubBanner text="Carnet persisté + texte/HTML-lite + PDF LIVE avec attestation locale (hash) · signature serveur = option externe" />

        <FadeInBlock style={styles.vehicleWrap}>
          <CatalogProductCard
            title={vehicleTitle}
            priceLine={vehicleKeyInfo}
            icon="car-outline"
            photoTone={colors.mist}
            fullWidth
            accessibilityLabel={`Fiche véhicule ${vehicleTitle}`}
          />
        </FadeInBlock>

        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un entretien…"
            placeholderTextColor={colors.muted}
            style={styles.search}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Rechercher un entretien"
          />
        </View>

        <Text style={styles.section}>Entretiens</Text>
        {filteredMaint.length === 0 ? (
          <Text style={styles.empty}>
            {query.trim() && items.length > 0
              ? `Aucun entretien pour « ${query.trim()} ».`
              : 'Aucun entretien.'}
          </Text>
        ) : (
          <FadeInBlock delayMs={50} style={styles.grid}>
            {filteredMaint.map((m) => {
              const overdue = maintOverdue(m, km, todayIso);
              // Always show status so tap-to-cycle has readable feedback; dépassé is additive.
              const keyLine = overdue
                ? `${maintScheduleLine(m)} · ${statusLabel(m.status)} · dépassé`
                : `${maintScheduleLine(m)} · ${statusLabel(m.status)}`;
              return (
                <CatalogProductCard
                  key={m.id}
                  title={m.title}
                  priceLine={keyLine}
                  icon={maintIcon(m.title)}
                  photoTone={maintTone(m.status)}
                  onPress={() => cycleItem(m.id)}
                  accessibilityLabel={`${m.title}, ${keyLine}`}
                />
              );
            })}
          </FadeInBlock>
        )}

        <Text style={styles.section}>Carnet</Text>
        <TextInput
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="Ajouter une intervention…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          accessibilityLabel="Ajouter une intervention"
        />
        <PressScale style={styles.btnDark} onPress={addCarnet} accessibilityRole="button">
          <Text style={styles.btnTxt}>Ajouter</Text>
        </PressScale>

        {filteredCarnet.length === 0 ? (
          <Text style={styles.empty}>
            {carnet.length === 0
              ? 'Carnet vide.'
              : query.trim()
                ? `Aucune entrée pour « ${query.trim()} ».`
                : 'Carnet vide.'}
          </Text>
        ) : (
          <View style={styles.grid}>
            {filteredCarnet.map((e) => (
              <CatalogProductCard
                key={e.id}
                title={e.title}
                priceLine={
                  e.cost != null
                    ? `${e.cost} ${e.currency ?? ''}`.trim()
                    : `${e.km.toLocaleString('fr-FR')} km`
                }
                icon="receipt-outline"
                photoTone={colors.garageSoft}
              />
            ))}
          </View>
        )}

        <Text style={styles.meta}>
          Historique réparations / factures — persisté AsyncStorage par véhicule (
          {items.filter((i) => i.status === 'fait').length} entretiens « fait »). PDF réel via
          expo-print + hash local — signature serveur = option externe.
        </Text>
        <PressScale
          style={styles.btnDark}
          onPress={() => void shareCarnetText(exportPayload()).then((r) => setPdfMsg(r.message))}
        >
          <Text style={styles.btnTxt}>Partager (texte)</Text>
        </PressScale>
        <PressScale
          style={styles.btnSignal}
          onPress={() => void shareCarnetHtmlLite(exportPayload()).then((r) => setPdfMsg(r.message))}
        >
          <Text style={styles.btnTxt}>Partager HTML</Text>
        </PressScale>
        <PressScale
          style={styles.btnGarage}
          onPress={() => void shareCarnetPdf(exportPayload()).then((r) => setPdfMsg(r.message))}
        >
          <Text style={styles.btnTxt}>PDF</Text>
        </PressScale>
        {pdfMsg ? <Text style={styles.pdfMsg}>{pdfMsg}</Text> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  vehicleWrap: {
    alignItems: 'stretch',
  },
  searchWrap: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  search: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    padding: 0,
    minHeight: 28,
  },
  section: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.ink,
    marginTop: 6,
    letterSpacing: 0.15,
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
  input: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  btnDark: {
    backgroundColor: colors.asphalt,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  btnSignal: {
    backgroundColor: colors.signal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  btnGarage: {
    backgroundColor: colors.garage,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  btnTxt: {
    color: colors.white,
    fontWeight: '900',
    fontSize: 17,
  },
  pdfMsg: {
    color: colors.warn,
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});
