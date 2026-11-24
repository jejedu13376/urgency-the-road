import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { useI18n } from '../../src/context/I18nContext';
import {
  getSupportEmail,
  SUPPORT_COMPANY,
  supportMailtoUrl,
} from '../../src/services/support/companySupport';
import { colors } from '../../src/theme/colors';

/** Support hub — company support email (mailto) for Expo demo / abonnés. */
export default function SupportScreen() {
  const { t } = useI18n();
  const email = getSupportEmail();
  const [status, setStatus] = useState<string | null>(null);

  const openMail = useCallback(async () => {
    const url = supportMailtoUrl(
      t('support.mailSubject'),
      t('support.mailBody', { app: SUPPORT_COMPANY }),
    );
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        setStatus(t('support.mailUnavailable', { email }));
        return;
      }
      await Linking.openURL(url);
      setStatus(t('support.mailOpened'));
    } catch {
      setStatus(t('support.mailUnavailable', { email }));
    }
  }, [email, t]);

  return (
    <>
      <Stack.Screen options={{ title: t('support.title') }} />
      <Screen variant="stack" title={t('support.title')} subtitle={t('support.subtitle')}>
        <Card title={SUPPORT_COMPANY}>
          <Text style={styles.meta}>{t('support.intro')}</Text>
          <View style={styles.emailBox}>
            <Text style={styles.emailLabel}>{t('support.emailLabel')}</Text>
            <Text
              style={styles.email}
              selectable
              accessibilityLabel={t('support.emailA11y', { email })}
            >
              {email}
            </Text>
          </View>
          <Pressable
            style={styles.btn}
            onPress={() => void openMail()}
            accessibilityRole="button"
            accessibilityLabel={t('support.writeA11y')}
            testID="support-mailto"
          >
            <Text style={styles.btnTxt}>{t('support.write')}</Text>
          </Pressable>
          {status ? <Text style={styles.status}>{status}</Text> : null}
          <Text style={styles.hint}>{t('support.hint')}</Text>
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  emailBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  emailLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  email: { color: colors.signal, fontWeight: '800', fontSize: 16 },
  btn: {
    marginTop: 12,
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnTxt: { color: colors.white, fontWeight: '800' },
  status: { marginTop: 8, color: colors.ink, fontWeight: '700', fontSize: 12 },
  hint: { marginTop: 8, color: colors.muted, fontSize: 11, lineHeight: 16 },
});
