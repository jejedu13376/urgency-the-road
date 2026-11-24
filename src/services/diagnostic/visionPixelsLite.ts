/**
 * Module 4 — vision lite (free / on-device).
 * Resizes the captured photo (native pixel pipeline via expo-image-manipulator),
 * optionally samples average RGB on web canvas, and maps focus tags → hints.
 * Does NOT run a CV / vision ML model — paid model stays an external option.
 */
import { Platform } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export type VisionFocus =
  | 'fuite_huile'
  | 'voyant'
  | 'rouille'
  | 'fumée'
  | 'pneu'
  | 'courroie';

export type VisionTone = 'dark' | 'mid' | 'bright' | 'unknown';

export type VisionAnalysis = {
  processed: boolean;
  width: number;
  height: number;
  tone: VisionTone;
  avgRgb: { r: number; g: number; b: number } | null;
  focus: VisionFocus | null;
  likelyParts: string[];
  guess: string;
  label: string;
  visionLive: true;
};

const FOCUS_HINT: Record<VisionFocus, { parts: string[]; tip: string }> = {
  fuite_huile: {
    parts: ['Joint', 'Huile', 'Carter'],
    tip: 'Piste fuite : zone sombre / brillante — contrôler joint de carter, filtre huile, bouchon.',
  },
  voyant: {
    parts: ['Capteur', 'Batterie', 'ABS'],
    tip: 'Piste voyant tableau : noter symbole + couleur — croiser OBD (M5) et Multi-IA texte.',
  },
  rouille: {
    parts: ['Disques', 'Étrier', 'Échappement'],
    tip: 'Piste corrosion : freins / échappement / sous-caisse — vérifier épaisseur disques.',
  },
  fumée: {
    parts: ['Turbo', 'Injecteur', 'Joint de culasse'],
    tip: 'Piste fumée : noire=richesse, bleue=huile, blanche=liquide — confirmer à chaud.',
  },
  pneu: {
    parts: ['pneu', 'pneumatique'],
    tip: 'Piste pneumatique : usure / flanc — contrôler pression et géométrie.',
  },
  courroie: {
    parts: ['Courroie', 'BELT', 'Galet'],
    tip: 'Piste courroie / galet : fissures, brillance, jeu — vérifier tension.',
  },
};

function toneFromRgb(rgb: { r: number; g: number; b: number } | null): VisionTone {
  if (!rgb) return 'unknown';
  const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  if (luma < 70) return 'dark';
  if (luma < 170) return 'mid';
  return 'bright';
}

/** Web-only: decode resized data URI on a canvas for real average RGB. */
async function sampleAverageRgbWeb(dataUri: string): Promise<{ r: number; g: number; b: number } | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    try {
      const img = new (globalThis as unknown as { Image: typeof Image }).Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, img.width);
          canvas.height = Math.max(1, img.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let r = 0;
          let g = 0;
          let b = 0;
          let n = 0;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n += 1;
          }
          if (!n) {
            resolve(null);
            return;
          }
          resolve({
            r: Math.round(r / n),
            g: Math.round(g / n),
            b: Math.round(b / n),
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUri;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Process a captured photo URI through the native image pipeline + focus heuristic.
 */
export async function analyzeVisionCapture(opts: {
  uri: string;
  focus?: VisionFocus | null;
  description?: string;
}): Promise<VisionAnalysis> {
  const focus = opts.focus ?? null;
  let width = 0;
  let height = 0;
  let avgRgb: { r: number; g: number; b: number } | null = null;
  let processed = false;

  try {
    const resized = await manipulateAsync(
      opts.uri,
      [{ resize: { width: 48 } }],
      { compress: 0.7, format: SaveFormat.JPEG, base64: true },
    );
    width = resized.width;
    height = resized.height;
    processed = true;
    if (resized.base64) {
      avgRgb = await sampleAverageRgbWeb(`data:image/jpeg;base64,${resized.base64}`);
    }
  } catch {
    processed = false;
  }

  // Optional remote vision proxy (ops) — never invent success without URL.
  const proxy = (process.env.EXPO_PUBLIC_VISION_PROXY_URL ?? '').trim();
  if (proxy && opts.uri) {
    try {
      const res = await fetch(proxy, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus,
          description: opts.description ?? '',
          note: 'client-lite — full image bytes not required for heuristic path',
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { guess?: string; likelyParts?: string[] };
        const parts = Array.isArray(json.likelyParts) ? json.likelyParts : focus ? FOCUS_HINT[focus].parts : [];
        return {
          processed,
          width,
          height,
          tone: toneFromRgb(avgRgb),
          avgRgb,
          focus,
          likelyParts: parts,
          guess: String(json.guess ?? 'Réponse proxy vision reçue.'),
          label: `Vision LIVE · proxy HTTP ${res.status} · resize ${width}×${height}`,
          visionLive: true,
        };
      }
    } catch {
      /* fall through to local heuristic */
    }
  }

  const tone = toneFromRgb(avgRgb);
  const focusMeta = focus ? FOCUS_HINT[focus] : null;
  const likelyParts = focusMeta?.parts ?? [];

  const toneBit =
    tone === 'dark'
      ? 'Tons sombres dominants (fuite / compartiment fermé possibles).'
      : tone === 'bright'
        ? 'Tons clairs (capot ouvert / éclairage fort).'
        : tone === 'mid'
          ? 'Tons moyens — contraste utile pour suivi manuel.'
          : 'Échantillonnage RGB indisponible sur cette plateforme — resize natif OK.';

  const processBit = processed
    ? `Image traitée (resize ${width}×${height}${avgRgb ? ` · RGB moy. ${avgRgb.r}/${avgRgb.g}/${avgRgb.b}` : ''}).`
    : 'Resize image indisponible — conservez la photo locale et décrivez la panne.';

  const focusBit = focusMeta
    ? focusMeta.tip
    : 'Aucune piste visuelle — choisissez fuite / voyant / rouille / fumée / pneu / courroie.';

  return {
    processed,
    width,
    height,
    tone,
    avgRgb,
    focus,
    likelyParts,
    guess: `${processBit}\n${toneBit}\n${focusBit}\nPas de modèle CV — confirmez via description / OBD / garage.`,
    label: `Vision lite LIVE · heuristique focus + resize (pas de ML vision)`,
    visionLive: true,
  };
}

export const VISION_PIXELS_LIVE =
  'Vision lite LIVE (expo-image-manipulator) — resize + focus heuristique ; modèle CV payant = option externe.';

/** @deprecated Prefer VISION_PIXELS_LIVE — kept so older imports compile during migration. */
export const VISION_PIXELS_BLOCKED = VISION_PIXELS_LIVE;
