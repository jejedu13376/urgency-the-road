import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme/colors';

const PREFS_KEY = 'um.parametres.prefs.v1';
const NOTIF_KEY = 'um.parametres.notif.v1';

type Prefs = {
  metricUnits: boolean;
  darkChrome: boolean;
  showWeather: boolean;
};

type Notifs = {
  entretien: boolean;
  sos: boolean;
  fil: boolean;
  marketing: boolean;
};

const DEFAULT_PREFS: Prefs = {
  metricUnits: true,
  darkChrome: false,
  showWeather: true,
};

const DEFAULT_NOTIFS: Notifs = {
  entretien: true,
  sos: true,
  fil: false,
  marketing: false,
};

/**
 * Hub Paramètres — préférences / notifications locales + liens Compte (M15) / Bases (M14).
 * Ne compte pas comme un module du parcours 17.
 */
export default function ParametresHub() {
  const { profile } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [notifs, setNotifs] = useState<Notifs>(DEFAULT_NOTIFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [pRaw, nRaw] = await Promise.all([
          AsyncStorage.getItem(PREFS_KEY),
          AsyncStorage.getItem(NOTIF_KEY),
        ]);
        if (cancelled) return;
        if (pRaw) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(pRaw) as Prefs) });
        if (nRaw) setNotifs({ ...DEFAULT_NOTIFS, ...(JSON.parse(nRaw) as Notifs) });
      } catch {
        /* mock local — ignore corrupt */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patchPrefs = useCallback(async (patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      void AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const patchNotifs = useCallback(async (patch: Partial<Notifs>) => {
    setNotifs((prev) => {
      const next = { ...prev, ...patch };
      void AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Paramètres' }} />
      <Screen title="Paramètres" subtitle="Préférences · notifications · compte">
        <StubBanner text="MOCK local — préférences / notifications AsyncStorage (pas de push distant)" />

        <Card title="Compte">
          <Text style={styles.meta}>
            {profile?.email
              ? `Connecté : ${profile.email}`
              : 'Non connecté — ouvrez Compte pour auth / abonnements.'}
          </Text>
          <Link href="/modules/compte" asChild>
            <Pressable style={styles.linkRow}>
              <Text style={styles.id}>M15</Text>
              <Text style={styles.linkTxt}>Compte & abonnements →</Text>
            </Pressable>
          </Link>
          <Link href="/modules/bases" asChild>
            <Pressable style={styles.linkRow}>
              <Text style={styles.id}>M14</Text>
              <Text style={styles.linkTxt}>Bases auto-évolutives (OTA) →</Text>
            </Pressable>
          </Link>
        </Card>

        <Card title="Préférences">
          {!ready ? (
            <Text style={styles.meta}>Chargement…</Text>
          ) : (
            <>
              <ToggleRow
                label="Unités métriques (km / L)"
                value={prefs.metricUnits}
                onChange={(v) => void patchPrefs({ metricUnits: v })}
              />
              <ToggleRow
                label="Chrome sombre (aperçu local)"
                value={prefs.darkChrome}
                onChange={(v) => void patchPrefs({ darkChrome: v })}
              />
              <ToggleRow
                label="Bandeau météo au démarrage"
                value={prefs.showWeather}
                onChange={(v) => void patchPrefs({ showWeather: v })}
              />
            </>
          )}
        </Card>

        <Card title="Notifications">
          {!ready ? (
            <Text style={styles.meta}>Chargement…</Text>
          ) : (
            <>
              <ToggleRow
                label="Rappels entretien / admin"
                value={notifs.entretien}
                onChange={(v) => void patchNotifs({ entretien: v })}
              />
              <ToggleRow
                label="Alertes SOS / urgence"
                value={notifs.sos}
                onChange={(v) => void patchNotifs({ sos: v })}
              />
              <ToggleRow
                label="Activité Fil mécanique"
                value={notifs.fil}
                onChange={(v) => void patchNotifs({ fil: v })}
              />
              <ToggleRow
                label="Offres & marketing"
                value={notifs.marketing}
                onChange={(v) => void patchNotifs({ marketing: v })}
              />
              <Text style={styles.hint}>
                Réglages stockés sur l’appareil — aucun serveur de push branché.
              </Text>
            </>
          )}
        </Card>
      </Screen>
    </>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.line, true: colors.signalSoft }}
        thumbColor={value ? colors.signal : colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 12 },
  hint: { color: colors.muted, fontSize: 11, marginTop: 4 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  id: {
    backgroundColor: colors.asphalt,
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  linkTxt: { color: colors.signal, fontWeight: '800', fontSize: 13, flex: 1 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 12,
  },
  toggleLabel: { color: colors.ink, fontWeight: '600', fontSize: 13, flex: 1 },
});
