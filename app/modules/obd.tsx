import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  connectBleDevice,
  getBleCapability,
  scanBleDevices,
} from '../../src/services/obd/bleScaffold';
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

/** Module 5 — OBD2 / J1939 + chemin BLE documenté (Expo Go limité). */
export default function ObdScreen() {
  useModuleVisit(5);
  const { profile } = useAuth();
  const { active } = useFleet();
  const isPl = active?.vehicleClass === 'poids_lourd';
  const [protocol, setProtocol] = useState<ObdProtocol>(isPl ? 'J1939' : 'OBD2');
  const [reading, setReading] = useState<ObdReadingDoc | null>(null);
  const [history, setHistory] = useState<ObdReadingDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const [bleMsg, setBleMsg] = useState(bleStatusLabel());
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([]);
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);
  const [selectedDtc, setSelectedDtc] = useState<string | null>(null);
  const cap = getBleCapability();

  const guideFor = useMemo(() => new Map(MOCK_DTC.map((d) => [d.code, d])), []);

  const onRead = async () => {
    const res = await readObdSnapshot(profile?.uid ?? 'mock-local-user', active?.id ?? 'unknown', protocol);
    setReading(res.data);
    setLabel(res.stubLabel ?? (res.source === 'firebase' ? 'Lecture enregistrée Firestore' : undefined));
    setCleared(false);
    setSelectedDtc(res.data.dtcCodes[0]?.code ?? null);
    const hist = await listObdHistory(active?.id ?? 'unknown');
    setHistory(hist.data);
  };

  const onBleScan = async () => {
    const r = await scanBleDevices();
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
  };

  const onConnect = async (id: string) => {
    const r = await connectBleDevice(id);
    setBleMsg(r.message);
    if (r.ok || id.startsWith('mock-')) {
      setConnectedId(id);
      if (id.startsWith('mock-')) setBleMsg(`Connecté (mock UI) à ${id} — lecture snapshot disponible.`);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Valise OBD' }} />
      <Screen
        title="Diagnostic OBD / PL"
        subtitle={`Module 5 — Bluetooth / Wi-Fi / USB${active ? ` · ${active.make} ${active.model}` : ''}`}
      >
        <BackendStatusBanner />
        <StubBanner text={label ?? bleMsg} />

        <Card title="Bluetooth (BLE)">
          <Text style={styles.meta}>{cap.available ? 'BLE natif prêt' : `Expo Go / web : ${cap.reason}`}</Text>
          <Text style={styles.meta}>{cap.pathToLive}</Text>
          <Pressable style={styles.btn} onPress={() => void onBleScan()}>
            <Text style={styles.btnTxt}>Scanner appareils OBD</Text>
          </Pressable>
          {devices.map((d) => {
            const on = connectedId === d.id;
            return (
              <View key={d.id} style={[styles.deviceRow, on && styles.deviceOn]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceName}>{d.name}</Text>
                  <Text style={styles.meta}>{d.id}</Text>
                </View>
                <Pressable style={styles.connectBtn} onPress={() => void onConnect(d.id)}>
                  <Text style={styles.btnTxt}>{on ? 'Connecté' : 'Connecter'}</Text>
                </Pressable>
              </View>
            );
          })}
          {connectedId ? <Text style={styles.ok}>Lien actif : {connectedId}</Text> : (
            <Text style={styles.hint}>Scannez puis connectez une valise (ou mock) avant lecture live.</Text>
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
          <Pressable style={styles.btn} onPress={() => void onRead()}>
            <Text style={styles.btnTxt}>Lire snapshot DTC + capteurs</Text>
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
                  const num = typeof v === 'number' ? v : Number(v) || 0;
                  const pct = Math.min(100, Math.round((num / meta.max) * 100));
                  return (
                    <View key={k} style={styles.sensorCard}>
                      <Text style={styles.sensorLabel}>{meta.label}</Text>
                      <Text style={styles.sensorVal}>
                        {v}
                        {meta.unit ? ` ${meta.unit}` : ''}
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
});
