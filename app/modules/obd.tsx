import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useFleet } from '../../src/context/FleetContext';
import { MOCK_DTC } from '../../src/data/mocks';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
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
import { listObdHistory, readObdSnapshot } from '../../src/services/firebase';
import type { ObdProtocol, ObdReadingDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

const PROTOCOL_HELP: Record<ObdProtocol, string> = {
  OBD2: 'Voitures légères / pick-up — ISO 15765 / CAN (Amérique du Nord & monde).',
  EOBD: 'Norme européenne équivalente OBD2 (EU).',
  J1939: 'Poids lourds diesel — SAE J1939 / CAN 250k (SPN/FMI).',
  J1708: 'Poids lourds legacy — SAE J1708 / J1587.',
};

const SENSOR_META: Record<string, { label: string; unit: string; max: number }> = {
  rpm: { label: 'Régime', unit: 'tr/min', max: 4000 },
  ectC: { label: 'Temp. eau', unit: '°C', max: 120 },
  batV: { label: 'Batterie', unit: 'V', max: 15 },
  mapKpa: { label: 'MAP', unit: 'kPa', max: 100 },
};

const SEV_STYLE = {
  info: { bg: colors.mist, fg: colors.slate },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  critical: { bg: colors.signalSoft, fg: colors.danger },
} as const;

/** Module 5 — VIN → recommandation prise/valise (achat abonné) + BLE / DTC. */
export default function ObdScreen() {
  useModuleVisit(5);
  const { profile } = useAuth();
  const { active } = useFleet();
  const recommendation = useMemo(() => recommendValiseForVehicle(active), [active]);
  const isPl = active?.vehicleClass === 'poids_lourd' || recommendation?.connector.kind === 'j1939_9pin';
  const [protocol, setProtocol] = useState<ObdProtocol>(
    recommendation?.recommendedProtocol ?? (isPl ? 'J1939' : 'OBD2'),
  );
  const [reading, setReading] = useState<ObdReadingDoc | null>(null);
  const [history, setHistory] = useState<ObdReadingDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const [bleMsg, setBleMsg] = useState(bleStatusLabel());
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([]);
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);
  const [selectedDtc, setSelectedDtc] = useState<string | null>(null);
  const [boughtAck, setBoughtAck] = useState(false);
  const [liveBle, setLiveBle] = useState(false);
  const [busy, setBusy] = useState(false);
  const cap = getBleCapability();

  useEffect(() => {
    if (recommendation?.recommendedProtocol) {
      setProtocol(recommendation.recommendedProtocol);
    }
  }, [recommendation?.recommendedProtocol, active?.id]);

  useEffect(() => {
    const activeSession = getActiveBleSession();
    if (activeSession) {
      setConnectedId(activeSession.deviceId);
      setLiveBle(true);
      setProtocol(activeSession.protocol);
    }
  }, []);

  const guideFor = useMemo(() => new Map(MOCK_DTC.map((d) => [d.code, d])), []);

  const onRead = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Prefer live ELM327/J1939 BLE session when connected to real hardware
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
          const warn =
            live.parseWarnings.length > 0 ? ` · ${live.parseWarnings.length} PID manquant(s)` : '';
          setLabel(`LIVE BLE ELM327/J1939 · ${live.rawLog.length} trames${warn}`);
          setCleared(false);
          setSelectedDtc(live.dtcCodes[0]?.code ?? null);
          return;
        }
        // Do NOT fall through to mock/Firestore DTCs while a live session banner is shown.
        setLabel('Lecture BLE live échouée — session ELM toujours ouverte, réessayez (pas de fallback mock).');
        setBleMsg('Live read null — aucun DTC mock affiché pendant session ELM.');
        return;
      }

      const ownerUid = profile?.uid ?? 'mock-local-user';
      const vehicleId = active?.id ?? 'unknown';
      const res = await readObdSnapshot(ownerUid, vehicleId, protocol);
      if (res.ok === false) {
        // Soft-fail / permission — do not hydrate mock DTCs as a successful read.
        setReading(null);
        setSelectedDtc(null);
        setHistory([]);
        setLabel(res.stubLabel ?? 'Lecture OBD refusée (soft-fail)');
        setCleared(false);
      } else {
        setReading(res.data);
        setLabel(
          res.stubLabel ??
            (res.source === 'firebase'
              ? 'Lecture enregistrée Firestore'
              : !profile
                ? 'OBD local — connexion requise pour historique live'
                : undefined),
        );
        setCleared(false);
        setSelectedDtc(res.data.dtcCodes[0]?.code ?? null);
        const hist = await listObdHistory(vehicleId, profile?.uid);
        setHistory(hist.ok === false ? [] : hist.data);
        if (hist.ok === false && hist.stubLabel) {
          setLabel((cur) => [cur, hist.stubLabel].filter(Boolean).join(' · '));
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const onBleScan = async () => {
    if (busy) return;
    if (liveBle) {
      setBleMsg('Session ELM live ouverte — déconnectez avant un nouveau scan.');
      return;
    }
    setBusy(true);
    try {
      const r = await scanBleDevices();
      if (!r.ok && r.message.includes('Session ELM')) {
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
      setBleMsg(r.devices.length ? r.message : `${r.message} — appareils démo affichés pour UX locale.`);
    } finally {
      setBusy(false);
    }
  };

  const onConnect = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      if (id.startsWith('mock-')) {
        // Tear down any live GATT session before switching to mock UI.
        await disconnectBleSession();
        const r = await connectBleDevice(id);
        setBleMsg(r.message);
        setConnectedId(id);
        setLiveBle(false);
        return;
      }
      // Live path: connect + AT init with selected protocol (OBD2/EOBD/J1939).
      // On failed switch with restore, r.ok + r.deviceId keep UI on the prior live session.
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
      setBleMsg('Session BLE fermée.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Valise OBD' }} />
      <Screen
        variant="stack"
        title="Diagnostic OBD / PL"
        subtitle={`Module 5 — Bluetooth / Wi-Fi / USB${active ? ` · ${active.make} ${active.model}` : ''}`}
      >
        <BackendStatusBanner />
        <StubBanner
          text={
            label ??
            bleMsg ??
            'Après VIN : l’app recommande la prise + la valise — l’abonné achète (pas fourni par l’éditeur).'
          }
        />

        <Card title="Onboarding — prise & valise (via VIN)">
          {!active ? (
            <>
              <Text style={styles.hint}>
                Saisissez d’abord un VIN (Mon véhicule) pour obtenir la recommandation de connecteur et
                de boîtier.
              </Text>
              <Link href="/(tabs)/mon-vehicule" asChild>
                <Pressable style={styles.linkCta}>
                  <Text style={styles.btnTxt}>Décoder un VIN (M1) →</Text>
                </Pressable>
              </Link>
            </>
          ) : recommendation ? (
            <>
              <Text style={styles.section}>
                {recommendation.vehicleLabel}
                {recommendation.vin ? ` · VIN …${recommendation.vin.slice(-8)}` : ''}
              </Text>
              <Text style={styles.meta}>{recommendation.valise.why}</Text>

              <View style={styles.recoBox}>
                <Text style={styles.recoLabel}>Prise / connecteur</Text>
                <Text style={styles.recoTitle}>{recommendation.connector.label}</Text>
                <Text style={styles.meta}>
                  {recommendation.connector.pins} · {recommendation.connector.locationHint}
                </Text>
              </View>

              <View style={styles.recoBox}>
                <Text style={styles.recoLabel}>Type de valise à acheter</Text>
                <Text style={styles.recoTitle}>{recommendation.valise.skuLabel}</Text>
                <Text style={styles.meta}>
                  {recommendation.valise.type} · {recommendation.valise.interfaces.join(' / ')} ·
                  protocole conseillé : {recommendation.recommendedProtocol}
                </Text>
              </View>

              <Text style={styles.disclaimer}>{recommendation.disclaimer}</Text>

              <Pressable
                style={styles.buyBtn}
                onPress={() => {
                  void Linking.openURL(recommendation.buyUrl);
                  setBoughtAck(true);
                }}
              >
                <Text style={styles.btnTxt}>Acheter ce boîtier (abonné) →</Text>
              </Pressable>
              <Text style={styles.meta}>Recherche : {recommendation.buySearchQuery}</Text>
              {boughtAck ? (
                <Text style={styles.ok}>
                  Lien d’achat ouvert — une fois le boîtier reçu, connectez-le en BLE ci-dessous.
                </Text>
              ) : null}
            </>
          ) : null}
        </Card>

        <Card title="Bluetooth (BLE) — ELM327 / J1939">
          <Text style={styles.meta}>{cap.available ? 'BLE natif prêt' : `Expo Go / web : ${cap.reason}`}</Text>
          <Text style={styles.meta}>{cap.pathToLive}</Text>
          <Pressable
            style={[styles.btn, (busy || liveBle) && styles.btnDisabled]}
            disabled={busy || liveBle}
            onPress={() => void onBleScan()}
          >
            <Text style={styles.btnTxt}>{liveBle ? 'Scan bloqué (session live)' : 'Scanner appareils OBD'}</Text>
          </Pressable>
          {devices.map((d) => {
            const on = connectedId === d.id;
            return (
              <View key={d.id} style={[styles.deviceRow, on && styles.deviceOn]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceName}>{d.name}</Text>
                  <Text style={styles.meta}>{d.id}</Text>
                </View>
                <Pressable style={styles.connectBtn} disabled={busy} onPress={() => void onConnect(d.id)}>
                  <Text style={styles.btnTxt}>{on ? 'Connecté' : 'Connecter'}</Text>
                </Pressable>
              </View>
            );
          })}
          {connectedId ? (
            <>
              <Text style={styles.ok}>
                Lien actif : {connectedId}
                {liveBle ? ' · session ELM live' : ' · mock UI'}
              </Text>
              <Pressable
                style={[styles.clear, busy && styles.btnDisabled]}
                disabled={busy}
                onPress={() => void onDisconnect()}
              >
                <Text style={styles.btnTxt}>Déconnecter valise</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.hint}>
              Scannez puis connectez une valise ELM327/J1939 (Dev Client) — ou mock pour UX locale.
            </Text>
          )}
        </Card>

        <Card title="Protocole">
          <Text style={styles.hint}>
            Support voitures (OBD2 / EOBD) et poids lourds (J1939 / J1708).
            {isPl ? ' Véhicule actif = PL — J1939 recommandé.' : ''}
          </Text>
          <View style={styles.row}>
            {(['OBD2', 'EOBD', 'J1939', 'J1708'] as ObdProtocol[]).map((p) => (
              <Pressable key={p} style={[styles.chip, protocol === p && styles.chipOn]} onPress={() => setProtocol(p)}>
                <Text style={[styles.chipTxt, protocol === p && styles.chipTxtOn]}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.meta}>{PROTOCOL_HELP[protocol]}</Text>
          <Pressable
            style={[styles.btn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void onRead()}
          >
            <Text style={styles.btnTxt}>{busy ? 'Lecture…' : 'Lire snapshot DTC + capteurs'}</Text>
          </Pressable>
        </Card>

        {reading ? (
          <>
            <Card title={`Codes défauts DTC (${reading.source})`}>
              <Text style={styles.meta}>
                Enregistré {new Date(reading.recordedAt).toLocaleString('fr-FR')} · connecté=
                {reading.connected ? 'oui' : 'non (mock)'}
              </Text>
              {reading.dtcCodes.map((d) => {
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
                      <Text style={[styles.sevBadge, { color: SEV_STYLE[sev].fg }]}>{d.severity}</Text>
                    </View>
                    <Text style={styles.plain}>{d.plainLanguage}</Text>
                    {open && guide ? (
                      <View style={styles.guideBox}>
                        <Text style={styles.section}>Guide de réparation</Text>
                        {guide.repairGuide.map((step, i) => (
                          <Text key={step} style={styles.meta}>
                            {i + 1}. {step}
                          </Text>
                        ))}
                        <Link href="/modules/pieces" asChild>
                          <Pressable style={styles.linkCta}>
                            <Text style={styles.btnTxt}>Pièces liées au DTC (M3) →</Text>
                          </Pressable>
                        </Link>
                        <Link href="/modules/diagnostic-ia" asChild>
                          <Pressable style={styles.linkSoft}>
                            <Text style={styles.linkSoftTxt}>Diagnostic IA photo (M4) →</Text>
                          </Pressable>
                        </Link>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
              <Pressable style={styles.clear} onPress={() => setCleared(true)}>
                <Text style={styles.btnTxt}>{cleared ? 'Voyants mock effacés' : 'Effacer voyants (stub sans valise)'}</Text>
              </Pressable>
            </Card>

            <Card title="Capteurs temps réel">
              <View style={styles.sensorGrid}>
                {Object.entries(reading.sensors).map(([k, v]) => {
                  const meta = SENSOR_META[k] ?? { label: k, unit: '', max: 100 };
                  const missing = v === '—' || v === null || v === undefined || v === '';
                  const num = typeof v === 'number' ? v : missing ? NaN : Number(v);
                  const pct = Number.isFinite(num) ? Math.min(100, Math.round((num / meta.max) * 100)) : 0;
                  return (
                    <View key={k} style={styles.sensorCard}>
                      <Text style={styles.sensorLabel}>{meta.label}</Text>
                      <Text style={styles.sensorVal}>
                        {missing || !Number.isFinite(num)
                          ? '—'
                          : `${num}${meta.unit ? ` ${meta.unit}` : ''}`}
                      </Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </>
        ) : null}

        {history.length > 0 ? (
          <Card title={`Historique lectures (${history.length})`}>
            {history.slice(0, 5).map((h) => (
              <Text key={h.id} style={styles.meta}>
                · {h.protocol} · {h.dtcCodes.length} DTC · {new Date(h.recordedAt).toLocaleString('fr-FR')}
              </Text>
            ))}
          </Card>
        ) : null}

        <Card title="Suite vendeur">
          <Link href="/modules/pieces" asChild>
            <Pressable style={styles.linkCta}>
              <Text style={styles.btnTxt}>Liste d’achats VIN après DTC (M3) →</Text>
            </Pressable>
          </Link>
          <Link href="/modules/tutoriels" asChild>
            <Pressable style={styles.linkSoft}>
              <Text style={styles.linkSoftTxt}>Tutoriels réparation (M11) →</Text>
            </Pressable>
          </Link>
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.mist },
  chipOn: { backgroundColor: colors.asphalt },
  chipTxt: { fontWeight: '700', color: colors.slate, fontSize: 12 },
  chipTxtOn: { color: colors.white },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.55 },
  btnTxt: { color: colors.white, fontWeight: '800', fontSize: 13 },
  dtc: { borderRadius: 10, padding: 10, gap: 4 },
  dtcHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontWeight: '900', fontSize: 15 },
  sevBadge: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  plain: { color: colors.slate },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  ok: { color: colors.garage, fontWeight: '700', fontSize: 12, marginTop: 6 },
  section: { fontWeight: '800', color: colors.ink, fontSize: 13 },
  clear: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  deviceOn: { backgroundColor: colors.garageSoft, marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 8 },
  deviceName: { fontWeight: '800', color: colors.ink },
  connectBtn: { backgroundColor: colors.asphalt, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  guideBox: { gap: 4, marginTop: 6 },
  linkCta: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 6 },
  linkSoft: {
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 6,
  },
  linkSoftTxt: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  sensorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sensorCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sensorLabel: { fontSize: 11, fontWeight: '700', color: colors.slate },
  sensorVal: { fontWeight: '900', fontSize: 18, color: colors.ink },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.signal },
  recoBox: {
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
    gap: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  recoLabel: { fontSize: 11, fontWeight: '800', color: colors.signal, textTransform: 'uppercase' },
  recoTitle: { fontWeight: '800', color: colors.ink, fontSize: 14 },
  disclaimer: { color: colors.muted, fontSize: 11, fontStyle: 'italic', marginTop: 8, lineHeight: 16 },
  buyBtn: {
    backgroundColor: colors.garage,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
});
