# Staten Island Snow Removal — Winter Signup (iOS + Android)

Capacitor project for **App Store** and **Google Play**. Customers open a native app: logo splash (1.5s fade) → winter contact form. Each signup is saved by your hosted Node API and emailed to **statenislandsnowremovals@gmail.com**.

This repo is **not** a public website product. The `www/` folder is the Capacitor web layer bundled into the native shells. The Node server is the **backend only** (plus a private admin page for you).

> Store submission is **not** done yet. This project is ready for you to open in Android Studio / Xcode, point at a hosted API, and build.

## Project layout

| Path | Purpose |
|------|---------|
| `www/` | Customer app UI (splash, form, logo) — Capacitor `webDir` |
| `www/config.js` | **`API_BASE_URL`** for the hosted HTTPS API |
| `www/logo.png` | Finalized yeti logo |
| `server.js` | Node API: `POST /api/signups`, admin list, CSV, Gmail send |
| `public/admin.html` | Staff admin UI (served by the API host, not the store app) |
| `android/` | Android Studio project (after `npx cap add android`) |
| `ios/` | Xcode project (after `npx cap add ios` — needs a Mac to build) |
| `capacitor.config.json` | appId `com.statenislandsnowremoval.signup` |
| `.env` | SMTP + admin secrets (**never commit**; already gitignored) |

## What you still need (accounts + hosting)

1. **Apple Developer Program** (~$99/year) — to archive and upload to App Store Connect  
2. **Google Play Console** (one-time developer fee) — to upload an AAB  
3. **Hosted HTTPS API** — Railway, Render, Fly.io, or similar (phones cannot call `localhost`)  
4. **Gmail App Password** on the **host** (env vars `SMTP_*`) so signup emails reach the catchall  
5. A **Mac with Xcode** for iOS builds (Android can build on Windows/Linux/Mac with Android Studio)

## Quick start (local API)

```bash
cd sisr-signup
npm install
cp .env.example .env   # fill SMTP_* on a machine that can reach smtp.gmail.com
npm start
```

- Signup UI (for browser testing only): http://localhost:3847/  
- Admin: http://localhost:3847/admin  

## Capacitor sync

```bash
npm install
npm run cap:sync
```

That runs `scripts/sync-www.js` then `npx cap sync`.

### First-time platform folders

```bash
npx cap add android
npx cap add ios      # works to generate files on Linux; BUILDING requires macOS + Xcode
npx cap sync
```

## Point the app at your hosted API (required for store builds)

1. Deploy `server.js` (and `package.json` deps, `data/`, `.env`) to Railway / Render / Fly.  
2. Set host env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_TO`, `MAIL_FROM`, `ADMIN_PASSWORD`, `PORT`.  
3. Edit `www/config.js`:

```js
window.SISR_CONFIG = {
  API_BASE_URL: 'https://YOUR-REAL-HOST.example.com'
};
```

4. Re-run `npm run cap:sync`, then rebuild in Android Studio / Xcode.

Optional debug override on a device:  
`localStorage.setItem('SISR_API_BASE_URL', 'https://...')` — still prefer baking the URL into `config.js` for production.

## Android (Google Play)

1. Install [Android Studio](https://developer.android.com/studio) + SDK.  
2. From this repo:

```bash
npm run cap:sync
npx cap open android
```

3. In Android Studio: wait for Gradle sync → **Build → Build Bundle(s) / APK(s)** → **Android App Bundle** for Play.  
4. Create the app in Play Console with package name **`com.statenislandsnowremoval.signup`**.  
5. Upload the `.aab`, complete store listing, content rating, privacy policy if required.

App icons: replace defaults under `android/app/src/main/res/mipmap-*` with your logo assets before release.

## iOS (App Store)

1. On a **Mac**: install Xcode + CocoaPods.  
2. From this repo:

```bash
npm run cap:sync
npx cap open ios
```

3. In Xcode: select the **App** target → Signing & Capabilities → your Team.  
4. Bundle ID must match **`com.statenislandsnowremoval.signup`** (or change both here and in `capacitor.config.json`, then `cap sync`).  
5. Product → Archive → Distribute to App Store Connect.

If `ios/` was generated on Linux, open/sync again on the Mac so CocoaPods and signing work cleanly:

```bash
npx cap sync ios
cd ios/App && pod install && open App.xcworkspace
```

## Backend email behavior

On `POST /api/signups` the server:

1. Validates fields  
2. Appends to `data/signups.json`  
3. Emails **MAIL_TO** (default catchall) via Gmail SMTP  
4. If SMTP fails or is unset, queues to `data/email-outbox.json` and still returns success for the saved signup  

**Never put SMTP passwords inside the mobile app.** Only on the host.

## Form fields

| Field | Required |
|-------|----------|
| Name | yes |
| Address | yes |
| Email | yes |
| Phone | yes |
| Preferred contact (Call / Text / Email) | yes |
| Service type (Driveway / Sidewalk / Both) | yes |
| Spec of work / notes | optional |

## Branding

- Colors: navy `#0b1f3a`, ice blue, orange accents  
- Splash: full-screen logo, **1.5s opacity fade**, then form  
- Capacitor native splash is disabled (`launchShowDuration: 0`) so the HTML splash is what users see  

## Security notes

- Change `ADMIN_PASSWORD` before exposing the API publicly  
- Keep `.env` off git and out of the app binary  
- Prefer HTTPS only for `API_BASE_URL`  

## Scripts

| Script | Action |
|--------|--------|
| `npm start` | Run API + static www/admin |
| `npm run build:web` | Verify www/ before sync |
| `npm run cap:sync` | Sync web assets into android/ios |
| `npm run cap:android` | Sync + open Android Studio |
| `npm run cap:ios` | Sync + open Xcode (Mac) |
