/**
 * Module 14 — honest OTA channel probe + optional fetch/apply.
 * Does not invent "up to date". Reports whether expo-updates / EAS canal is present.
 */
import Constants from 'expo-constants';

export type OtaProbe = {
  available: boolean;
  channel: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  label: string;
  /** True when expo-updates runtime is enabled (Dev Client / EAS build). */
  runtimeEnabled: boolean;
};

type UpdatesModule = {
  isEnabled?: boolean;
  channel?: string;
  updateId?: string | null;
  runtimeVersion?: string;
  checkForUpdateAsync?: () => Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync?: () => Promise<{ isNew: boolean }>;
  reloadAsync?: () => Promise<void>;
};

function loadUpdates(): UpdatesModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-updates') as UpdatesModule;
  } catch {
    return null;
  }
}

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

  const Updates = loadUpdates();
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
      runtimeEnabled: true,
      label: available
        ? 'Mise à jour OTA disponible (EAS Update) — vous pouvez appliquer'
        : `Canal OTA actif${Updates.channel ? ` · ${Updates.channel}` : ''} — pas de update en attente`,
    };
  }

  if (updates?.url) {
    return {
      available: false,
      channel: easChannel,
      runtimeVersion,
      updateId: null,
      runtimeEnabled: false,
      label: `URL updates déclarée (${updates.url}) — runtime sans expo-updates (Dev Client / EAS build requis)`,
    };
  }

  return {
    available: false,
    channel: null,
    runtimeVersion,
    updateId: null,
    runtimeEnabled: false,
    label: 'OTA EAS Update non configuré — aucune sync cloud simulée (chemin logiciel prêt)',
  };
}

/** Fetch + reload when an update is available. Never fakes success without expo-updates. */
export async function applyOtaUpdateIfAvailable(): Promise<{ ok: boolean; message: string }> {
  const Updates = loadUpdates();
  if (!Updates?.isEnabled) {
    return {
      ok: false,
      message: 'Appliquer OTA impossible ici — Dev Client / build EAS avec expo-updates requis',
    };
  }
  try {
    const check = await Updates.checkForUpdateAsync?.();
    if (!check?.isAvailable) {
      return { ok: false, message: 'Aucune mise à jour OTA en attente sur ce canal' };
    }
    // fetch may report isNew:false when Expo already background-downloaded the bundle —
    // still reload so the pending update actually applies.
    const fetched = await Updates.fetchUpdateAsync?.();
    await Updates.reloadAsync?.();
    return {
      ok: true,
      message: fetched?.isNew
        ? 'Update OTA téléchargée et appliquée — rechargement'
        : 'Update OTA déjà en cache — rechargement pour appliquer',
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Échec apply OTA',
    };
  }
}
