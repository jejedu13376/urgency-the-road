import { useEffect, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import {
  ensurePersonalQr,
  getOwnMedicalCard,
  scanMedicalEmergency,
  scanMedicalPublic,
  upsertMedicalCard,
} from '../../src/services/firebase';
import { getDeviceCoords, type DeviceCoords } from '../../src/services/geo/deviceLocation';
import type {
  MedicalCardDoc,
  MedicalEmergencyView,
  MedicalPublicPreview,
} from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

const FOUR_H = 4 * 60 * 60;

/**
 * Module 13 — SOS, pause 4h, personal printed QR per subscriber,
 * controlled access: public_limited vs emergency_full (name/address/contact/full fiche).
 * No electronic-beacon product; distinct from OBD valise + vehicle diagnostic hardware.
 */
export default function UrgenceScreen() {
  useModuleVisit(13);
  const { profile } = useAuth();
  const [seconds, setSeconds] = useState(0);
  const [pausedAlert, setPausedAlert] = useState(false);
  const [driving, setDriving] = useState(true);
  const [card, setCard] = useState<MedicalCardDoc | null>(null);
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [badgeId, setBadgeId] = useState(profile?.rescuerBadgeId ?? '');
  const [publicView, setPublicView] = useState<MedicalPublicPreview | null>(null);
  const [emergencyView, setEmergencyView] = useState<MedicalEmergencyView | null>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [sosMsg, setSosMsg] = useState<string | null>(null);
  const [gpsErr, setGpsErr] = useState<string | null>(null);
  const [label, setLabel] = useState<string | undefined>();
  const [coords, setCoords] = useState<DeviceCoords | null>(null);

  // Align with firestore.rules ownerIsActiveSubscriber — flag only, never plan name / !profile.
  const subscriberActive = profile?.subscriptionActive === true;

  useEffect(() => {
    if (!driving) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [driving]);

  useEffect(() => {
    if (seconds >= FOUR_H) setPausedAlert(true);
  }, [seconds]);

  useEffect(() => {
    // M13: never seed SOS UI with Lille fallback — device GPS only.
    void getDeviceCoords({ allowFallback: false }).then((r) => {
      if (r.ok && r.data?.source === 'device') setCoords(r.data);
      else setGpsErr(r.ok ? 'fallback interdit' : r.error);
    });
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const uid = profile?.uid ?? 'mock-local-user';
        const qr = await ensurePersonalQr(uid, subscriberActive);
        setLabel(qr.stubLabel);
        if (qr.ok === false) {
          // Do not hydrate demo PHI after a failed read / mint abort.
          return;
        }
        if (qr.data.card?.scanCode) {
          setCard(qr.data.card);
          setScanCode(qr.data.scanCode);
          hydrateForm(qr.data.card);
        } else {
          const res = await getOwnMedicalCard(uid);
          if (res.ok === false) {
            setLabel(res.stubLabel ?? qr.stubLabel);
            return;
          }
          setCard(res.data);
          setLabel(res.stubLabel ?? qr.stubLabel);
          if (res.data) {
            setScanCode(res.data.scanCode);
            hydrateForm(res.data);
          }
        }
      } catch (e) {
        setLabel(e instanceof Error ? `Urgence soft — ${e.message}` : 'Urgence soft — mock');
      }
    })();
  }, [profile?.uid, subscriberActive]);

  const hydrateForm = (c: MedicalCardDoc) => {
    setFullName(c.fullName);
    setAddress(c.address ?? '');
    setBloodType(c.bloodType ?? '');
    setAllergies(c.allergies.join(', '));
    setConditions(c.conditions.join(', '));
    setMedications(c.medications.join(', '));
    setContactName(c.emergencyContacts[0]?.name ?? '');
    setContactPhone(c.emergencyContacts[0]?.phone ?? '');
  };

  const saveCard = async () => {
    if (!profile?.uid) {
      setLabel('Connexion requise pour enregistrer la fiche médicale');
      return;
    }
    const uid = profile.uid;
    // Never derive from uid — empty → upsertMedicalCard mints opaque UM-QR-* (mintScanCode).
    const code = (card?.scanCode || scanCode || '').trim().toUpperCase();
    const payload: MedicalCardDoc = {
      id: `med-${uid}`,
      ownerUid: uid,
      scanCode: code,
      fullName: fullName.trim() || 'Utilisateur',
      address: address.trim(),
      allergies: allergies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      conditions: conditions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      medications: medications
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      emergencyContacts:
        contactName.trim() || contactPhone.trim()
          ? [{ name: contactName.trim() || 'Contact', phone: contactPhone.trim() }]
          : [],
      bloodType: bloodType.trim() || undefined,
      subscriberActive,
      updatedAt: new Date().toISOString(),
    };
    const res = await upsertMedicalCard(payload);
    setCard(res.data);
    setScanCode(res.data.scanCode);
    setSaveMsg(res.stubLabel ?? 'Fiche + QR personnel enregistrés');
    setLabel(res.stubLabel);
  };

  const onPublicScan = async () => {
    setEmergencyView(null);
    const res = await scanMedicalPublic(scanCode);
    setPublicView(res.data);
    setScanMsg(res.stubLabel ?? (res.data ? 'Vue publique limitée' : 'QR inconnu'));
  };

  const onEmergencyScan = async () => {
    setPublicView(null);
    // DEV soft-path: do not hard-block UI on missing KYC badge (no approve workflow).
    const softDev =
      (typeof __DEV__ !== 'undefined' && __DEV__) ||
      ['1', 'true', 'yes'].includes(
        (process.env.EXPO_PUBLIC_DEV_SOFT_AUTH ?? '').trim().toLowerCase(),
      );
    if (!badgeId.trim() && profile?.role === 'rescuer' && !softDev) {
      setScanMsg('KYC : badge / n° professionnel requis avant vue urgence complète.');
      return;
    }
    const rescuer =
      profile?.role === 'rescuer'
        ? { ...profile, rescuerBadgeId: badgeId || profile.rescuerBadgeId }
        : profile;
    const res = await scanMedicalEmergency(scanCode, rescuer ?? null);
    // ok:false demo can still carry flagged PHI for UX — never present as live.
    setEmergencyView(res.data);
    const demoFlag =
      res.ok === false && res.data
        ? `DEMO (ok:false) · ${res.stubLabel ?? 'pas live PHI'}`
        : null;
    setScanMsg(
      demoFlag ??
        res.stubLabel ??
        (res.data
          ? `Urgence : ${res.data.fullName} · ${res.data.address}`
          : 'Accès refusé ou QR inconnu'),
    );
  };

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return (
    <>
      <Stack.Screen options={{ title: 'Urgence' }} />
      <Screen title="Urgence & sécurité" subtitle="Module 13 — QR médical personnel">
        <BackendStatusBanner />
        <StubBanner
          text={
            label ??
            'QR imprimé par compte abonné · vue publique limitée · vue urgence complète (secours)'
          }
        />

        <Card title="SOS Urgence médicale">
          <Text style={styles.meta}>
            Bouton SOS flottant + cet écran. Appel services d’urgence locaux (112 EU).
          </Text>
          <Text style={styles.coords}>
            {coords
              ? `${coords.label} : ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}${
                  coords.accuracyM != null ? ` · ±${Math.round(coords.accuracyM)} m` : ''
                }`
              : gpsErr
                ? `GPS appareil indisponible — ${gpsErr}`
                : 'GPS appareil…'}
          </Text>
          <Pressable
            style={styles.share}
            onPress={() =>
              void getDeviceCoords({ allowFallback: false }).then((r) => {
                if (r.ok && r.data?.source === 'device') {
                  setCoords(r.data);
                  setGpsErr(null);
                } else {
                  setCoords(null);
                  setGpsErr(r.ok ? 'fallback interdit' : r.error);
                }
              })
            }
          >
            <Text style={styles.sosTxt}>Rafraîchir GPS</Text>
          </Pressable>
          <View style={styles.row}>
            <Pressable style={styles.sos} onPress={() => void Linking.openURL('tel:112')}>
              <Text style={styles.sosTxt}>Appeler 112</Text>
            </Pressable>
            <Pressable
              style={styles.share}
              onPress={() =>
                void (async () => {
                  setSosMsg(null);
                  const fresh = await getDeviceCoords({ allowFallback: false });
                  if (!fresh.ok || fresh.data?.source !== 'device') {
                    const err = !fresh.ok ? fresh.error : 'fallback interdit';
                    setSosMsg(`Partage SOS refusé — GPS appareil requis (${err}).`);
                    return;
                  }
                  const device = fresh.data;
                  setCoords(device);
                  await Share.share({
                    message: `URGENCE — GPS appareil ${device.lat}, ${device.lon}. Code QR : ${scanCode || '—'}.`,
                  });
                })()
              }
            >
              <Text style={styles.sosTxt}>SMS / partage</Text>
            </Pressable>
          </View>
          {sosMsg ? <Text style={styles.meta}>{sosMsg}</Text> : null}
        </Card>

        <Card title="QR personnel (compte abonné)">
          <Text style={styles.meta}>
            Un QR unique par compte abonné, imprimé en autocollant / carte / porte-clés — scannable
            avec n’importe quel appareil photo. Distinct de la valise OBD (M5) et de la fiche
            diagnostique véhicule.
          </Text>
          <Text style={styles.qrCode}>{(card?.scanCode ?? scanCode) || '— (abonné requis)'}</Text>
          <Text style={styles.meta}>
            Statut abonnement : {subscriberActive ? 'actif → QR disponible' : 'inactif → pas de QR'}
          </Text>
        </Card>

        <Card title="Fiche médicale personnelle">
          <Text style={styles.label}>Nom complet</Text>
          <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholderTextColor={colors.muted} placeholder="Nom" />
          <Text style={styles.label}>Adresse</Text>
          <TextInput value={address} onChangeText={setAddress} style={styles.input} placeholderTextColor={colors.muted} placeholder="Adresse postale" />
          <Text style={styles.label}>Groupe sanguin</Text>
          <TextInput value={bloodType} onChangeText={setBloodType} style={styles.input} placeholderTextColor={colors.muted} placeholder="ex. O+" />
          <Text style={styles.label}>Allergies</Text>
          <TextInput value={allergies} onChangeText={setAllergies} style={styles.input} placeholderTextColor={colors.muted} placeholder="séparées par virgule" />
          <Text style={styles.label}>Antécédents</Text>
          <TextInput value={conditions} onChangeText={setConditions} style={styles.input} placeholderTextColor={colors.muted} placeholder="séparés par virgule" />
          <Text style={styles.label}>Traitements</Text>
          <TextInput value={medications} onChangeText={setMedications} style={styles.input} placeholderTextColor={colors.muted} placeholder="séparés par virgule" />
          <Text style={styles.label}>Contact d’urgence — nom</Text>
          <TextInput value={contactName} onChangeText={setContactName} style={styles.input} placeholderTextColor={colors.muted} placeholder="Nom" />
          <Text style={styles.label}>Contact d’urgence — téléphone</Text>
          <TextInput value={contactPhone} onChangeText={setContactPhone} style={styles.input} placeholderTextColor={colors.muted} placeholder="+33…" keyboardType="phone-pad" />
          <Pressable style={styles.btn} onPress={() => void saveCard()}>
            <Text style={styles.sosTxt}>Enregistrer fiche + QR</Text>
          </Pressable>
          {saveMsg ? <Text style={styles.ok}>{saveMsg}</Text> : null}
        </Card>

        <Card title="Scan — accès contrôlé">
          <Text style={styles.meta}>
            (1) Public limité : SOS sans données médicales. (2) Urgence complète : nom, adresse,
            contact d’urgence, fiche médicale — secours autorisés uniquement.
          </Text>
          <Text style={styles.label}>Code QR scanné</Text>
          <TextInput
            value={scanCode}
            onChangeText={setScanCode}
            style={styles.input}
            placeholder="UM-QR-…"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
          />
          <Text style={styles.label}>Badge / n° pro (KYC secours)</Text>
          <TextInput
            value={badgeId}
            onChangeText={setBadgeId}
            style={styles.input}
            placeholder="ex. SP-59-4421"
            placeholderTextColor={colors.muted}
          />
          <View style={styles.row}>
            <Pressable style={styles.share} onPress={() => void onPublicScan()}>
              <Text style={styles.sosTxt}>Vue publique</Text>
            </Pressable>
            <Pressable style={styles.sos} onPress={() => void onEmergencyScan()}>
              <Text style={styles.sosTxt}>Vue urgence</Text>
            </Pressable>
          </View>
          {scanMsg ? <Text style={styles.meta}>{scanMsg}</Text> : null}

          {publicView ? (
            <View style={styles.preview}>
              <Text style={styles.previewTitle}>{publicView.brandLabel}</Text>
              <Text style={styles.meta}>{publicView.sosHint}</Text>
              <Pressable style={styles.btn} onPress={() => void Linking.openURL(`tel:${publicView.emergencyDial}`)}>
                <Text style={styles.sosTxt}>Appeler {publicView.emergencyDial}</Text>
              </Pressable>
            </View>
          ) : null}

          {emergencyView ? (
            <View style={styles.fullBox}>
              <Text style={styles.previewTitle}>Vue urgence complète</Text>
              <Text style={styles.line}>Nom : {emergencyView.fullName}</Text>
              <Text style={styles.line}>Adresse : {emergencyView.address}</Text>
              <Text style={styles.line}>
                Contact :{' '}
                {emergencyView.emergencyContact
                  ? `${emergencyView.emergencyContact.name} · ${emergencyView.emergencyContact.phone}`
                  : '—'}
              </Text>
              <Text style={styles.line}>Groupe sanguin : {emergencyView.bloodType ?? '—'}</Text>
              <Text style={styles.line}>Allergies : {emergencyView.allergies.join(', ') || '—'}</Text>
              <Text style={styles.line}>Antécédents : {emergencyView.conditions.join(', ') || '—'}</Text>
              <Text style={styles.line}>Traitements : {emergencyView.medications.join(', ') || '—'}</Text>
            </View>
          ) : null}
        </Card>

        <Card title="Alerte pause conduite (4 heures)">
          <Text style={styles.timer}>
            Chrono : {h} h {String(m).padStart(2, '0')} min {String(s).padStart(2, '0')} s
          </Text>
          <View style={styles.row}>
            <Pressable style={styles.share} onPress={() => setDriving((d) => !d)}>
              <Text style={styles.sosTxt}>{driving ? 'Pause chrono' : 'Reprendre'}</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => {
                setSeconds(0);
                setPausedAlert(false);
              }}
            >
              <Text style={styles.sosTxt}>Reset</Text>
            </Pressable>
          </View>
          {pausedAlert ? (
            <View style={styles.alert}>
              <Text style={styles.alertTxt}>4 heures — faites une pause ou prenez un café.</Text>
            </View>
          ) : null}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  coords: { fontWeight: '700', color: colors.ink },
  qrCode: {
    fontWeight: '900',
    fontSize: 18,
    color: colors.signal,
    letterSpacing: 0.5,
    marginVertical: 6,
  },
  label: { color: colors.slate, fontWeight: '700', fontSize: 12, marginTop: 6 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  sos: { flex: 1, backgroundColor: colors.danger, borderRadius: 10, padding: 12, alignItems: 'center' },
  share: { flex: 1, backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  sosTxt: { color: colors.white, fontWeight: '800', fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.mist,
    color: colors.ink,
  },
  ok: { color: colors.garage, fontWeight: '700', marginTop: 6 },
  preview: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.mist,
    gap: 6,
  },
  fullBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.dangerSoft,
    gap: 4,
  },
  previewTitle: { fontWeight: '900', color: colors.ink },
  line: { color: colors.slate, fontSize: 13 },
  timer: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  alert: {
    marginTop: 8,
    backgroundColor: colors.warnSoft,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.warn,
  },
  alertTxt: { color: colors.ink, fontWeight: '700' },
});
