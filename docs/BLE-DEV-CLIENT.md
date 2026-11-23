# BLE + Dev Client — `react-native-ble-plx`

## Why Expo Go is not enough

Module 5 OBD needs native Bluetooth LE. **Expo Go does not ship `react-native-ble-plx`.**  
On Expo Go / web, `getBleCapability()` returns `available: false` and scan/connect stay mock / blocked (no fake hardware success).

Live path requires a **development build** (EAS profile `development`) that includes:

1. `expo-dev-client` (~58.0.21 in this repo)
2. `react-native-ble-plx` (^3.5.1) + its config plugin
3. Android permissions: `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`, `ACCESS_FINE_LOCATION`
4. iOS usage strings: `NSBluetoothAlwaysUsageDescription` / `NSBluetoothPeripheralUsageDescription`

These are already wired in `app.json` / `package.json`. Soft `require()` lives in `src/services/obd/bleScaffold.ts` so Metro still boots when the native module is missing.

## Build + run (after Expo login)

```bash
cd urgency-the-road
npm install
npx eas-cli build -p android --profile development
# Install the finished Dev Client APK on the phone
npx expo start --dev-client
```

Open the Dev Client → connect to the Metro server → Module 5 → Scan/Connect with a physical ELM327 / J1939 dongle.

## Notes

- Rebuild the Dev Client after changing native deps, `app.json` plugins/permissions, or Expo SDK.
- Soft-require keeps Expo Go usable for non-BLE demos; do **not** replace it with a hard top-level import.
- PR #4 (if still open) deepens the live GATT/ELM327 session; this hosting restore only ensures native deps + permissions are present for that path.
- Formations site: untouched.
