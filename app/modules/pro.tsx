import { useEffect, useState } from 'react';
import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import { listAppointmentsForGarage } from '../../src/services/firebase';
import type { AppointmentDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

/** Module 17a — Pro garagistes + appointments service. */
export default function ProScreen() {
  useModuleVisit(17);
  const { profile } = useAuth();
  const [appts, setAppts] = useState<AppointmentDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      const res = await listAppointmentsForGarage(profile?.uid ?? 'garage-pro-1');
      setAppts(res.data);
      setLabel(res.stubLabel);
    })();
  }, [profile?.uid]);

  return (
    <>
      <Stack.Screen options={{ title: 'Espace Pro' }} />
      <Screen title="Pro garagistes" subtitle="Module 17 — atelier · RDV · clients">
        <BackendStatusBanner />
        {label ? <StubBanner text={label} /> : null}
        <Card title="Rendez-vous atelier">
          {appts.map((j) => (
            <View key={j.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{j.clientName}</Text>
                <Text style={styles.meta}>
                  {j.vehicleLabel} · {j.status} · {new Date(j.scheduledAt).toLocaleString('fr-FR')}
                </Text>
              </View>
              <Text style={styles.total}>
                {j.estimatedTotal ?? '—'} {j.currency ?? ''}
              </Text>
            </View>
          ))}
        </Card>
        <Card title="Actions Pro">
          <Text style={styles.line}>• Devis (collection quotes)</Text>
          <Text style={styles.line}>• Notes clients & historique</Text>
          <Text style={styles.line}>• Import pièces Module 3</Text>
        </Card>
        <Link href="/modules/admin" asChild>
          <Pressable style={styles.admin}>
            <Text style={styles.adminTxt}>Ouvrir panneau Super-admin →</Text>
          </Pressable>
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  name: { fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  total: { fontWeight: '800', color: colors.signal },
  line: { color: colors.slate },
  admin: { backgroundColor: colors.asphalt, borderRadius: 12, padding: 14, alignItems: 'center' },
  adminTxt: { color: colors.white, fontWeight: '800' },
});
