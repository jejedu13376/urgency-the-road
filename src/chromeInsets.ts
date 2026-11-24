import type { EdgeInsets } from 'react-native-safe-area-context';
import { GLOBAL_TOP_BAR_BODY } from './components/GlobalTopBar';

/** Y of the first pixel below the persistent GlobalTopBar overlay (brand + langs). */
export function belowGlobalTopBar(insets: EdgeInsets): number {
  return Math.max(insets.top, 0) + GLOBAL_TOP_BAR_BODY;
}

/** Gap between GlobalTopBar overlay and the next chrome row (HOS / Connexion). */
export const CHROME_GAP = 6;

/**
 * Max height of the HOS chip (2-line speed/fatigue readout).
 * Weather must clear this, not only ConnexionChip height.
 */
export const HOS_CHIP_ROW_HEIGHT = 52;

/** Gap between HOS/Connexion row and WeatherBanner. */
export const WEATHER_BELOW_CHROME_GAP = 4;

/** Approx WeatherBanner height (main + stub + pad). */
export const WEATHER_CHIP_HEIGHT = 42;

/**
 * Space below the status-bar inset for GlobalTopBar + HOS/Connexion + weather.
 * Used by `Screen` tab headers — keep in sync with WeatherBanner top math.
 */
export const CHROME_STACK_BELOW_STATUS =
  GLOBAL_TOP_BAR_BODY +
  CHROME_GAP +
  HOS_CHIP_ROW_HEIGHT +
  WEATHER_BELOW_CHROME_GAP +
  WEATHER_CHIP_HEIGHT;

/** Leave room on the right for ConnexionChip (width 112 + right 10 + slack). */
export const CONNEXION_RIGHT_CLEARANCE = 128;
