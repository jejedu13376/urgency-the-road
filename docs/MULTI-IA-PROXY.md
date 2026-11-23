# Multi-IA server proxy — deploy guide (Lorenzo)

**Code:** `firebase/functions/` (HTTPS Cloud Function `multiIa`)  
**Client:** `EXPO_PUBLIC_MULTI_IA_PROXY_URL` only — **never** put OpenAI/Anthropic/etc. in `EXPO_PUBLIC_*`  
**Auth:** every `POST` requires `Authorization: Bearer <Firebase ID token>` (Module 15 sign-in)  
**Formations:** out of scope — do not deploy from that project.

Cloud agents **cannot** `firebase login` or set your provider secrets. This ships the code + exact steps; you run deploy once.

---

## Contract (matches `src/services/ai/multiIaRouter.ts`)

| | |
| --- | --- |
| Method | `POST` |
| Body | `{ "engine": "Claude"\|"Gemini"\|"GPT-4o"\|"Grok"\|"Mistral"\|"DeepSeek", "prompt": string, "context"?: string }` |
| Auth | `Authorization: Bearer <Firebase ID token>` |
| Success `200` | `{ "summary": string, "likelyParts": string[], "severity": "info"\|"warn"\|"critique", "engine", "provider", "latencyMs" }` |
| Health | `GET` → `{ ok, enginesConfigured, … }` (no secrets) |

URL after deploy looks like:

```text
https://us-central1-<PROJECT_ID>.cloudfunctions.net/multiIa
```

Paste that into app `.env`:

```bash
EXPO_PUBLIC_MULTI_IA_PROXY_URL=https://us-central1-<PROJECT_ID>.cloudfunctions.net/multiIa
```

Then `npx expo start -c`.

---

## Exact secrets Lorenzo must set

Set **only the providers you use**. Missing key → that engine returns HTTP `503` (`provider/missing-key`); others still work. Client falls back to heuristic for failed engines.

| Secret / env name | Engine | Where to get it |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Claude | https://console.anthropic.com/ |
| `OPENAI_API_KEY` | GPT-4o | https://platform.openai.com/api-keys |
| `GEMINI_API_KEY` | Gemini | Google AI Studio / GCP Generative Language API |
| `GOOGLE_AI_API_KEY` | Gemini (alias) | same as above |
| `XAI_API_KEY` | Grok | https://console.x.ai/ |
| `GROK_API_KEY` | Grok (alias) | same |
| `MISTRAL_API_KEY` | Mistral | https://console.mistral.ai/ |
| `DEEPSEEK_API_KEY` | DeepSeek | https://platform.deepseek.com/ |

Optional overrides (defaults in code): `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`, `XAI_MODEL`, `MISTRAL_MODEL`, `DEEPSEEK_MODEL`, `MULTI_IA_CORS_ORIGIN`.

**Do not** commit real values. Template: `firebase/functions/.env.example`.

---

## Deploy steps

### 1. Prerequisites

```bash
npm i -g firebase-tools
firebase login
cd /path/to/urgency-the-road
firebase use   # or: firebase use "$(grep '^EXPO_PUBLIC_FIREBASE_PROJECT_ID=' .env | cut -d= -f2)"
```

Enable **Blaze** (pay-as-you-go) on the Firebase project — Cloud Functions require it.

### 2. Install + build functions

```bash
cd firebase/functions
npm install
npm run build
cd ../..
```

### 3. Set secrets (pick one method)

**A — Google Cloud Console (fastest; no code edit)**

1. Deploy once without keys (function comes up; engines return `503` until keys exist).
2. Cloud Console → **Cloud Functions** → `multiIa` → **Edit** → Runtime → **Environment variables** or **Secrets**.
3. Add names from the table above (exact spelling) → Deploy revision.

**B — Firebase Secret Manager + bind in code**

```bash
# Repeat for each key you have (paste when prompted)
firebase functions:secrets:set OPENAI_API_KEY --project urgency-road
# … ANTHROPIC_API_KEY, GEMINI_API_KEY, XAI_API_KEY, MISTRAL_API_KEY, DEEPSEEK_API_KEY
```

Then edit `firebase/functions/src/secrets.ts`: uncomment `defineSecret(...)` for those names, push them into `BOUND_SECRETS`, rebuild, redeploy.

### 4. Deploy the function

```bash
firebase deploy --config firebase/firebase.json --only functions:multiIa
```

Copy the printed HTTPS URL into `.env` as `EXPO_PUBLIC_MULTI_IA_PROXY_URL`.

### 5. Smoke test

```bash
# Health (no auth)
curl -sS "$EXPO_PUBLIC_MULTI_IA_PROXY_URL"

# Live vote (need a real ID token from a signed-in user)
curl -sS -X POST "$EXPO_PUBLIC_MULTI_IA_PROXY_URL" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"engine":"GPT-4o","prompt":"bruit de roulement avant droit","context":"camion 2018 diesel 400k km"}'
```

App: Module 15 sign-in → Module 6 Multi-IA → run diagnostic → expect `source: live` when proxy + key OK.

---

## Security notes

- Provider keys stay on the server; the Expo bundle only gets the proxy URL.
- Unsigned callers get `401` — required so strangers cannot burn your LLM budget.
- Prompt/context length capped server-side (~4k chars each).
- Upstream provider failures → `502`; missing key → `503`.

---

## Related

- Client router: `src/services/ai/multiIaRouter.ts`
- Env template (app): `.env.example`
- Firestore deploy: `docs/FIREBASE-DEPLOY.md`
- Backend overview: `docs/BACKEND-SETUP.md`
