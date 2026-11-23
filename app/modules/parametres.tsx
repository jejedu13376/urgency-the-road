import { useCallback, useEffect, useState } from 'react';
import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import {
  DEFAULT_LOCAL_NOTIFS,
  DEFAULT_LOCAL_PREFS,
  loadLocalNotifs,
  loadLocalPrefs,
  saveLocalNotifs,
  saveLocalPrefs,
  type LocalNotifs,
  type LocalPrefs,
} from '../../src/services/prefs/localPrefs';
import { colors } from '../../src/theme/colors';

/**
 * Hub Paramètres — préférences / notifications locales + liens Compte (M15) / Bases (M14).
 * Ne compte pas comme un module du parcours 17.
 */
export default function ParametresHub() {
  const { profile } = useAuth();
  const [prefs, setPrefs] = useState<LocalPrefs>(DEFAULT_LOCAL_PREFS);
  const [notifs, setNotifs] = useState<LocalNotifs>(DEFAULT_LOCAL_NOTIFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [p, n] = await Promise.all([loadLocalPrefs(), loadLocalNotifs()]);
        if (cancelled) return;
        setPrefs(p);
        setNotifs(n);
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

  const patchPrefs = useCallback(async (patch: Partial<LocalPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      void saveLocalPrefs(next);
      return next;
    });
  }, []);

  const patchNotifs = useCallback(async (patch: Partial<LocalNotifs>) => {
    setNotifs((prev) => {
      const next = { ...prev, ...patch };
      void saveLocalNotifs(next);
      return next;
    });
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'Paramètres' }} />
      <Screen
        variant="stack"
        title="Paramètres"
        subtitle="Préférences · notifications · compte"
      >
        <StubBanner text="MOCK local — préférences / notifications AsyncStorage (pas de push distant)" />

        <Card title="Compte">
          <Text style={styles.meta}>
            {profile?.email
              ? `Connecté : ${profile.email}`
              : 'Non connecté — ouvrez Compte pour auth / abonnements.'}
          </Text>
          <Link href="/modules/compte" asChild>
            <Pressable
              style={styles.linkRow}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir Compte et abonnements"
            >
              <Text style={styles.id}>M15</Text>
              <Text style={styles.linkTxt}>Compte & abonnements →</Text>
            </Pressable>
          </Link>
          <Link href="/modules/bases" asChild>
            <Pressable
              style={styles.linkRow}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir Bases auto-évolutives"
            >
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
                label="Chrome sombre (stocké — thème pas encore branché)"
                value={prefs.darkChrome}
                onChange={(v) => void patchPrefs({ darkChrome: v })}
              />
              <ToggleRow
                label="Bandeau météo (onglets)"
                value={prefs.showWeather}
                onChange={(v) => void patchPrefs({ showWeather: v })}
              />
              <Text style={styles.hint}>
                « Bandeau météo » masque le chip sur les onglets. Sur /modules/* le bandeau est
                déjà masqué pour ne pas chevaucher le header Stack.
              </Text>
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
        accessibilityLabel={label}
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
