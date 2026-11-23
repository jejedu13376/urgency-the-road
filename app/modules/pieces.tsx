import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useFleet } from '../../src/context/FleetContext';
import { useProgress } from '../../src/context/ProgressContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { listPartsForVin, scanQuoteStub } from '../../src/services/firebase';
import { OCR_ML_BLOCKED, OEM_CATALOGUE_BLOCKED } from '../../src/services/parts/vinPartsCatalog';
import type { PartDoc, QuoteDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

const CAT_LABEL: Record<PartDoc['category'], string> = {
  mecanique: 'Mécanique',
  electrique: 'Électrique',
  carrosserie: 'Carrosserie',
  fluide: 'Fluide / huile',
  filtre: 'Filtre',
};

const CAT_FILTERS: Array<PartDoc['category'] | 'all'> = [
  'all', 'mecanique', 'electrique', 'carrosserie', 'fluide', 'filtre',
];

type ScanMode = 'photo' | 'pdf';

/** Module 3 — liste VIN, catalogue, devis pose, tunnel vendeur. */
export default function PiecesScreen() {
  useModuleVisit(3);
  const { profile } = useAuth();
  const { active } = useFleet();
  const { xp } = useProgress();
  const [parts, setParts] = useState<PartDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanQuote, setScanQuote] = useState<QuoteDoc | null>(null);
  const [scanLabel, setScanLabel] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<PartDoc['category'] | 'all'>('all');
  const [scanMode, setScanMode] = useState<ScanMode>('photo');
  const [funnelStep, setFunnelStep] = useState<0 | 1 | 2 | 3>(0);
  const [manualPart, setManualPart] = useState('');
  const [manualLabor, setManualLabor] = useState('');

  useEffect(() => {
    void (async () => {
      const res = await listPartsForVin(active?.vin, {
        isHeavyTruck: active?.vehicleClass === 'poids_lourd',
        make: active?.make,
        model: active?.model,
        year: active?.year,
        currency: active?.currency,
      });
      setParts(res.data);
      setLabel(res.stubLabel);
      setSelectedId(res.data[0]?.id ?? null);
      setFunnelStep(res.data.length ? 1 : 0);
    })();
  }, [active?.vin, active?.vehicleClass, active?.make, active?.model, active?.year, active?.currency]);

  const filtered = useMemo(
    () => (catFilter === 'all' ? parts : parts.filter((p) => p.category === catFilter)),
    [parts, catFilter],
  );

  const selected = parts.find((p) => p.id === selectedId) ?? null;

  const totals = useMemo(() => {
    const pieces = parts.reduce((s, p) => s + p.priceAftermarket, 0);
    const pose = parts.reduce((s, p) => s + p.laborHours * p.laborRate, 0);
    return { pieces, pose, all: pieces + pose, currency: parts[0]?.currency ?? 'EUR' };
  }, [parts]);

  const bestBuy = selected
    ? Math.min(selected.priceNew, selected.priceOem, selected.priceAftermarket)
    : null;

  return (
    <>
      <Stack.Screen options={{ title: 'Pièces & devis' }} />
      <Screen
        title="Achats & devis"
        subtitle={`Module 3 · VIN ${active?.vin ?? '—'} · ${active?.make ?? ''} ${active?.model ?? ''}`}
      >
        <BackendStatusBanner />
        {label ? <StubBanner text={label} /> : null}
        <StubBanner text={`${OEM_CATALOGUE_BLOCKED} · ${OCR_ML_BLOCKED}`} />

        <Card title="Parcours vendeur (pièce → achat → réparation → devis)">
          <Text style={styles.hint}>
            Dès qu’une pièce est liée au VIN / diagnostic, enchaînez : meilleur prix → tutoriel réparation → devis
            approximatif. Progression active · {xp} XP.
          </Text>
          <View style={styles.funnelRow}>
            {(['Identifiée', 'Acheter', 'Réparer', 'Devis'] as const).map((labelStep, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4;
              const on = funnelStep >= i;
              return (
                <Pressable
                  key={labelStep}
                  style={[styles.funnelChip, on && styles.funnelChipOn]}
                  onPress={() => setFunnelStep(i as 0 | 1 | 2 | 3)}
                >
                  <Text style={[styles.funnelTxt, on && styles.funnelTxtOn]}>
                    {n}. {labelStep}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.linkCol}>
            <Link href="/modules/obd" asChild>
              <Pressable style={styles.linkSoft}>
                <Text style={styles.linkSoftTxt}>Capteur / OBD (M5) → identifier</Text>
              </Pressable>
            </Link>
            <Link href="/modules/diagnostic-ia" asChild>
              <Pressable style={styles.linkSoft}>
                <Text style={styles.linkSoftTxt}>Diagnostic photo IA (M4) →</Text>
              </Pressable>
            </Link>
            <Link href="/modules/tutoriels" asChild>
              <Pressable style={styles.linkSoft}>
                <Text style={styles.linkSoftTxt}>Tutoriels réparation (M11) →</Text>
              </Pressable>
            </Link>
          </View>
        </Card>

        <Card title="Liste automatique d’achats (VIN)">
          {!active?.vin ? (
            <Text style={styles.warn}>Aucun VIN actif — activez un véhicule (M1/M2) pour générer la liste compatible.</Text>
          ) : null}
          <View style={styles.funnelRow}>
            {CAT_FILTERS.map((c) => (
              <Pressable
                key={c}
                style={[styles.funnelChip, catFilter === c && styles.funnelChipOn]}
                onPress={() => setCatFilter(c)}
              >
                <Text style={[styles.funnelTxt, catFilter === c && styles.funnelTxtOn]}>
                  {c === 'all' ? 'Toutes' : CAT_LABEL[c]}
                </Text>
              </Pressable>
            ))}
          </View>
          {filtered.length === 0 ? <Text style={styles.hint}>Aucune pièce pour ce filtre / VIN.</Text> : null}
          {filtered.map((p) => {
            const pose = Math.round(p.laborHours * p.laborRate);
            const on = selectedId === p.id;
            return (
              <Pressable key={p.id} style={[styles.row, on && styles.rowOn]} onPress={() => { setSelectedId(p.id); setFunnelStep(1); }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.meta}>
                    {CAT_LABEL[p.category]} · OEM {p.oemSku} · {p.region}
                  </Text>
                  <Text style={styles.meta}>
                    Neuf {p.priceNew} · OEM {p.priceOem} · Adaptable {p.priceAftermarket} {p.currency}
                  </Text>
                  <Text style={styles.meta}>
                    Pose barème {p.laborHours} h × {p.laborRate} = {pose} {p.currency}
                  </Text>
                </View>
                <Text style={styles.price}>
                  {p.priceAftermarket}
                  {'\n'}
                  <Text style={styles.priceUnit}>{p.currency}</Text>
                </Text>
              </Pressable>
            );
          })}
          <Text style={styles.total}>
            Estimation panier : pièces {Math.round(totals.pieces)} + pose {Math.round(totals.pose)} ={' '}
            {Math.round(totals.all)} {totals.currency}
          </Text>
        </Card>

        {selected ? (
          <Card title={`Comparateur OEM / neuf / adaptable — ${selected.name}`}>
            <View style={styles.compareGrid}>
              {[
                { label: 'Neuf', price: selected.priceNew },
                { label: 'OEM', price: selected.priceOem },
                { label: 'Adaptable', price: selected.priceAftermarket },
              ].map((cell) => {
                const best = cell.price === bestBuy;
                return (
                  <View key={cell.label} style={[styles.compareCell, best && styles.compareCellBest]}>
                    <Text style={styles.compareLabel}>{cell.label}</Text>
                    <Text style={styles.comparePrice}>{cell.price} {selected.currency}</Text>
                    {best ? <Text style={styles.bestBadge}>MEILLEUR</Text> : null}
                  </View>
                );
              })}
            </View>
            <Text style={styles.meta}>
              Pose barème {selected.laborHours} h × {selected.laborRate} ={' '}
              {Math.round(selected.laborHours * selected.laborRate)} {selected.currency}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.min(100, Math.round((selected.laborHours / 3) * 100))}%` }]} />
            </View>

            <Text style={styles.hint}>
              Meilleur prix catalogue local : {bestBuy} {selected.currency} (neuf / OEM / adaptable — pas d’API OEM mondiale).
            </Text>
            <View style={styles.buyCol}>
              {(selected.buyUrls?.length
                ? selected.buyUrls
                : selected.buyUrlStub
                  ? [{ label: 'Recherche web', url: selected.buyUrlStub }]
                  : []
              ).map((b) => (
                <Pressable
                  key={b.label}
                  style={styles.cta}
                  onPress={() => {
                    setFunnelStep(1);
                    void Linking.openURL(b.url);
                  }}
                >
                  <Text style={styles.ctaTxt}>
                    1. {b.label}
                    {selected.oemSku ? ` · ${selected.oemSku}` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Link href="/modules/tutoriels" asChild>
              <Pressable style={styles.ctaAlt} onPress={() => setFunnelStep(2)}>
                <Text style={styles.ctaTxt}>2. Proposer la réparation (tutoriel M11) →</Text>
              </Pressable>
            </Link>
            <Pressable
              style={styles.ctaDark}
              onPress={() => setFunnelStep(3)}
            >
              <Text style={styles.ctaTxt}>
                3. Devis approx. pièce + pose :{' '}
                {Math.round(selected.priceAftermarket + selected.laborHours * selected.laborRate)}{' '}
                {selected.currency}
              </Text>
            </Pressable>
            {funnelStep >= 3 ? (
              <View style={styles.devisBox}>
                <Text style={styles.devisTitle}>Petit devis (indicatif)</Text>
                <Text style={styles.meta}>Pièce adaptable : {selected.priceAftermarket} {selected.currency}</Text>
                <Text style={styles.meta}>
                  Main-d’œuvre ({selected.laborHours} h) : {Math.round(selected.laborHours * selected.laborRate)}{' '}
                  {selected.currency}
                </Text>
                <Text style={styles.total}>
                  Total approx. :{' '}
                  {Math.round(selected.priceAftermarket + selected.laborHours * selected.laborRate)}{' '}
                  {selected.currency}
                </Text>
                <Text style={styles.hint}>Devis indicatif local — pas de paiement / checkout simulé.</Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card title="Scanner devis garage (anti-arnaque)">
          <Text style={styles.hint}>
            OCR ML non branché — saisissez les montants du devis garage, ou lancez l’heuristique marché vs pièce
            sélectionnée. Aucun « devis scanné avec succès » inventé.
          </Text>
          <View style={styles.funnelRow}>
            <Pressable style={[styles.funnelChip, scanMode === 'photo' && styles.funnelChipOn]} onPress={() => setScanMode('photo')}>
              <Text style={[styles.funnelTxt, scanMode === 'photo' && styles.funnelTxtOn]}>Mode photo</Text>
            </Pressable>
            <Pressable style={[styles.funnelChip, scanMode === 'pdf' && styles.funnelChipOn]} onPress={() => setScanMode('pdf')}>
              <Text style={[styles.funnelTxt, scanMode === 'pdf' && styles.funnelTxtOn]}>Mode PDF</Text>
            </Pressable>
          </View>
          <Text style={styles.meta}>Montants saisis (pièce + main-d’œuvre du devis garage)</Text>
          <View style={styles.funnelRow}>
            <TextInput
              value={manualPart}
              onChangeText={setManualPart}
              keyboardType="decimal-pad"
              placeholder={`Pièce (${active?.currency ?? 'EUR'})`}
              placeholderTextColor={colors.muted}
              style={styles.manualInput}
            />
            <TextInput
              value={manualLabor}
              onChangeText={setManualLabor}
              keyboardType="decimal-pad"
              placeholder={`MO (${active?.currency ?? 'EUR'})`}
              placeholderTextColor={colors.muted}
              style={styles.manualInput}
            />
          </View>
          <Pressable
            style={styles.scan}
            onPress={() => {
              const partRaw = manualPart.trim();
              const laborRaw = manualLabor.trim();
              const partN = partRaw ? parseFloat(partRaw.replace(',', '.')) : NaN;
              const laborN = laborRaw ? parseFloat(laborRaw.replace(',', '.')) : NaN;
              const partOk = Number.isFinite(partN);
              const laborOk = Number.isFinite(laborN);
              // Either field typed → manual path; missing side defaults to 0
              const hasManual = partOk || laborOk;
              void scanQuoteStub({
                ownerUid: profile?.uid,
                vin: active?.vin,
                make: active?.make,
                model: active?.model,
                mode: scanMode,
                anchorOemSku: selected?.oemSku,
                currency: active?.currency ?? selected?.currency,
                manualPartPrice: hasManual ? (partOk ? partN : 0) : undefined,
                manualLaborPrice: hasManual ? (laborOk ? laborN : 0) : undefined,
              }).then((r) => {
                setScanQuote(r.data.quote);
                setScanLabel(
                  `${r.data.scanLabel ?? 'Scan'} · ${scanMode}${
                    hasManual ? ' · saisie manuelle' : ' · heuristique'
                  }${!profile ? ' · local (connectez-vous pour sync)' : ''}`,
                );
              });
            }}
          >
            <Text style={styles.scanTxt}>
              Comparer au marché
              {active?.make ? ` · ${active.make}` : ''}
              {manualPart.trim() || manualLabor.trim() ? ' (montants saisis)' : ' (heuristique)'}
            </Text>
          </Pressable>
          {scanLabel ? <StubBanner text={scanLabel} /> : null}
          {scanQuote ? (
            <View style={styles.devisBox}>
              <Text style={styles.devisTitle}>
                Risque de surfacturation : {scanQuote.overchargeRisk?.toUpperCase() ?? '—'}
              </Text>
              {scanQuote.lines.map((line, idx) => (
                <Text key={`${line.label}-${idx}`} style={styles.meta}>
                  · {line.label} — pièce {line.partPrice} + MO {line.laborPrice} {scanQuote.currency}
                </Text>
              ))}
              <Text style={styles.total}>
                Total scanné :{' '}
                {scanQuote.lines.reduce((s, l) => s + l.partPrice + l.laborPrice, 0)} {scanQuote.currency}
              </Text>
            </View>
          ) : null}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  warn: { color: colors.danger, fontWeight: '700', fontSize: 12 },
  funnelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  funnelChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
  },
  funnelChipOn: { backgroundColor: colors.signalSoft, borderColor: colors.signal },
  funnelTxt: { fontSize: 11, fontWeight: '700', color: colors.slate },
  funnelTxtOn: { color: colors.signal },
  linkCol: { gap: 6 },
  linkSoft: {
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  linkSoftTxt: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowOn: { backgroundColor: colors.signalSoft, marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 8 },
  name: { fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  price: { fontWeight: '800', color: colors.signal, textAlign: 'right', fontSize: 16 },
  priceUnit: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  total: { marginTop: 8, fontWeight: '800', color: colors.garage },
  cta: { backgroundColor: colors.signal, borderRadius: 10, padding: 12 },
  ctaAlt: { backgroundColor: colors.garage, borderRadius: 10, padding: 12 },
  ctaDark: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12 },
  ctaTxt: { color: colors.white, fontWeight: '800', fontSize: 13 },
  buyCol: { gap: 6 },
  devisBox: { backgroundColor: colors.garageSoft, borderRadius: 10, padding: 10, gap: 4 },
  devisTitle: { fontWeight: '800', color: colors.garage },
  scan: { backgroundColor: colors.asphalt, borderRadius: 12, padding: 14, alignItems: 'center' },
  scanTxt: { color: colors.white, fontWeight: '800' },
  manualInput: {
    flexGrow: 1,
    minWidth: '40%',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.ink,
    backgroundColor: colors.mist,
  },
  compareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  compareCell: {
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: colors.mist,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  compareCellBest: { borderColor: colors.garage, backgroundColor: colors.garageSoft },
  compareLabel: { fontSize: 11, fontWeight: '700', color: colors.slate },
  comparePrice: { fontWeight: '800', color: colors.ink, fontSize: 14 },
  bestBadge: { fontSize: 10, fontWeight: '800', color: colors.garage, marginTop: 2 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden', marginTop: 6 },
  barFill: { height: 6, backgroundColor: colors.signal },
});
