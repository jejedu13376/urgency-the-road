import { useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import {
  openInstallUrl,
  resolveInstallUrl,
  shareInstallLink,
} from '../../src/services/share/installUrl';
import { colors } from '../../src/theme/colors';

/** Module 16 — partage viral SMS / WhatsApp / email / share sheet + install URL wiring. */
export default function PartageScreen() {
  useModuleVisit(16);
  const install = resolveInstallUrl();
  const INSTALL_URL = install.url;
  const canShareLink = install.configured && INSTALL_URL.startsWith('http');
  const INSTALL_MSG = canShareLink
    ? 'Installe Urgence Mécanique — diagnostic VIN, flotte & urgence médicale : ' + INSTALL_URL
    : 'Urgence Mécanique — lien d’installation non encore publié (pas de store inventé).';
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState<'FR' | 'CA' | 'EU' | 'AU'>('FR');
  const [last, setLast] = useState<string | null>(null);

  const refuseUnset = () => {
    setLast('Partage lien refusé — définissez EXPO_PUBLIC_INSTALL_URL (aucun listing inventé)');
  };

  const msgForRegion = () =>
    `${INSTALL_MSG}\nRégion : ${region} · Android / iOS / Web.`;

  const shareSheet = async (channel: string) => {
    if (!canShareLink) {
      refuseUnset();
      return;
    }
    try {
      const res = await Share.share({
        message: `${msgForRegion()}\nVia ${channel}`,
        title: 'Urgence Mécanique',
        url: Platform.OS === 'ios' ? INSTALL_URL : undefined,
      });
      setLast(
        res.action === Share.sharedAction
          ? `Partage sheet OK (${channel}${res.activityType ? ` · ${res.activityType}` : ''})`
          : `Partage annulé (${channel})`,
      );
    } catch (e) {
      setLast(e instanceof Error ? e.message : 'Échec partage');
    }
  };

  const sendSms = () => {
    if (!canShareLink) {
      refuseUnset();
      return;
    }
    const body = encodeURIComponent(msgForRegion());
    const to = phone.trim().replace(/\s/g, '');
    const url =
      Platform.OS === 'ios'
        ? `sms:${to}&body=${body}`
        : `sms:${to}?body=${body}`;
    void Linking.openURL(url)
      .then(() => setLast(`SMS ouvert${to ? ` → ${to}` : ''}`))
      .catch(() => setLast('SMS non disponible sur cet appareil — utilisez la share sheet.'));
  };

  const sendWhatsApp = () => {
    if (!canShareLink) {
      refuseUnset();
      return;
    }
    const text = encodeURIComponent(msgForRegion());
    const digits = phone.trim().replace(/\D/g, '');
    const url = digits
      ? `https://wa.me/${digits}?text=${text}`
      : `https://wa.me/?text=${text}`;
    void Linking.openURL(url)
      .then(() => setLast('WhatsApp ouvert'))
      .catch(() => setLast('WhatsApp introuvable — share sheet en secours.'));
  };

  const sendEmail = () => {
    if (!canShareLink) {
      refuseUnset();
      return;
    }
    const subject = encodeURIComponent('Rejoins Urgence Mécanique');
    const body = encodeURIComponent(msgForRegion());
    const to = email.trim();
    const url = `mailto:${to}?subject=${subject}&body=${body}`;
    void Linking.openURL(url)
      .then(() => setLast(`Email ouvert${to ? ` → ${to}` : ''}`))
      .catch(() => setLast('Client mail indisponible — utilisez la share sheet.'));
  };

  const openLink = () => {
    void openInstallUrl(INSTALL_URL).then((r) => setLast(r.message));
  };

  const shareLinkOnly = () => {
    void shareInstallLink(INSTALL_URL, region).then((r) => setLast(r.message));
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Partage' }} />
      <Screen title="Partage viral" subtitle="Module 16 — installation universelle">
        <StubBanner
          text={
            canShareLink
              ? `Lien install LIVE (${install.source}) · ${INSTALL_URL}`
              : 'Lien install non configuré — définissez EXPO_PUBLIC_INSTALL_URL ; aucun listing inventé'
          }
        />

        <Card title="Lien d’installation">
          <Text style={styles.meta}>Source : {install.source} · configuré : {install.configured ? 'oui' : 'non'}</Text>
          <Text style={styles.url}>{canShareLink ? INSTALL_URL : '(non configuré)'}</Text>
          <Pressable style={styles.btn} onPress={openLink}>
            <Text style={styles.btnTxt}>Ouvrir le lien install</Text>
          </Pressable>
          <Pressable style={styles.btnDark} onPress={shareLinkOnly}>
            <Text style={styles.btnTxt}>Partager le lien seul</Text>
          </Pressable>
        </Card>

        <Card title="Région destinataire">
          <View style={styles.regionRow}>
            {(['FR', 'CA', 'EU', 'AU'] as const).map((r) => (
              <Pressable
                key={r}
                style={[styles.chip, region === r && styles.chipOn]}
                onPress={() => setRegion(r)}
              >
                <Text style={[styles.chipTxt, region === r && styles.chipTxtOn]}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.meta}>Message adapté FR · Canada · Europe · Australie.</Text>
        </Card>

        <Card title="SMS / Texto">
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+33 6… / +1…"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <Pressable style={styles.btn} onPress={sendSms}>
            <Text style={styles.btnTxt}>Ouvrir SMS</Text>
          </Pressable>
        </Card>

        <Card title="WhatsApp">
          <Text style={styles.meta}>Utilise le même numéro (indicatif pays sans +) ou ouvre un chat vide.</Text>
          <Pressable style={styles.btnWa} onPress={sendWhatsApp}>
            <Text style={styles.btnTxt}>Envoyer via WhatsApp</Text>
          </Pressable>
        </Card>

        <Card title="Email">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="ami@exemple.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <Pressable style={styles.btnDark} onPress={sendEmail}>
            <Text style={styles.btnTxt}>Ouvrir e-mail</Text>
          </Pressable>
        </Card>

        <Card title="Réseaux & share sheet">
          <Text style={styles.meta}>
            Un clic : sheet système (Messages, Mail, réseaux sociaux selon l’OS).
          </Text>
          <View style={styles.grid}>
            {['Réseaux sociaux', 'Copier / autres', 'Collègue atelier', 'Famille'].map((c) => (
              <Pressable key={c} style={styles.btnGrid} onPress={() => void shareSheet(c)}>
                <Text style={styles.btnTxt}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card title="Multi-support universel">
          <Text style={styles.line}>• Android & iPhone (Expo / stores)</Text>
          <Text style={styles.line}>• Ordinateur Web / Desktop (PWA — ajout écran d’accueil)</Text>
          <Text style={styles.meta}>Plateforme actuelle : {Platform.OS}</Text>
        </Card>

        {last ? <Text style={styles.ok}>{last}</Text> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  regionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
  btnWa: { backgroundColor: '#128C7E', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  btnDark: { backgroundColor: colors.asphalt, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  btnGrid: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: '46%',
    flexGrow: 1,
    alignItems: 'center',
  },
  btnTxt: { color: colors.white, fontWeight: '800', fontSize: 12, textAlign: 'center' },
  line: { color: colors.ink, fontWeight: '700', marginBottom: 4 },
  meta: { color: colors.muted, fontSize: 12 },
  url: { color: colors.ink, fontWeight: '700', fontSize: 13, marginTop: 4 },
  ok: { color: colors.garage, fontWeight: '700', marginTop: 8 },
});
