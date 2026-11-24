import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { BackendStatusBanner } from '../../src/components/BackendStatusBanner';
import { Card } from '../../src/components/Card';
import { DrowsinessMonitorCard } from '../../src/components/DrowsinessMonitorCard';
import { EmergencyDialList } from '../../src/components/EmergencyDialList';
import { HosLivePanel } from '../../src/components/HosLivePanel';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/context/I18nContext';
import { useNightMode } from '../../src/context/NightModeContext';
import { useSafetyDriving } from '../../src/context/SafetyDrivingContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import {
  ensurePersonalQr,
  getOwnMedicalCard,
  scanMedicalEmergency,
  scanMedicalPublic,
  upsertMedicalCard,
} from '../../src/services/firebase';
import { getDeviceCoords, type DeviceCoords } from '../../src/services/geo/deviceLocation';
import {
  BREAK_TTS_EN,
  BREAK_TTS_ES,
  BREAK_TTS_FR,
  DRIVING_BREAK_THRESHOLD_SEC,
  speakDrivingBreakAlert,
} from '../../src/services/urgence/drivingBreak';
import type { NightModeSetting } from '../../src/services/urgence/nightMode';
import {
  emergencyOptionById,
  suggestEmergencyNumberId,
} from '../../src/services/urgence/emergencyNumbers';
import {
  formatSosAlertMessage,
  isValidSosEmail,
  loadSosEmail,
  saveSosEmail,
} from '../../src/services/urgence/sosEmail';
import type {
  MedicalCardDoc,
  MedicalEmergencyView,
  MedicalPublicPreview,
} from '../../src/types/firestore';
import { colors } from '../../src/theme/colors';

/**
 * Module 13 — SOS, pause 4h, personal printed QR per subscriber,
 * controlled access: public_limited vs emergency_full (name/address/contact/full fiche).
 * No electronic-beacon product; distinct from OBD valise + vehicle diagnostic hardware.
 */
export default function UrgenceScreen() {
  const { t } = useI18n();
  useModuleVisit(13);
  const { profile } = useAuth();
  const {
    breakState,
    fatigue,
    hosLive,
    hosRegion,
    setHosRegion,
    takeBreak,
    speedLimit,
    speedKmh,
    overspeed,
    monitoring,
    setMonitoring,
  } = useSafetyDriving();
  const { setting: nightSetting, active: nightActive, setSetting: setNightSetting } = useNightMode();
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
  const [sosEmail, setSosEmail] = useState('');
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [gpsErr, setGpsErr] = useState<string | null>(null);
  const [label, setLabel] = useState<string | undefined>();
  const [coords, setCoords] = useState<DeviceCoords | null>(null);

  const suggestedEmergencyId = useMemo(
    () =>
      suggestEmergencyNumberId({
        lat: coords?.lat,
        lon: coords?.lon,
      }),
    [coords?.lat, coords?.lon],
  );
  const suggestedEmergency = emergencyOptionById(suggestedEmergencyId);

  // Align with firestore.rules ownerIsActiveSubscriber — flag only, never plan name / !profile.
  const subscriberActive = profile?.subscriptionActive === true;

  useEffect(() => {
    // M13: never seed SOS UI with Lille fallback — device GPS only.
    void getDeviceCoords({ allowFallback: false }).then((r) => {
      if (r.ok && r.data?.source === 'device') setCoords(r.data);
      else setGpsErr(r.ok ? 'fallback interdit' : r.error);
    });
    void loadSosEmail().then(setSosEmail);
  }, []);

  const onSosEmailChange = (value: string) => {
    setSosEmail(value);
    setEmailErr(null);
  };

  const persistSosEmail = async (): Promise<string | null> => {
    const trimmed = sosEmail.trim();
    if (!trimmed) {
      setEmailErr('Email requis pour envoyer l’alerte SOS.');
      return null;
    }
    if (!isValidSosEmail(trimmed)) {
      setEmailErr('Format email invalide (ex. nom@domaine.com).');
      return null;
    }
    const saved = await saveSosEmail(trimmed);
    setSosEmail(saved);
    setEmailErr(null);
    return saved;
  };

  const sendSosAlert = async () => {
    setSosMsg(null);
    const email = await persistSosEmail();
    if (!email) return;

    const fresh = await getDeviceCoords({ allowFallback: false });
    if (!fresh.ok || fresh.data?.source !== 'device') {
      const err = !fresh.ok ? fresh.error : 'fallback interdit';
      setSosMsg(`Partage SOS refusé — GPS appareil requis (${err}).`);
      return;
    }
    const device = fresh.data;
    setCoords(device);
    const suggested = emergencyOptionById(
      suggestEmergencyNumberId({ lat: device.lat, lon: device.lon }),
    );
    const message = formatSosAlertMessage({
      kind: 'sos_alert',
      email,
      lat: device.lat,
      lon: device.lon,
      accuracyM: device.accuracyM ?? undefined,
      // Own personal QR only — never the "Code QR scanné" field (may be a third party).
      scanCode: card?.scanCode || '',
      suggestedEmergency: `${suggested.number} (${suggested.regionLabel})`,
      createdAt: new Date().toISOString(),
    });
    await Share.share({ message });
  };

  const hydrateForm = useCallback((c: MedicalCardDoc) => {
    setFullName(c.fullName);
    setAddress(c.address ?? '');
    setBloodType(c.bloodType ?? '');
    setAllergies((c.allergies ?? []).join(', '));
    setConditions((c.conditions ?? []).join(', '));
    setMedications((c.medications ?? []).join(', '));
    setContactName(c.emergencyContacts?.[0]?.name ?? '');
    setContactPhone(c.emergencyContacts?.[0]?.phone ?? '');
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
  }, [profile?.uid, subscriberActive, hydrateForm]);

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

  const driveSec = Math.floor(breakState.drivingSec);
  const h = Math.floor(driveSec / 3600);
  const m = Math.floor((driveSec % 3600) / 60);
  const s = driveSec % 60;
  const pausedAlert = driveSec >= DRIVING_BREAK_THRESHOLD_SEC || fatigue.mustStop;

  return (
    <>
      <Stack.Screen options={{ title: t('moduleTitles.urgence') }} />
      <Screen
        variant="stack" title={t('moduleTitles.urgence')} subtitle={t('moduleTitles.urgenceSub')}>
        <BackendStatusBanner />
        <StubBanner
          text={
            label ??
            'QR imprimé par compte abonné · vue publique limitée · vue urgence complète (secours)'
          }
        />

        <Card title="SOS Urgence médicale">
          <Text style={styles.meta}>
            Bouton SOS flottant + cet écran. Appelez un n° d’urgence (tous visibles) ou envoyez une
            alerte avec email + GPS. Suggestion : {suggestedEmergency.number} (
            {suggestedEmergency.regionLabel}).
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
          <Text style={styles.label}>Email contact (requis pour alerte / partage)</Text>
          <TextInput
            value={sosEmail}
            onChangeText={onSosEmailChange}
            onBlur={() => {
              if (sosEmail.trim() && isValidSosEmail(sosEmail)) {
                void saveSosEmail(sosEmail).then(setSosEmail);
              }
            }}
            style={styles.input}
            placeholder="vous@exemple.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            accessibilityLabel="Email contact SOS"
          />
          {emailErr ? <Text style={styles.err}>{emailErr}</Text> : null}
          <Text style={styles.meta}>
            L’email n’est pas requis pour composer un numéro d’urgence — seulement avant « Envoyer
            alerte ».
          </Text>
          <Pressable
            style={styles.gpsBtn}
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
          <EmergencyDialList suggestedId={suggestedEmergencyId} />
          <Pressable style={styles.sosWide} onPress={() => void sendSosAlert()}>
            <Text style={styles.sosTxt}>Envoyer alerte (SMS / partage)</Text>
          </Pressable>
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
              <EmergencyDialList suggestedId={suggestedEmergencyId} compact />
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
              <Text style={styles.line}>
                Allergies : {(emergencyView.allergies ?? []).join(', ') || '—'}
              </Text>
              <Text style={styles.line}>
                Antécédents : {(emergencyView.conditions ?? []).join(', ') || '—'}
              </Text>
              <Text style={styles.line}>
                Traitements : {(emergencyView.medications ?? []).join(', ') || '—'}
              </Text>
            </View>
          ) : null}
        </Card>

        <Card title="HOS live + fatigue / vitesse">
          <HosLivePanel
            hosLive={hosLive}
            selected={hosRegion}
            onSelectRegion={(id) => {
              void setHosRegion(id);
            }}
          />
          <Text style={styles.timer}>
            Conduite GPS : {h} h {String(m).padStart(2, '0')} min {String(s).padStart(2, '0')} s
            {' · '}
            fatigue {fatigue.score}/100 ({fatigue.level})
          </Text>
          <Text style={styles.meta}>
            Limite {speedLimit.label}: {speedLimit.limitKmh} km/h
            {speedKmh != null ? ` · actuel ${Math.round(speedKmh)} km/h` : ''}
            {overspeed ? ' · ALERTE VITESSE' : ''}
          </Text>
          <View style={styles.row}>
            <Pressable style={styles.share} onPress={() => setMonitoring((v) => !v)}>
              <Text style={styles.sosTxt}>{monitoring ? 'Pause surveillance' : 'Reprendre GPS'}</Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => {
                void takeBreak();
              }}
            >
              <Text style={styles.sosTxt}>Pause faite — reset</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.btn}
            onPress={() => {
              void speakDrivingBreakAlert({ repeat: 1 });
            }}
          >
            <Text style={styles.sosTxt}>Tester TTS pause (FR→EN→ES)</Text>
          </Pressable>
          <Text style={styles.meta}>
            {BREAK_TTS_FR}
            {'\n'}
            {BREAK_TTS_EN}
            {'\n'}
            {BREAK_TTS_ES}
          </Text>
          {pausedAlert ? (
            <View style={styles.alert}>
              <Text style={styles.alertTxt}>
                {fatigue.mustStop
                  ? 'Arrêt obligatoire — fatigue / HOS critique.'
                  : `4 h confort (${DRIVING_BREAK_THRESHOLD_SEC / 3600} h) — café et jambes.`}
              </Text>
            </View>
          ) : null}
        </Card>

        <DrowsinessMonitorCard />

        <Card title="Mode nuit (auto + manuel)">
          <Text style={styles.meta}>
            Actif : {nightActive ? 'oui (sombre / atténué)' : 'non'} · réglage : {nightSetting}
          </Text>
          <View style={styles.row}>
            {(['auto', 'on', 'off'] as NightModeSetting[]).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.share, nightSetting === mode && styles.btn]}
                onPress={() => setNightSetting(mode)}
              >
                <Text style={styles.sosTxt}>
                  {mode === 'auto' ? 'Auto' : mode === 'on' ? 'Nuit ON' : 'Nuit OFF'}
                </Text>
              </Pressable>
            ))}
          </View>
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
  sosWide: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  gpsBtn: {
    backgroundColor: colors.asphalt,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  share: { flex: 1, backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center' },
  btn: { backgroundColor: colors.signal, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  sosTxt: { color: colors.white, fontWeight: '800', fontSize: 12 },
  err: { color: colors.danger, fontWeight: '700', fontSize: 12, marginTop: 4 },
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
