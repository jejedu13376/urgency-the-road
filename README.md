# urgency road one (Android)

Expo (React Native) app under Axarel. Blank home screen only.

Package: `com.axarel.urgencyroadone`

## Run (dev)

```bash
cd Axarel/urgency-road-one
npm install
npx expo start
```

Press `a` for Android emulator, or scan the QR code with **Expo Go** on a phone.

## Build AAB (Play Store)

```bash
npm i -g eas-cli
eas login
eas build:configure
eas build -p android --profile production
```

Download the `.aab` from the EAS build page when finished.

## Google Play Console ($25 one-time)

Full steps: [`docs/google-play-console.md`](docs/google-play-console.md)

1. https://play.google.com/console/signup → pay **$25 USD** once → verify account  
2. Create app “urgency road one”  
3. Complete store listing + App content / Data safety  
4. Upload the AAB (prefer Internal testing first, then Production)

## Test APK (EAS preview)

See [`docs/apk-build.md`](docs/apk-build.md). Needs a free Expo login, then:

```bash
npx eas-cli login
npx eas-cli build -p android --profile preview
```

Download the APK from the Expo build page when finished.
