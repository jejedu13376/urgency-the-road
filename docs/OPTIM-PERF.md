# Perf / fluidity — Urgence Road

## Shipped this pass

| Lever | Detail |
| --- | --- |
| Icon compress | `assets/icon.png` resized/optimized (was ~393KB) |
| YouTube | 10 min in-memory cache + 6s AbortController timeout + small thumbs |
| BLE | Soft `require` of ble-plx — Expo Go still boots; live path only on Dev Client |
| Weather vs spinner | Weather top-right; spinner top-left — no overlap |
| Screen header pad | Extra top padding so titles clear chrome |

## Keep doing

- Prefer `source: 'cache'` YouTube hits before re-fetch  
- Firebase stays singleton (`getFirebase` cache) — don’t re-init per screen  
- Avoid embedding video files; open YouTube watch URLs only  
- Dev Client for BLE — don’t force ble-plx into Expo Go bundle

## Measure

```bash
npx expo export --platform web   # inspect dist size
npx tsc --noEmit
```
