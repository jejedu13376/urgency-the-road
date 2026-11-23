/**
 * Module 14 — honest OTA channel probe.
 * Does not invent "up to date". Reports whether expo-updates / EAS canal is present.
 */
import Constants from 'expo-constants';

export type OtaProbe = {
  available: boolean;
  channel: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  label: string;
};

export async function checkOtaChannel(): Promise<OtaProbe> {
  const expoConfig = Constants.expoConfig;
  const updates = (expoConfig as { updates?: { url?: string; requestHeaders?: Record<string, string> } } | null)
    ?.updates;
  const easChannel =
    updates?.requestHeaders?.['expo-channel-name'] ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    null;
  const runtimeVersion =
    (expoConfig as { runtimeVersion?: string } | null)?.runtimeVersion ??
    expoConfig?.version ??
    null;

  // Dynamic import — expo-updates may be absent in Expo Go / bare without plugin
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Updates = require('expo-updates') as {
      isEnabled?: boolean;
      channel?: string;
      updateId?: string | null;
      runtimeVersion?: string;
      checkForUpdateAsync?: () => Promise<{ isAvailable: boolean }>;
    };
    if (Updates?.isEnabled) {
      let available = false;
      try {
        const check = await Updates.checkForUpdateAsync?.();
        available = Boolean(check?.isAvailable);
      } catch {
        available = false;
      }
      return {
        available,
        channel: Updates.channel ?? easChannel ?? null,
        runtimeVersion: Updates.runtimeVersion ?? runtimeVersion,
        updateId: Updates.updateId ?? null,
        label: available
          ? 'Mise à jour OTA disponible (EAS Update)'
          : `Canal OTA actif${Updates.channel ? ` · ${Updates.channel}` : ''} — pas de update en attente`,
      };
    }
  } catch {
    // module missing
  }

  if (updates?.url) {
    return {
      available: false,
      channel: easChannel,
      runtimeVersion,
      updateId: null,
      label: `URL updates déclarée (${updates.url}) — runtime sans expo-updates (Dev Client / EAS build requis)`,
    };
  }

  return {
    available: false,
    channel: null,
    runtimeVersion,
    updateId: null,
    label: 'OTA EAS Update non configuré — aucune sync cloud simulée',
  };
}
