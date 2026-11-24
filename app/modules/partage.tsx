import { useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { BRAND_NAME } from '../../src/brand';
import { useI18n } from '../../src/context/I18nContext';
import { useModuleVisit } from '../../src/hooks/useModuleVisit';
import {
  openInstallUrl,
  resolveInstallUrl,
  shareInstallLink,
} from '../../src/services/share/installUrl';
import { colors } from '../../src/theme/colors';
import { FadeInBlock, PressScale } from '../../src/theme/motion';

/** Module 16 — partage viral SMS / WhatsApp / email / share sheet + install URL wiring. */
export default function PartageScreen() {
  const { t } = useI18n();
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
      <Stack.Screen options={{ title: t('moduleTitles.partage') }} />
      <Screen
        variant="stack" title={t('moduleTitles.partage')} subtitle={t('moduleTitles.partageSub')}>
        <StubBanner
          text={
            canShareLink
              ? `Lien install LIVE (${install.source}) · ${INSTALL_URL}`
              : 'Lien install non configuré — EXPO_PUBLIC_INSTALL_URL ou deep link Expo ; aucun listing inventé'
          }
        />

        <FadeInBlock>
          <View style={styles.hero} accessibilityLabel={t('referral.title')}>
            <Text style={styles.heroBrand}>{BRAND_NAME}</Text>
            <Text style={styles.heroKicker}>{t('referral.kicker')}</Text>
            <Text style={styles.heroTitle}>{t('referral.title')}</Text>
            <Text style={styles.heroBody}>{t('referral.body')}</Text>
            <PressScale style={styles.heroCta} onPress={shareLinkOnly} accessibilityRole="button">
              <Text style={styles.heroCtaTxt}>{t('referral.shareCta')}</Text>
            </PressScale>
          </View>
        </FadeInBlock>

        <Card title="Lien d’installation">
          <Text style={styles.meta}>Source : {install.source} · configuré : {install.configured ? 'oui' : 'non'}</Text>
          <Text style={styles.url}>{canShareLink ? INSTALL_URL : '(non configuré)'}</Text>
          <PressScale style={styles.btn} onPress={openLink}>
            <Text style={styles.btnTxt}>Ouvrir le lien install</Text>
          </PressScale>
          <PressScale style={styles.btnDark} onPress={shareLinkOnly}>
            <Text style={styles.btnTxt}>Partager le lien seul</Text>
          </PressScale>
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
  hero: {
    backgroundColor: colors.asphalt,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 18,
    gap: 8,
  },
  heroBrand: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.2,
    lineHeight: 34,
  },
  heroKicker: {
    color: colors.signalSoft,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  heroBody: {
    color: colors.mist,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  heroCta: {
    marginTop: 8,
    backgroundColor: colors.signal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  heroCtaTxt: { color: colors.white, fontWeight: '900', fontSize: 16 },
  regionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.mist,
  },
  chipOn: { backgroundColor: colors.asphalt, borderColor: colors.asphalt },
  chipTxt: { fontWeight: '800', color: colors.slate, fontSize: 14 },
  chipTxtOn: { color: colors.white },
  input: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.mist,
    color: colors.ink,
    marginTop: 6,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 48,
  },
  btn: {
    backgroundColor: colors.signal,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  btnWa: {
    backgroundColor: '#128C7E',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  btnDark: {
    backgroundColor: colors.asphalt,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  btnGrid: {
    backgroundColor: colors.signal,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minWidth: '46%',
    flexGrow: 1,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  btnTxt: { color: colors.white, fontWeight: '800', fontSize: 14, textAlign: 'center' },
  line: { color: colors.ink, fontWeight: '700', marginBottom: 4, fontSize: 15, lineHeight: 22 },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  url: { color: colors.ink, fontWeight: '700', fontSize: 15, marginTop: 4, lineHeight: 22 },
  ok: { color: colors.garage, fontWeight: '700', marginTop: 8, fontSize: 14 },
});
