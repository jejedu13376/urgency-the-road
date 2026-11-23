import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import type { PartDoc, QuoteDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

const CAT_LABEL: Record<PartDoc['category'], string> = {
  mecanique: 'Mécanique',
  electrique: 'Électrique',
  carrosserie: 'Carrosserie',
  fluide: 'Fluide / huile',
  filtre: 'Filtre',
};

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
  const [funnelStep, setFunnelStep] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    void (async () => {
      const res = await listPartsForVin(active?.vin);
      setParts(res.data);
      setLabel(res.stubLabel);
      setSelectedId(res.data[0]?.id ?? null);
      setFunnelStep(res.data.length ? 1 : 0);
    })();
  }, [active?.vin]);

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
          {parts.length === 0 ? <Text style={styles.hint}>Aucune pièce mock pour ce VIN.</Text> : null}
          {parts.map((p) => {
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
          <Card title={`Tunnel — ${selected.name}`}>
            <Text style={styles.hint}>
              Meilleur prix mock : {bestBuy} {selected.currency} (comparateur neuf / OEM / adaptable).
            </Text>
            <Pressable
              style={styles.cta}
              onPress={() => setFunnelStep(1)}
            >
              <Text style={styles.ctaTxt}>
                1. Où acheter au meilleur prix
                {selected.buyUrlStub ? ` · ${selected.buyUrlStub}` : ' · catalogue mock'}
              </Text>
            </Pressable>
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
                <Text style={styles.hint}>Pas de paiement simulé — stub catalogue uniquement.</Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card title="Scanner devis garage (anti-arnaque)">
          <Text style={styles.hint}>Photo / PDF d’un devis → comparaison mock vs marché local.</Text>
          <Pressable
            style={styles.scan}
            onPress={() =>
              void scanQuoteStub(profile?.uid ?? 'mock-local-user').then((r) => {
                setScanQuote(r.data.quote);
                setScanLabel(r.data.scanLabel);
              })
            }
          >
            <Text style={styles.scanTxt}>Scanner un devis (service stub)</Text>
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
  devisBox: { backgroundColor: colors.garageSoft, borderRadius: 10, padding: 10, gap: 4 },
  devisTitle: { fontWeight: '800', color: colors.garage },
  scan: { backgroundColor: colors.asphalt, borderRadius: 12, padding: 14, alignItems: 'center' },
  scanTxt: { color: colors.white, fontWeight: '800' },
});
