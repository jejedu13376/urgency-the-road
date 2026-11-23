# Firebase CDN / npm snippets (web)

Reference only — Expo app uses `EXPO_PUBLIC_FIREBASE_*` from local `.env` (gitignored). **Never commit real keys.** Placeholders only below.

**Not a deploy guide.** CLI deploy (rules / indexes / functions) → repo `docs/FIREBASE-DEPLOY.md`. Post-secrets order → `docs/DEPLOY-CHECKLIST.md`.

App wiring: `src/firebase/config.ts` reads the same seven `EXPO_PUBLIC_FIREBASE_*` keys (Auth + Firestore). Analytics via CDN/`getAnalytics` is **web-only**; the RN app does not call it.

## CDN

```html
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-analytics.js";

  const firebaseConfig = {
    apiKey: "<from-console>",
    authDomain: "<project-id>.firebaseapp.com",
    projectId: "<project-id>",
    storageBucket: "<project-id>.firebasestorage.app",
    messagingSenderId: "<from-console>",
    appId: "<from-console>",
    measurementId: "<from-console>"
  };

  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
```

## npm install

```bash
npm install firebase
```

## Modular SDK (npm / bundler)

```js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
```
