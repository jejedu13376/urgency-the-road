# Google Play Console — publish urgency road one

One-time **$25 USD** Google Play developer registration (card required). After that, free to upload apps (subject to Google’s policies).

## 1. Create the developer account

1. Open https://play.google.com/console/signup
2. Sign in with the Google account that will own the app.
3. Accept the Developer Distribution Agreement.
4. Pay the **$25 one-time** registration fee.
5. Complete identity / contact details Google asks for (may take hours–days to verify).

## 2. Create the app listing

1. In Play Console → **Create app**.
2. App name: `urgency road one`
3. Default language, app or game → **App**, free or paid.
4. Accept declarations (Play policies, US export laws).

## 3. Store listing (required before review)

Fill **Main store listing**:

- Short + full description
- App icon (512×512)
- Feature graphic (1024×500)
- At least 2 phone screenshots
- Privacy policy URL (required if the app collects data; even a blank app often needs a simple policy page)

Also complete **App content** questionnaires (ads, target audience, data safety, etc.).

## 4. Upload the Android App Bundle

1. Build an AAB with EAS (see project README): `eas build -p android --profile production`
2. Play Console → your app → **Production** (or Testing → Internal testing first).
3. **Create new release** → upload the `.aab`
4. Set release name / notes → review → start rollout (or promote from internal testing).

Package name in this project: `com.axarel.urgencyroadone` (must stay unique forever; cannot change after first upload).

## 5. Recommended first path

1. **Internal testing** track → add your Gmail as tester → install from the opt-in link.
2. When the blank app installs fine, promote to **Closed** / **Production**.

## User-side checklist

- [ ] Pay $25 at Play Console signup
- [ ] Wait for account verification if prompted
- [ ] Create app “urgency road one”
- [ ] Finish store listing + data safety
- [ ] `eas build -p android --profile production`
- [ ] Upload AAB → internal test → production
