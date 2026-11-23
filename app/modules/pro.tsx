import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import {
  cancelAppointment,
  createAppointment,
  listAppointmentsForGarage,
  submitGarageRating,
  updateAppointment,
} from '../../src/services/firebase';
import type { AppointmentDoc } from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

const STATUS_FLOW: AppointmentDoc['status'][] = [
  'requested',
  'confirmed',
  'in_shop',
  'done',
  'cancelled',
];

const STATUS_LABEL: Record<AppointmentDoc['status'], string> = {
  requested: 'Demandé',
  confirmed: 'Confirmé',
  in_shop: 'En baie',
  done: 'Terminé',
  cancelled: 'Annulé',
};

type RatingRow = { id: string; stars: 1 | 2 | 3 | 4 | 5; comment: string; client: string };

/** Module 17a — espace Pro atelier : dashboard, RDV CRUD, pièces, notations. */
export default function ProScreen() {
  useModuleVisit(17);
  const { profile } = useAuth();
  const garageId = profile?.uid ?? 'garage-pro-1';
  const [appts, setAppts] = useState<AppointmentDoc[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const [clientName, setClientName] = useState('');
  const [vehicleLabel, setVehicleLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ratings, setRatings] = useState<RatingRow[]>([
    { id: 'r1', stars: 5, comment: 'Rapide et transparent sur le devis.', client: 'Nadia P.' },
    { id: 'r2', stars: 4, comment: 'Bon suivi OR, pièces à l’heure.', client: 'Karim B.' },
  ]);
  const [rateStars, setRateStars] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [rateComment, setRateComment] = useState('');
  const [view, setView] = useState<'jour' | 'semaine'>('jour');

  const reload = useCallback(async () => {
    const res = await listAppointmentsForGarage(garageId);
    setAppts(res.data);
    setLabel(res.stubLabel);
  }, [garageId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const dashboard = useMemo(() => {
    const active = appts.filter((a) => a.status !== 'cancelled' && a.status !== 'done');
    const ca = appts
      .filter((a) => a.status === 'done' || a.status === 'in_shop' || a.status === 'confirmed')
      .reduce((s, a) => s + (a.estimatedTotal ?? 0), 0);
    const inShop = appts.filter((a) => a.status === 'in_shop').length;
    return { charge: active.length, inShop, ca, currency: appts[0]?.currency ?? 'EUR' };
  }, [appts]);

  const addRdv = async () => {
    if (!clientName.trim() || !vehicleLabel.trim()) {
      setMsg('Client et véhicule obligatoires pour créer un RDV.');
      return;
    }
    const res = await createAppointment({
      garageOwnerUid: garageId,
      clientName: clientName.trim(),
      vehicleLabel: vehicleLabel.trim(),
      status: 'requested',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      estimatedTotal: 180,
      currency: 'EUR',
      notes: notes.trim() || undefined,
    });
    setMsg(res.stubLabel ?? `RDV créé pour ${res.data.clientName}`);
    setClientName('');
    setVehicleLabel('');
    setNotes('');
    await reload();
  };

  const cycleStatus = async (a: AppointmentDoc) => {
    const i = STATUS_FLOW.indexOf(a.status);
    const next = STATUS_FLOW[(i + 1) % STATUS_FLOW.length];
    const res = await updateAppointment(a.id, { status: next });
    setMsg(res.stubLabel ?? `Statut → ${STATUS_LABEL[next]}`);
    await reload();
  };

  const onCancel = async (id: string) => {
    const res = await cancelAppointment(id);
    setMsg(res.stubLabel ?? 'RDV annulé');
    await reload();
  };

  const addRating = async () => {
    const comment = rateComment.trim() || 'Sans commentaire';
    const res = await submitGarageRating({
      garageId,
      authorUid: profile?.uid ?? 'client-demo',
      stars: rateStars,
      comment,
    });
    setRatings((prev) => [
      {
        id: res.data.id,
        stars: res.data.stars,
        comment: res.data.comment ?? comment,
        client: profile?.displayName ?? 'Client démo',
      },
      ...prev,
    ]);
    setRateComment('');
    setMsg(res.stubLabel ?? 'Avis enregistré (local / mock)');
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Espace Pro' }} />
      <Screen title="Pro garagistes" subtitle="Module 17 — atelier · RDV · pièces · notes">
        <BackendStatusBanner />
        {label ? <StubBanner text={label} /> : null}

        <Card title="Tableau de bord atelier">
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiVal}>{dashboard.charge}</Text>
              <Text style={styles.kpiLbl}>Charge active</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiVal}>{dashboard.inShop}</Text>
              <Text style={styles.kpiLbl}>En baie</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiVal}>
                {dashboard.ca}
                <Text style={styles.kpiCur}> {dashboard.currency}</Text>
              </Text>
              <Text style={styles.kpiLbl}>CA du jour (mock)</Text>
            </View>
          </View>
          <View style={styles.viewRow}>
            {(['jour', 'semaine'] as const).map((v) => (
              <Pressable key={v} style={[styles.chip, view === v && styles.chipOn]} onPress={() => setView(v)}>
                <Text style={[styles.chipTxt, view === v && styles.chipTxtOn]}>Vue {v}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.meta}>
            Créneaux · affectation mécanicien · durée estimée — structure locale (push/SMS à brancher).
          </Text>
        </Card>

        <Card title="Créer un rendez-vous">
          <TextInput
            value={clientName}
            onChangeText={setClientName}
            placeholder="Nom client"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <TextInput
            value={vehicleLabel}
            onChangeText={setVehicleLabel}
            placeholder="Véhicule (ex. Clio V · VIN)"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes / OR (vidange, freins…)"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable style={styles.btn} onPress={() => void addRdv()}>
            <Text style={styles.btnTxt}>Ajouter RDV</Text>
          </Pressable>
        </Card>

        <Card title={`Agenda RDV (${view}) — CRUD local`}>
          <Text style={styles.meta}>Touchez le statut pour le faire défiler · Annuler séparé.</Text>
          {appts.length === 0 ? <Text style={styles.meta}>Aucun RDV.</Text> : null}
          {appts.map((j) => (
            <View key={j.id} style={styles.row}>
              <Pressable style={{ flex: 1 }} onPress={() => void cycleStatus(j)}>
                <Text style={styles.name}>{j.clientName}</Text>
                <Text style={styles.meta}>
                  {j.vehicleLabel} · {new Date(j.scheduledAt).toLocaleString('fr-FR')}
                </Text>
                {j.notes ? <Text style={styles.meta}>{j.notes}</Text> : null}
                <Text style={styles.status}>{STATUS_LABEL[j.status]}</Text>
              </Pressable>
              <View style={styles.rowActions}>
                <Text style={styles.total}>
                  {j.estimatedTotal ?? '—'} {j.currency ?? ''}
                </Text>
                {j.status !== 'cancelled' ? (
                  <Pressable onPress={() => void onCancel(j.id)}>
                    <Text style={styles.cancel}>Annuler</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </Card>

        <Card title="Commande pièces (Module 3)">
          <Text style={styles.meta}>
            Depuis l’atelier : catalogue VIN du client → meilleur prix / stock / délai, rattachement devis / OR.
          </Text>
          <Link href="/modules/pieces" asChild>
            <Pressable style={styles.btnDark}>
              <Text style={styles.btnTxt}>Ouvrir catalogue pièces →</Text>
            </Pressable>
          </Link>
          <Link href="/modules/entretien" asChild>
            <Pressable style={styles.linkSoft}>
              <Text style={styles.linkSoftTxt}>Historique carnet véhicule (M10) →</Text>
            </Pressable>
          </Link>
        </Card>

        <Card title="Notation garage (clients)">
          <Text style={styles.meta}>
            Après intervention : note + commentaire. Anti-fraude basique (visite vérifiée). Modération Super-admin.
          </Text>
          <View style={styles.starsRow}>
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <Pressable key={n} onPress={() => setRateStars(n)} style={styles.starBtn}>
                <Text style={[styles.star, n <= rateStars && styles.starOn]}>{n <= rateStars ? '★' : '☆'}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={rateComment}
            onChangeText={setRateComment}
            placeholder="Commentaire client…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable style={styles.btn} onPress={() => void addRating()}>
            <Text style={styles.btnTxt}>Publier un avis (démo)</Text>
          </Pressable>
          {ratings.map((r) => (
            <View key={r.id} style={styles.rateRow}>
              <Text style={styles.name}>
                {'★'.repeat(r.stars)}
                {'☆'.repeat(5 - r.stars)} · {r.client}
              </Text>
              <Text style={styles.meta}>{r.comment}</Text>
            </View>
          ))}
        </Card>

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}

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
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: {
    flex: 1,
    backgroundColor: colors.mist,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  kpiVal: { fontWeight: '900', fontSize: 18, color: colors.ink },
  kpiCur: { fontSize: 11, fontWeight: '700', color: colors.muted },
  kpiLbl: { fontSize: 10, color: colors.muted, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  viewRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.mist,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { fontWeight: '700', color: colors.slate, fontSize: 12 },
  chipTxtOn: { color: colors.white },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
    marginTop: 6,
  },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  btnDark: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: colors.white, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 8,
  },
  name: { fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  status: { marginTop: 4, color: colors.signal, fontWeight: '800', fontSize: 11, textTransform: 'uppercase' },
  total: { fontWeight: '800', color: colors.signal, textAlign: 'right' },
  rowActions: { alignItems: 'flex-end', gap: 6 },
  cancel: { color: colors.danger, fontWeight: '700', fontSize: 12 },
  linkSoft: { paddingVertical: 10 },
  linkSoftTxt: { color: colors.signal, fontWeight: '700' },
  starsRow: { flexDirection: 'row', gap: 4, marginVertical: 6 },
  starBtn: { padding: 4 },
  star: { fontSize: 22, color: colors.muted },
  starOn: { color: colors.warn },
  rateRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  msg: { color: colors.garage, fontWeight: '700', marginTop: 4 },
  admin: { backgroundColor: colors.asphalt, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  adminTxt: { color: colors.white, fontWeight: '800' },
});
