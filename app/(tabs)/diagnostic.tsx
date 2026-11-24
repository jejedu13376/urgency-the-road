import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useFleet } from '../../src/context/FleetContext';
import { useI18n } from '../../src/context/I18nContext';
import { useProgress } from '../../src/context/ProgressContext';
import { MOCK_DTC } from '../../src/data/mocks';
import { listPartsForVin, readObdSnapshot } from '../../src/services/firebase';
import {
  bleStatusLabel,
  connectAndInitElm,
  connectBleDevice,
  disconnectBleSession,
  getActiveBleSession,
  getBleCapability,
  readLiveObdSnapshot,
  scanBleDevices,
} from '../../src/services/obd/bleScaffold';
import { recommendValiseForVehicle } from '../../src/services/obd/recommendValise';
import { colors } from '../../src/theme/colors';
import type { ObdProtocol, ObdReadingDoc, PartDoc } from '../../src/types/firestore';

const SEV_STYLE = {
  info: { bg: colors.mist, fg: colors.slate },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  critical: { bg: colors.signalSoft, fg: colors.danger },
} as const;

/**
 * Tab 2 — Diagnostic: plug OBD key, show results, parts-to-buy on THIS tab
 * (reuses OBD / pieces services; deep modules remain for full flows).
 */
export default function DiagnosticHub() {
  const { active } = useFleet();
  const { profile } = useAuth();
  const { xp, completionPct } = useProgress();
  const { t } = useI18n();

  const recommendation = useMemo(() => recommendValiseForVehicle(active), [active]);
  const isPl =
    active?.vehicleClass === 'poids_lourd' || recommendation?.connector.kind === 'j1939_9pin';
  const [protocol, setProtocol] = useState<ObdProtocol>(
    recommendation?.recommendedProtocol ?? (isPl ? 'J1939' : 'OBD2'),
  );
  const [reading, setReading] = useState<ObdReadingDoc | null>(null);
  const [label, setLabel] = useState<string | undefined>();
  const [bleMsg, setBleMsg] = useState(bleStatusLabel());
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([]);
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [liveBle, setLiveBle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedDtc, setSelectedDtc] = useState<string | null>(null);

  const [parts, setParts] = useState<PartDoc[]>([]);
  const [partsLabel, setPartsLabel] = useState<string | undefined>();
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  const cap = getBleCapability();
  const guideFor = useMemo(() => new Map(MOCK_DTC.map((d) => [d.code, d])), []);

  useEffect(() => {
    if (!recommendation?.recommendedProtocol) return;
    const tmr = setTimeout(() => setProtocol(recommendation.recommendedProtocol), 0);
    return () => clearTimeout(tmr);
  }, [recommendation?.recommendedProtocol, active?.id]);

  useEffect(() => {
    const tmr = setTimeout(() => {
      const activeSession = getActiveBleSession();
      if (activeSession) {
        setConnectedId(activeSession.deviceId);
        setLiveBle(true);
        setProtocol(activeSession.protocol);
      }
    }, 0);
    return () => clearTimeout(tmr);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await listPartsForVin(active?.vin, {
          isHeavyTruck: active?.vehicleClass === 'poids_lourd',
          make: active?.make,
          model: active?.model,
          year: active?.year,
          currency: active?.currency,
        });
        if (cancelled) return;
        setParts(res.data ?? []);
        setPartsLabel(res.stubLabel);
        setSelectedPartId(res.data?.[0]?.id ?? null);
      } catch (e) {
        if (cancelled) return;
        setParts([]);
        setPartsLabel(e instanceof Error ? e.message : t('diagnostic.partsSoftFail'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active?.vin, active?.vehicleClass, active?.make, active?.model, active?.year, active?.currency, t]);

  const selectedPart = parts.find((p) => p.id === selectedPartId) ?? null;
  const bestBuy = selectedPart
    ? Math.min(selectedPart.priceNew, selectedPart.priceOem, selectedPart.priceAftermarket)
    : null;

  const onBleScan = async () => {
    if (busy) return;
    // Re-check live session (may have been opened in M5 after this tab mounted).
    const activeSession = getActiveBleSession();
    if (activeSession || liveBle) {
      if (activeSession) {
        setConnectedId(activeSession.deviceId);
        setLiveBle(true);
        setProtocol(activeSession.protocol);
      }
      setBleMsg(t('diagnostic.bleBusy'));
      return;
    }
    setBusy(true);
    try {
      const r = await scanBleDevices();
      if (!r.ok && r.message.includes('Session ELM')) {
        setLiveBle(true);
        setBleMsg(r.message);
        return;
      }
      setDevices(
        r.devices.length
          ? r.devices
          : [
              { id: 'mock-elm327', name: 'ELM327 BT (mock)' },
              { id: 'mock-vgate', name: 'Vgate iCar Pro (mock)' },
              { id: 'mock-j1939', name: 'NEXIQ USB-Link PL (mock)' },
            ],
      );
      setBleMsg(
        r.devices.length
          ? r.message
          : `${r.message} — ${t('diagnostic.bleDemo')}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const onConnect = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      if (id.startsWith('mock-')) {
        // Never tear down a live ELM session to switch to mock UI.
        const activeSession = getActiveBleSession();
        if (activeSession && !activeSession.deviceId.startsWith('mock-')) {
          setConnectedId(activeSession.deviceId);
          setLiveBle(true);
          setProtocol(activeSession.protocol);
          setBleMsg(t('diagnostic.bleBusy'));
          return;
        }
        await disconnectBleSession();
        const r = await connectBleDevice(id);
        setBleMsg(r.message);
        setConnectedId(id);
        setLiveBle(false);
        return;
      }
      const r = await connectAndInitElm(id, protocol);
      setBleMsg(r.message);
      if (r.ok) {
        setConnectedId(r.deviceId ?? id);
        setLiveBle(true);
      } else {
        setConnectedId(null);
        setLiveBle(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await disconnectBleSession();
      setConnectedId(null);
      setLiveBle(false);
      setBleMsg(t('diagnostic.bleClosed'));
    } finally {
      setBusy(false);
    }
  };

  const onRead = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (liveBle && connectedId && !connectedId.startsWith('mock-')) {
        const live = await readLiveObdSnapshot(protocol);
        if (live) {
          const sensors: Record<string, number | string> = {};
          for (const [k, v] of Object.entries(live.sensors)) {
            sensors[k] = v === null ? '—' : v;
          }
          const mapped: ObdReadingDoc = {
            id: `ble-${Date.now()}`,
            ownerUid: profile?.uid ?? 'ble-local',
            vehicleId: active?.id ?? 'unknown',
            protocol: live.protocol,
            connected: true,
            recordedAt: new Date().toISOString(),
            source: 'live',
            dtcCodes: live.dtcCodes.map((d) => ({
              code: d.code,
              plainLanguage: d.plainLanguage,
              severity: d.severity,
            })),
            sensors,
          };
          setReading(mapped);
          setLabel(`LIVE BLE · ${live.rawLog.length} frames`);
          setSelectedDtc(live.dtcCodes[0]?.code ?? null);
          return;
        }
        setLabel(t('diagnostic.readLiveFail'));
        return;
      }

      const ownerUid = profile?.uid ?? 'mock-local-user';
      const vehicleId = active?.id ?? 'unknown';
      const res = await readObdSnapshot(ownerUid, vehicleId, protocol);
      if (res.ok === false) {
        setReading(null);
        setSelectedDtc(null);
        setLabel(res.stubLabel ?? t('diagnostic.readFail'));
      } else {
        setReading(res.data);
        setLabel(res.stubLabel ?? t('diagnostic.readOk'));
        setSelectedDtc(res.data.dtcCodes[0]?.code ?? null);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={t('diagnostic.title')}
      subtitle={`${t('diagnostic.subtitle')}${active ? ` · ${active.make} ${active.model}` : ''}`}
    >
      <BackendStatusBanner />
      <StubBanner text={label ?? bleMsg ?? t('diagnostic.stubHint')} />

      {/* Plug-in instructions */}
      <Card title={t('diagnostic.plugTitle')}>
        <Text style={styles.lead}>{t('diagnostic.plugLead')}</Text>
        <View style={styles.steps}>
          <Text style={styles.step}>{t('diagnostic.plugStep1')}</Text>
          <Text style={styles.step}>{t('diagnostic.plugStep2')}</Text>
          <Text style={styles.step}>{t('diagnostic.plugStep3')}</Text>
        </View>
        {!active ? (
          <>
            <Text style={styles.hint}>{t('diagnostic.needVehicle')}</Text>
            <Link href="/(tabs)/mon-vehicule" asChild>
              <Pressable style={styles.primary}>
                <Text style={styles.primaryTxt}>{t('diagnostic.goVehicle')}</Text>
              </Pressable>
            </Link>
          </>
        ) : recommendation ? (
          <View style={styles.recoBox}>
            <Text style={styles.recoLabel}>{t('diagnostic.connector')}</Text>
            <Text style={styles.recoTitle}>{recommendation.connector.label}</Text>
            <Text style={styles.hint}>
              {recommendation.connector.pins} · {recommendation.connector.locationHint}
            </Text>
            <Text style={styles.recoLabel}>{t('diagnostic.dongle')}</Text>
            <Text style={styles.recoTitle}>{recommendation.valise.skuLabel}</Text>
            <Text style={styles.hint}>{recommendation.valise.why}</Text>
          </View>
        ) : null}
        <Text style={styles.meta}>
          {t('diagnostic.parcoursMeta', { pct: completionPct, xp })}
        </Text>
      </Card>

      {/* BLE connect + read */}
      <Card title={t('diagnostic.connectTitle')}>
        <Text style={styles.hint}>
          {cap.available ? t('diagnostic.bleReady') : `${t('diagnostic.bleLimited')}: ${cap.reason}`}
        </Text>
        <View style={styles.row}>
          {(['OBD2', 'EOBD', 'J1939', 'J1708'] as ObdProtocol[]).map((p) => (
            <Pressable
              key={p}
              style={[styles.chip, protocol === p && styles.chipOn]}
              onPress={() => setProtocol(p)}
            >
              <Text style={[styles.chipTxt, protocol === p && styles.chipTxtOn]}>{p}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.primary, (busy || liveBle) && styles.disabled]}
          disabled={busy || liveBle}
          onPress={() => void onBleScan()}
        >
          <Text style={styles.primaryTxt}>
            {liveBle ? t('diagnostic.scanBlocked') : t('diagnostic.scanDevices')}
          </Text>
        </Pressable>
        {devices.map((d) => {
          const on = connectedId === d.id;
          return (
            <View key={d.id} style={[styles.deviceRow, on && styles.deviceOn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.deviceName}>{d.name}</Text>
                <Text style={styles.meta}>{d.id}</Text>
              </View>
              <Pressable
                style={styles.connectBtn}
                disabled={busy}
                onPress={() => void onConnect(d.id)}
              >
                <Text style={styles.primaryTxt}>
                  {on ? t('diagnostic.connected') : t('diagnostic.connect')}
                </Text>
              </Pressable>
            </View>
          );
        })}
        {connectedId ? (
          <Pressable
            style={[styles.secondary, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void onDisconnect()}
          >
            <Text style={styles.secondaryTxt}>{t('diagnostic.disconnect')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.primary, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void onRead()}
        >
          <Text style={styles.primaryTxt}>
            {busy ? t('diagnostic.reading') : t('diagnostic.readDtc')}
          </Text>
        </Pressable>
      </Card>

      {/* Results */}
      {reading ? (
        <Card title={t('diagnostic.resultsTitle')}>
          <Text style={styles.meta}>
            {new Date(reading.recordedAt).toLocaleString()} · {reading.protocol} ·{' '}
            {reading.source}
          </Text>
          {reading.dtcCodes.length === 0 ? (
            <Text style={styles.hint}>{t('diagnostic.noDtc')}</Text>
          ) : (
            reading.dtcCodes.map((d) => {
              const guide = guideFor.get(d.code);
              const sev =
                (d.severity as keyof typeof SEV_STYLE) in SEV_STYLE
                  ? (d.severity as keyof typeof SEV_STYLE)
                  : 'warn';
              const open = selectedDtc === d.code;
              return (
                <Pressable
                  key={d.code}
                  style={[styles.dtc, { backgroundColor: SEV_STYLE[sev].bg }]}
                  onPress={() => setSelectedDtc(open ? null : d.code)}
                >
                  <View style={styles.dtcHead}>
                    <Text style={[styles.code, { color: SEV_STYLE[sev].fg }]}>{d.code}</Text>
                    <Text style={[styles.sevBadge, { color: SEV_STYLE[sev].fg }]}>
                      {d.severity}
                    </Text>
                  </View>
                  <Text style={styles.plain}>{d.plainLanguage}</Text>
                  {open && guide ? (
                    <View style={styles.guideBox}>
                      {guide.repairGuide.map((step, i) => (
                        <Text key={step} style={styles.hint}>
                          {i + 1}. {step}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}
          {Object.keys(reading.sensors).length > 0 ? (
            <>
              <Text style={styles.section}>{t('diagnostic.sensors')}</Text>
              <View style={styles.sensorGrid}>
                {Object.entries(reading.sensors).map(([k, v]) => (
                  <View key={k} style={styles.sensorCard}>
                    <Text style={styles.sensorLabel}>{k}</Text>
                    <Text style={styles.sensorVal}>{String(v)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </Card>
      ) : null}

      {/* Parts to buy — same tab */}
      <Card title={t('diagnostic.partsTitle')}>
        <Text style={styles.lead}>{t('diagnostic.partsLead')}</Text>
        {partsLabel ? <Text style={styles.hint}>{partsLabel}</Text> : null}
        {!active?.vin ? (
          <Text style={styles.hint}>{t('diagnostic.partsNeedVin')}</Text>
        ) : null}
        {parts.length === 0 ? (
          <Text style={styles.hint}>{t('diagnostic.partsEmpty')}</Text>
        ) : (
          parts.slice(0, 8).map((p) => {
            const on = selectedPartId === p.id;
            return (
              <Pressable
                key={p.id}
                style={[styles.partRow, on && styles.partRowOn]}
                onPress={() => setSelectedPartId(p.id)}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.partName}>{p.name}</Text>
                  <Text style={styles.meta}>
                    {t(`diagnostic.cat.${p.category}`)} · OEM {p.oemSku}
                  </Text>
                  <Text style={styles.meta}>
                    {t('diagnostic.partsPrices', {
                      neu: p.priceNew,
                      oem: p.priceOem,
                      after: p.priceAftermarket,
                      cur: p.currency,
                    })}
                  </Text>
                </View>
                <Text style={styles.price}>
                  {p.priceAftermarket}
                  {'\n'}
                  <Text style={styles.priceUnit}>{p.currency}</Text>
                </Text>
              </Pressable>
            );
          })
        )}
        {selectedPart ? (
          <View style={styles.buyBox}>
            <Text style={styles.section}>
              {t('diagnostic.partsBuy', { name: selectedPart.name })}
            </Text>
            <Text style={styles.hint}>
              {t('diagnostic.partsBest', {
                price: bestBuy ?? selectedPart.priceAftermarket,
                cur: selectedPart.currency,
              })}
            </Text>
            {(selectedPart.buyUrls?.length
              ? selectedPart.buyUrls
              : selectedPart.buyUrlStub
                ? [{ label: t('diagnostic.partsWeb'), url: selectedPart.buyUrlStub }]
                : []
            ).map((b) => (
              <Pressable
                key={b.label}
                style={styles.buyBtn}
                onPress={() => void Linking.openURL(b.url)}
              >
                <Text style={styles.primaryTxt}>
                  {b.label}
                  {selectedPart.oemSku ? ` · ${selectedPart.oemSku}` : ''}
                </Text>
              </Pressable>
            ))}
            <Text style={styles.meta}>
              {t('diagnostic.partsLabor', {
                hours: selectedPart.laborHours,
                total: Math.round(
                  selectedPart.priceAftermarket +
                    selectedPart.laborHours * selectedPart.laborRate,
                ),
                cur: selectedPart.currency,
              })}
            </Text>
          </View>
        ) : null}
        <Link href="/modules/pieces" asChild>
          <Pressable style={styles.linkSoft}>
            <Text style={styles.linkSoftTxt}>{t('diagnostic.linkPiecesFull')}</Text>
          </Pressable>
        </Link>
      </Card>

      <Card title={t('diagnostic.moreTitle')}>
        <Link href="/modules/obd" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>{t('diagnostic.linkObdFull')}</Text>
          </Pressable>
        </Link>
        <Link href="/modules/diagnostic-ia" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>{t('diagnostic.linkIa')}</Text>
          </Pressable>
        </Link>
        <Link href="/modules/tutoriels" asChild>
          <Pressable style={styles.linkRow}>
            <Text style={styles.linkTxt}>{t('diagnostic.linkTutoriels')}</Text>
          </Pressable>
        </Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.slate, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 4 },
  steps: { gap: 8, marginTop: 4 },
  step: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.ink,
    backgroundColor: colors.mist,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.mist,
    borderWidth: 2,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { fontWeight: '800', color: colors.slate, fontSize: 14 },
  chipTxtOn: { color: colors.white },
  primary: {
    backgroundColor: colors.signal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 8,
  },
  primaryTxt: { color: colors.white, fontWeight: '800', fontSize: 16 },
  secondary: {
    backgroundColor: colors.mist,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.line,
    marginTop: 8,
  },
  secondaryTxt: { color: colors.slate, fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.55 },
  recoBox: {
    backgroundColor: colors.mist,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 8,
  },
  recoLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.signal,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  recoTitle: { fontWeight: '800', color: colors.ink, fontSize: 16, lineHeight: 22 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  deviceOn: {
    backgroundColor: colors.garageSoft,
    marginHorizontal: -6,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  deviceName: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  connectBtn: {
    backgroundColor: colors.asphalt,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dtc: { borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: colors.line },
  dtcHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontWeight: '900', fontSize: 18 },
  sevBadge: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  plain: { color: colors.slate, fontSize: 15, lineHeight: 22 },
  guideBox: { gap: 4, marginTop: 6 },
  section: { fontWeight: '800', color: colors.ink, fontSize: 16, marginTop: 10, marginBottom: 4 },
  sensorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sensorCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.mist,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sensorLabel: { fontSize: 12, fontWeight: '700', color: colors.slate },
  sensorVal: { fontWeight: '900', fontSize: 18, color: colors.ink },
  partRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    alignItems: 'flex-start',
  },
  partRowOn: { backgroundColor: colors.signalSoft, marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 8 },
  partName: { fontWeight: '800', color: colors.ink, fontSize: 16, lineHeight: 22 },
  price: { fontWeight: '900', color: colors.signal, fontSize: 18, textAlign: 'right' },
  priceUnit: { fontSize: 12, fontWeight: '700', color: colors.muted },
  buyBox: {
    marginTop: 10,
    backgroundColor: colors.garageSoft,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buyBtn: {
    backgroundColor: colors.garage,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  linkSoft: {
    backgroundColor: colors.mist,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 10,
  },
  linkSoftTxt: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  linkRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  linkTxt: { color: colors.signal, fontWeight: '800', fontSize: 15 },
});
