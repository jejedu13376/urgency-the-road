import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { adminKeys, loadJson, saveJson } from '../../src/services/admin/adminLocalStore';
import { colors } from '../../src/theme/colors';
import { useI18n } from '../../src/context/I18nContext';

type FlagKey =
  | 'multiIa'
  | 'obdLive'
  | 'stripe'
  | 'paypal'
  | 'appleGooglePay'
  | 'filVideo'
  | 'gpsPl'
  | 'rescuerScan'
  | 'otaAuto';

type ModItem = {
  id: string;
  kind: 'fil' | 'avis' | 'compte';
  title: string;
  detail: string;
  status: 'ouvert' | 'averti' | 'banni' | 'ok';
};

type AccountRow = {
  id: string;
  email: string;
  role: 'driver' | 'pro' | 'rescuer' | 'admin';
  plan: string;
  active: boolean;
};

const INITIAL_MOD: ModItem[] = [
  {
    id: 'm1',
    kind: 'fil',
    title: 'Signalement — vidéo hors sujet',
    detail: 'Post fp-882 · « pub off-topic »',
    status: 'ouvert',
  },
  {
    id: 'm2',
    kind: 'avis',
    title: 'Avis abusif garage',
    detail: '1★ sans RDV passé — anti-fraude',
    status: 'ouvert',
  },
  {
    id: 'm3',
    kind: 'compte',
    title: 'Pro en attente KYC',
    detail: 'Atelier Nord · docs incomplets',
    status: 'ouvert',
  },
];

const INITIAL_ACCOUNTS: AccountRow[] = [
  { id: 'u1', email: 'martin@ex.fr', role: 'driver', plan: 'Premium ($15/mo)', active: true },
  { id: 'u2', email: 'atelier@nord.fr', role: 'pro', plan: 'Premium ($15/mo)', active: true },
  { id: 'u3', email: 'sp59@secours.fr', role: 'rescuer', plan: 'Secours', active: true },
  { id: 'u4', email: 'demo@um.app', role: 'driver', plan: 'Premium ($15/mo)', active: false },
];

/** Module 17b — Super-admin : comptes, modération, analytics, feature flags. */
export default function AdminScreen() {
  const { t } = useI18n();
  useModuleVisit(17);
  const [flags, setFlags] = useState<Record<FlagKey, boolean>>({
    multiIa: false,
    obdLive: false,
    stripe: true,
    paypal: true,
    appleGooglePay: true,
    filVideo: true,
    gpsPl: true,
    rescuerScan: true,
    otaAuto: false,
  });
  const [mod, setMod] = useState(INITIAL_MOD);
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [filterRole, setFilterRole] = useState<'all' | AccountRow['role']>('all');
  const [hydrated, setHydrated] = useState(false);
  const [persistLabel, setPersistLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [f, m, a] = await Promise.all([
        loadJson<Record<FlagKey, boolean>>(adminKeys.flags),
        loadJson<ModItem[]>(adminKeys.mod),
        loadJson<AccountRow[]>(adminKeys.accounts),
      ]);
      if (cancelled) return;
      if (f) setFlags((prev) => ({ ...prev, ...f }));
      if (m?.length) setMod(m);
      if (a?.length) setAccounts(a);
      setPersistLabel(
        f || m || a
          ? 'Admin local restauré (AsyncStorage) — pas de KPI cloud'
          : 'Admin local vierge — éditions persistées on-device',
      );
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveJson(adminKeys.flags, flags);
  }, [flags, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void saveJson(adminKeys.mod, mod);
  }, [mod, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void saveJson(adminKeys.accounts, accounts);
  }, [accounts, hydrated]);

  const toggle = (k: FlagKey) => setFlags((f) => ({ ...f, [k]: !f[k] }));

  const cycleMod = (id: string) => {
    const order: ModItem['status'][] = ['ouvert', 'averti', 'banni', 'ok'];
    setMod((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const i = order.indexOf(m.status);
        return { ...m, status: order[(i + 1) % order.length] };
      }),
    );
  };

  const toggleAccount = (id: string) =>
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a)));

  const visibleAccounts =
    filterRole === 'all' ? accounts : accounts.filter((a) => a.role === filterRole);

  const openMod = mod.filter((m) => m.status === 'ouvert').length;

  return (
    <>
      <Stack.Screen options={{ title: t('moduleTitles.admin') }} />
      <Screen
        variant="stack" title={t('moduleTitles.admin')} subtitle={t('moduleTitles.adminSub')}>
        <StubBanner text="Admin UI locale persistée · KPI cloud / backend Pro non branchés" />
        {persistLabel ? <Text style={styles.meta}>{persistLabel}</Text> : null}

        <Card title="Analytics (local)">
          <View style={styles.kpiGrid}>
            <View style={styles.kpi}>
              <Text style={styles.kpiVal}>{accounts.filter((a) => a.active).length}</Text>
              <Text style={styles.kpiLbl}>Comptes actifs (local)</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiVal}>{accounts.length}</Text>
              <Text style={styles.kpiLbl}>Comptes listés</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiVal}>
                {Object.values(flags).filter(Boolean).length}/{Object.keys(flags).length}
              </Text>
              <Text style={styles.kpiLbl}>Flags ON</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiVal}>{openMod}</Text>
              <Text style={styles.kpiLbl}>Modération ouverte</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            Compteurs dérivés de l’UI locale persistée — pas de MAU / sessions cloud. Backend admin analytics =
            à brancher séparément.
          </Text>
        </Card>

        <Card title="Comptes (conducteurs / pro / secours)">
          <View style={styles.filterRow}>
            {(['all', 'driver', 'pro', 'rescuer', 'admin'] as const).map((r) => (
              <Pressable
                key={r}
                style={[styles.chip, filterRole === r && styles.chipOn]}
                onPress={() => setFilterRole(r)}
              >
                <Text style={[styles.chipTxt, filterRole === r && styles.chipTxtOn]}>
                  {r === 'all' ? 'Tous' : r}
                </Text>
              </Pressable>
            ))}
          </View>
          {visibleAccounts.map((a) => (
            <Pressable key={a.id} style={styles.row} onPress={() => toggleAccount(a.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{a.email}</Text>
                <Text style={styles.meta}>
                  {a.role} · {a.plan}
                </Text>
              </View>
              <Text style={[styles.badge, a.active ? styles.on : styles.off]}>
                {a.active ? 'ACTIF' : 'OFF'}
              </Text>
            </Pressable>
          ))}
        </Card>

        <Card title="File de modération (Fil M12 · avis · KYC)">
          <Text style={styles.meta}>Touchez pour faire défiler : ouvert → averti → banni → ok.</Text>
          {mod.map((m) => (
            <Pressable key={m.id} style={styles.row} onPress={() => cycleMod(m.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  [{m.kind}] {m.title}
                </Text>
                <Text style={styles.meta}>{m.detail}</Text>
              </View>
              <Text
                style={[
                  styles.badge,
                  m.status === 'ok' && styles.on,
                  m.status === 'ouvert' && styles.warn,
                  (m.status === 'averti' || m.status === 'banni') && styles.off,
                ]}
              >
                {m.status.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </Card>

        <Card title="Feature flags">
          {(Object.keys(flags) as FlagKey[]).map((k) => (
            <Pressable key={k} style={styles.flag} onPress={() => toggle(k)}>
              <Text style={styles.flagName}>{k}</Text>
              <Text style={[styles.flagVal, flags[k] ? styles.on : styles.off]}>
                {flags[k] ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
          ))}
        </Card>

        <Card title="Abonnements (supervision M15)">
          <Text style={styles.line}>• {t('subscription.adminLine')}</Text>
          <Text style={styles.line}>• Secours : abo actif obligatoire pour scan fiche (M13)</Text>
          <Text style={styles.line}>• Pro : KYC atelier avant réservation en ligne</Text>
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: {
    width: '47%',
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
  },
  kpiVal: { fontWeight: '900', fontSize: 18, color: colors.ink },
  kpiLbl: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.mist,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { fontWeight: '700', color: colors.slate, fontSize: 11 },
  chipTxtOn: { color: colors.white },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 8,
  },
  name: { fontWeight: '800', color: colors.ink, fontSize: 13 },
  badge: { fontWeight: '900', fontSize: 10 },
  line: { color: colors.slate, marginBottom: 4 },
  flag: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  flagName: { fontWeight: '700', color: colors.ink },
  flagVal: { fontWeight: '900', fontSize: 12 },
  on: { color: colors.garage },
  off: { color: colors.danger },
  warn: { color: colors.warn },
});
