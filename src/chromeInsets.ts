import type { EdgeInsets } from 'react-native-safe-area-context';
import { GLOBAL_TOP_BAR_BODY } from './components/GlobalTopBar';

/** Y of the first pixel below the persistent GlobalTopBar. */
export function belowGlobalTopBar(insets: EdgeInsets): number {
  return Math.max(insets.top, 0) + GLOBAL_TOP_BAR_BODY;
}

/** Gap between GlobalTopBar and the next chrome row. */
export const CHROME_GAP = 6;

/**
 * Reserved height for the HOS chip row under GlobalTopBar.
 * Allows two lines (`numberOfLines={2}`) without covering weather below.
 */
export const HOS_CHIP_ROW_HEIGHT = 48;

/** Custom modules stack header row height (`app/modules/_layout.tsx`). */
export const MODULES_HEADER_HEIGHT = 44;
