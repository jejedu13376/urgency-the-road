/**
 * GPS watch interval presets (accuracy uses expo-location LocationAccuracy numbers:
 * Balanced=3, High=4). Kept free of expo-location imports for unit tests.
 */
export type GpsWatchPreset = {
  accuracy: number;
  timeInterval: number;
  distanceInterval: number;
};

/** Map follow while navigating — smooth vehicle marker. */
export const GPS_WATCH_NAVIGATING: GpsWatchPreset = {
  accuracy: 4, // High
  timeInterval: 1000,
  distanceInterval: 3,
};

/** Map idle / browsing — fewer OS callbacks, still fresh enough to pan. */
export const GPS_WATCH_MAP_IDLE: GpsWatchPreset = {
  accuracy: 3, // Balanced
  timeInterval: 2000,
  distanceInterval: 8,
};

/**
 * Global HOS / fatigue monitor — motion sampling, not map paint.
 * distanceInterval must stay short enough that at DRIVING_SPEED_MIN_MPS (~2 m/s)
 * callbacks arrive within the accumulator's per-tick delta cap (see useSafetyDrivingMonitor).
 */
export const GPS_WATCH_SAFETY: GpsWatchPreset = {
  accuracy: 3, // Balanced
  timeInterval: 2500,
  distanceInterval: 5,
};

/** Max credited seconds per GPS callback for HOS — ≥ distanceInterval / 2 m/s. */
export const GPS_WATCH_SAFETY_DELTA_CAP_SEC = 8;
