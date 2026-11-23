# Multi-IA proxy (Firebase Functions)

HTTPS function `multiIa` — server-side LLM fan-out for Module 6.

- **Client URL env:** `EXPO_PUBLIC_MULTI_IA_PROXY_URL`
- **Deploy + secrets:** [`docs/MULTI-IA-PROXY.md`](../../docs/MULTI-IA-PROXY.md)

```bash
npm install
npm run build
firebase deploy --config ../firebase.json --only functions:multiIa
```
