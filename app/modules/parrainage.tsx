import { useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import {
  PREMIUM_PRICE_MONTHLY_USD,
  REFERRAL_SIGNUP_REWARD_CREDITS,
  REFERRER_DISCOUNT_MONTHS,
  REFERRER_DISCOUNT_PRICE_MONTHLY_USD,
} from '../../src/constants/subscription';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/context/I18nContext';
import { generateReferralCode } from '../../src/services/referral/referralCode';
import {
  claimReferralRewards,
  ensureUserReferralCode,
  referralLinkForCode,
} from '../../src/services/referral/referralService';
import { colors } from '../../src/theme/colors';

/**
 * Referral share screen — dyslexia-friendly (large type, short lines, high contrast).
 * Referrers who invite earn $12/mo for 3 months + credits; referred users pay $15.
 */
export default function ParrainageScreen() {
  const { t } = useI18n();
  const { profile, refresh } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const code = useMemo(() => {
    if (!profile) return '';
    return profile.referralCode?.trim() || generateReferralCode(profile.uid);
  }, [profile]);

  const link = useMemo(() => (code ? referralLinkForCode(code) : ''), [code]);

  const ensureAndClaim = async () => {
    if (!profile) {
      setStatus(t('referral.needAccount'));
      return;
    }
    setBusy(true);
    try {
      const withCode = await ensureUserReferralCode(profile);
      const claimed = await claimReferralRewards(withCode);
      if (claimed.data.claimed > 0) {
        setStatus(
          claimed.stubLabel ??
            t('referral.rewardApplied', {
              credits: claimed.data.creditsAdded,
              months: REFERRER_DISCOUNT_MONTHS,
              price: REFERRER_DISCOUNT_PRICE_MONTHLY_USD,
            }),
        );
        await refresh();
      } else {
        setStatus(t('referral.rewardsTitle'));
        await refresh();
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('referral.shareFail'));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!code) {
      setStatus(t('referral.needAccount'));
      return;
    }
    setBusy(true);
    try {
      if (profile) await ensureUserReferralCode(profile);
      const message = link
        ? t('referral.shareMessageLink', {
            code,
            link,
            price: PREMIUM_PRICE_MONTHLY_USD,
          })
        : t('referral.shareMessageCode', {
            code,
            price: PREMIUM_PRICE_MONTHLY_USD,
          });
      const res = await Share.share({
        message,
        title: t('referral.shareTitle'),
        url: Platform.OS === 'ios' && link ? link : undefined,
      });
      setStatus(
        res.action === Share.sharedAction ? t('referral.shareOk') : t('referral.shareCancel'),
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : t('referral.shareFail'));
    } finally {
      setBusy(false);
    }
  };

  const discountOn = Boolean(profile?.referrerDiscountActive && profile?.referrerDiscountEndsAt);
  const credits = profile?.referralRewardCredits ?? 0;
  const count = profile?.successfulReferralCount ?? 0;

  return (
    <>
      <Stack.Screen options={{ title: t('referral.title') }} />
      <Screen variant="stack" title={t('referral.title')} subtitle={t('referral.subtitle')}>
        <Card title={t('referral.howTitle')}>
          <Text style={styles.big}>{t('referral.how1')}</Text>
          <Text style={styles.big}>
            {t('referral.how2', {
              months: REFERRER_DISCOUNT_MONTHS,
              discount: REFERRER_DISCOUNT_PRICE_MONTHLY_USD,
              standard: PREMIUM_PRICE_MONTHLY_USD,
              credits: REFERRAL_SIGNUP_REWARD_CREDITS,
            })}
          </Text>
          <Text style={styles.big}>
            {t('referral.how3', { standard: PREMIUM_PRICE_MONTHLY_USD })}
          </Text>
        </Card>

        <Card title={t('referral.yourCode')}>
          {!profile ? (
            <Text style={styles.big}>{t('referral.needAccount')}</Text>
          ) : (
            <>
              <Text
                style={styles.code}
                accessibilityRole="text"
                accessibilityLabel={t('referral.codeA11y', { code })}
              >
                {code || '—'}
              </Text>
              {link ? (
                <Text style={styles.link}>{link}</Text>
              ) : (
                <Text style={styles.meta}>{t('referral.noLink')}</Text>
              )}
              <Pressable
                style={[styles.btn, busy && styles.disabled]}
                disabled={busy}
                onPress={() => void share()}
                accessibilityRole="button"
                accessibilityLabel={t('referral.shareCta')}
              >
                <Text style={styles.btnTxt}>{t('referral.shareCta')}</Text>
              </Pressable>
            </>
          )}
        </Card>

        <Card title={t('referral.rewardsTitle')}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{count}</Text>
              <Text style={styles.statLbl}>{t('referral.statInvites')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{credits}</Text>
              <Text style={styles.statLbl}>{t('referral.statCredits')}</Text>
            </View>
          </View>
          <Text style={[styles.flag, discountOn ? styles.flagOn : styles.flagOff]}>
            {discountOn
              ? t('referral.discountOn', {
                  price: REFERRER_DISCOUNT_PRICE_MONTHLY_USD,
                  until: (profile?.referrerDiscountEndsAt ?? '').slice(0, 10),
                })
              : t('referral.discountOff', { price: PREMIUM_PRICE_MONTHLY_USD })}
          </Text>
          <Pressable
            style={[styles.btnDark, busy && styles.disabled]}
            disabled={busy || !profile}
            onPress={() => void ensureAndClaim()}
            accessibilityRole="button"
            accessibilityLabel={t('referral.claimCta')}
          >
            <Text style={styles.btnTxt}>{t('referral.claimCta')}</Text>
          </Pressable>
        </Card>

        {status ? <Text style={styles.status}>{status}</Text> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  big: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
    marginBottom: 10,
  },
  code: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    color: colors.asphalt,
    marginVertical: 8,
  },
  link: {
    color: colors.slate,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  meta: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  btn: {
    backgroundColor: colors.signal,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDark: {
    backgroundColor: colors.asphalt,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  disabled: { opacity: 0.6 },
  btnTxt: { color: colors.white, fontWeight: '800', fontSize: 18 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  stat: {
    flex: 1,
    backgroundColor: colors.mist,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statVal: { fontSize: 28, fontWeight: '900', color: colors.ink },
  statLbl: { fontSize: 14, fontWeight: '700', color: colors.slate, marginTop: 4, textAlign: 'center' },
  flag: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    padding: 12,
    borderRadius: 10,
  },
  flagOn: { backgroundColor: colors.garageSoft, color: colors.garage },
  flagOff: { backgroundColor: colors.mist, color: colors.slate },
  status: { color: colors.garage, fontWeight: '700', fontSize: 15, lineHeight: 22, marginTop: 8 },
});
