/**
 * DEV / mock soft-auth helpers.
 * When Firebase client keys exist but rules/Auth/entitlements block,
 * prefer soft-fail → mock so Expo UI still loads (no hard "approval" crash).
 *
 * TEMPORARY: paired with open-to-world firestore/storage rules (dev only).
 * Flip off for production: unset EXPO_PUBLIC_DEV_SOFT_AUTH and tighten rules.
 */

/** True in Expo/React Native __DEV__, or when EXPO_PUBLIC_DEV_SOFT_AUTH=1. */
export function isDevSoftAuth(): boolean {
  const flag = (process.env.EXPO_PUBLIC_DEV_SOFT_AUTH ?? '').trim().toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'yes') return true;
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/** Firestore / Storage permission-denied (and close cousins). */
export function isPermissionDenied(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const code = 'code' in e ? String((e as { code: unknown }).code) : '';
  if (
    code === 'permission-denied' ||
    code === 'storage/unauthorized' ||
    code === 'functions/permission-denied'
  ) {
    return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  return /missing or insufficient permissions/i.test(msg);
}
