import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useFleet } from '../../src/context/FleetContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import {
  listLearnedFailures,
  recordLearnedFailure,
  type LearnedFailure,
} from '../../src/services/firebase/learnedFailuresService';
import { checkOtaChannel, type OtaProbe } from '../../src/services/ota/checkOtaChannel';
import { colors } from '../../src/theme/colors';

/** Module 14 — learnedFailures Firestore owner-only + OTA probe honnête. */
export default function BasesScreen() {
  useModuleVisit(14);
  const { profile } = useAuth();
  const { active } = useFleet();
  const [log, setLog] = useState<LearnedFailure[]>([]);
  const [label, setLabel] = useState<string | undefined>();
  const [draft, setDraft] = useState('');
  const [partsDraft, setPartsDraft] = useState('');
  const [ota, setOta] = useState<OtaProbe | null>(null);
  const [otaStatus, setOtaStatus] = useState<'idle' | 'checking' | 'done'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await listLearnedFailures(30);
      setLog(res.data ?? []);
      setLabel(
        res.stubLabel ?? (res.source === 'firebase' ? 'Bases Firestore LIVE (owner)' : undefined),
      );
    } catch (e) {
      setLog([]);
      setLabel(e instanceof Error ? `Bases soft — ${e.message}` : 'Bases soft — mock');
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(t);
  }, [reload, profile?.uid]);

  const addLearned = async () => {
    const title = draft.trim();
    if (!title) return;
    const parts = partsDraft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await recordLearnedFailure({
      summary: title,
      likelyParts: parts,
      make: active?.make,
      model: active?.model,
    });
    setMsg(
      res.ok === false
        ? res.stubLabel ?? 'Écriture refusée'
        : res.source === 'firebase'
          ? 'Enregistré Firestore (owner-only, sans VIN)'
          : res.stubLabel ?? 'Local uniquement — connectez-vous pour sync',
    );
    setDraft('');
    setPartsDraft('');
    await reload();
  };

  const runOta = () => {
    setOtaStatus('checking');
    void checkOtaChannel().then((r) => {
      setOta(r);
      setOtaStatus('done');
      setMsg(r.label);
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Bases & OTA' }} />
      <Screen
        variant="stack" title="Bases évolutives" subtitle="Module 14 — auto-apprentissage & OTA">
        <StubBanner
          text={
            label ??
            'Apprentissage owner-only Firestore si Auth · OTA EAS sondé sans faux « à jour »'
          }
        />

        <Card title="Statut OTA">
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Mise à jour automatique</Text>
            <Text
              style={[
                styles.badge,
                otaStatus === 'done' && !ota?.available && styles.badgeWarn,
                otaStatus === 'checking' && styles.badgeWarn,
                ota?.available && styles.badgeOk,
              ]}
            >
              {otaStatus === 'idle' && 'Non vérifié'}
              {otaStatus === 'checking' && 'Vérif…'}
              {otaStatus === 'done' && (ota?.available ? 'Update dispo' : 'Canal absent / à jour')}
            </Text>
          </View>
          <Text style={styles.meta}>
            Sonde expo-updates / EAS si présents — jamais de « sync réussie » inventée.
          </Text>
          {ota ? (
            <View style={styles.syncBox}>
              <Text style={styles.meta}>Canal : {ota.channel ?? '—'}</Text>
              <Text style={styles.meta}>Runtime : {ota.runtimeVersion ?? '—'}</Text>
              <Text style={styles.meta}>{ota.label}</Text>
            </View>
          ) : null}
          <Pressable style={styles.btn} onPress={runOta} disabled={otaStatus === 'checking'}>
            <Text style={styles.btnTxt}>
              {otaStatus === 'checking' ? 'Vérification…' : 'Vérifier canal OTA'}
            </Text>
          </Pressable>
        </Card>

        <Card title="Journal d’auto-apprentissage">
          <Text style={styles.meta}>
            Pannes résolues — écriture Firestore owner-only quand connecté (pas de VIN stocké). Hors Auth =
            journal local AsyncStorage (persistant sur l’appareil).
          </Text>
          <Text style={styles.meta}>Compte : {profile?.email ?? 'non connecté'}</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Résumé panne apprise…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <TextInput
            value={partsDraft}
            onChangeText={setPartsDraft}
            placeholder="Pièces probables (virgules)…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable style={styles.btnDark} onPress={() => void addLearned()}>
            <Text style={styles.btnTxt}>
              {profile?.uid ? 'Enregistrer (Firestore)' : 'Ajouter local (journal)'}
            </Text>
          </Pressable>
          {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          <Text style={styles.count}>{log.length} entrée(s)</Text>
          {log.map((l) => (
            <View key={l.id} style={styles.row}>
              <Text style={styles.title}>{l.summary}</Text>
              <Text style={styles.meta}>
                {[l.make, l.model].filter(Boolean).join(' ') || '—'} ·{' '}
                {l.likelyParts.join(', ') || 'pièces —'} ·{' '}
                {l.createdAt ? new Date(l.createdAt).toLocaleString('fr-FR') : '—'}
              </Text>
            </View>
          ))}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { fontWeight: '700', color: colors.ink },
  meta: { color: colors.muted, fontSize: 12 },
  msg: { color: colors.garage, fontWeight: '700', fontSize: 12, marginTop: 6 },
  count: { color: colors.slate, fontWeight: '700', fontSize: 12, marginTop: 8 },
  btn: { backgroundColor: colors.signal, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  btnDark: { backgroundColor: colors.asphalt, borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: colors.white, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
    marginTop: 8,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { fontWeight: '800', color: colors.ink },
  badge: {
    fontWeight: '800',
    fontSize: 11,
    color: colors.muted,
    backgroundColor: colors.mist,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  badgeWarn: { color: colors.warn, backgroundColor: colors.warnSoft },
  badgeOk: { color: colors.garage, backgroundColor: colors.garageSoft },
  syncBox: { marginTop: 8, gap: 4 },
});
