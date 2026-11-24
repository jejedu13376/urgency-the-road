import type { EdgeInsets } from 'react-native-safe-area-context';
import { GLOBAL_TOP_BAR_BODY } from './components/GlobalTopBar';

/** Y of the first pixel below the persistent GlobalTopBar overlay (brand + langs). */
export function belowGlobalTopBar(insets: EdgeInsets): number {
  return Math.max(insets.top, 0) + GLOBAL_TOP_BAR_BODY;
}

/** Gap between GlobalTopBar overlay and the next chrome row (HOS / Connexion). */
export const CHROME_GAP = 6;

/** Leave room on the right for ConnexionChip (width 112 + right 10 + slack). */
export const CONNEXION_RIGHT_CLEARANCE = 128;
