# Capacitor — Milestone 1 (remote shell) + on-device verification

> Status: scaffolding complete. The native app is a **thin shell** that loads the
> hosted SSR app (`server.url = https://aistudio.mn`). No `src/` code changed.

---

## ⚠️ FINALIZE THE appId BEFORE ANY STORE SUBMISSION

The project is scaffolded with a **deliberately temporary** placeholder appId:

```
mn.sodonai.app.placeholder
```

The appId / bundle id **cannot be changed after a build is submitted to
TestFlight or the Play Store** (it is the app's permanent identity). Finalize it
to the real reverse-DNS id (likely `mn.sodonai.app` or `com.sodonai.app`, pending
the locked domain) by editing **all three** places, then re-syncing:

| # | File | What to change |
|---|------|----------------|
| 1 | `capacitor.config.ts` | `appId: "mn.sodonai.app.placeholder"` → final id |
| 2 | `ios/App/App.xcodeproj/project.pbxproj` | `PRODUCT_BUNDLE_IDENTIFIER` (**2 occurrences** — Debug + Release). Easiest via Xcode: target **App → Signing & Capabilities → Bundle Identifier**. |
| 3 | `android/app/build.gradle` | both `namespace` **and** `applicationId` |

Then:

```bash
npx cap sync
```

> Note: editing `capacitor.config.ts` alone is **not** enough — `npx cap sync`
> updates the mirrored `capacitor.config.json` but does **not** rewrite the iOS
> bundle id or Android `applicationId` (those are only set when the platform is
> first added). The native edits (#2, #3) are manual.

---

## What Milestone 1 added

**New (all outside the Next runtime — `src/` untouched):**

| Path | Purpose |
|------|---------|
| `capacitor.config.ts` | appId (placeholder), `server.url`, StatusBar config |
| `capacitor-shell/index.html` | placeholder `webDir` — offline fallback only; not served while online |
| `ios/` | generated Xcode project (committed source; Pods/build artifacts gitignored) |
| `android/` | generated Gradle project (committed source; `.gradle`/build artifacts gitignored) |
| `package.json` | `@capacitor/{core,cli,ios,android,status-bar}` @ **v7** (pinned — Node 20/21 compatible; v8 CLI needs Node ≥22) |
| `tsconfig.json` / `eslint.config.mjs` | exclude/ignore `ios`, `android`, `capacitor-shell` |

**Untouched:** all of `src/`, `next.config.ts`, `src/proxy.ts`, server actions,
route handlers, `src/lib/r2/*`, `src/lib/supabase/*`. Server-only boundaries and
the generation/payment pipeline are unchanged. StatusBar is config-only, so even
the safe-area cosmetic needed no Next edit.

---

## Running on a device

```bash
npx cap sync          # run after any config / dependency change
npx cap open ios      # → Xcode: pick a device, set a dev signing Team, Run
npx cap open android  # → Android Studio: pick a device, Run
```

**`server.url` target:** `https://aistudio.mn` (production). To test unreleased
changes, point `server.url` at a deployed preview/staging **or an https tunnel**
(e.g. ngrok) — **never `http://<LAN-IP>`**: the Supabase session cookies are
`Secure`+`SameSite=Lax` and would be dropped over cleartext, failing the auth
check below for the wrong reason.

---

## On-device verification checklist (the two browser-untestable assumptions)

Run on a **real iOS device** (Xcode) and a **real Android device** (Android
Studio). Inspect with **Safari → Develop → \<device\> → \<webview\>** (iOS) and
**`chrome://inspect`** (Android). Prereqs: a working email/password account and
at least one image already in the gallery.

### ✅ (a) Supabase cookie session persists + proxy refreshes across a cold start

*Why on-device:* WebView cookie-store persistence across process death, and
`Secure`/`SameSite` handling, can't be reproduced in a desktop browser.

1. Launch → sign in with email/password.
2. Confirm authed: header shows the avatar/account drawer; open a **protected
   route** (`/gallery` or `/wallet`) — it loads **without** bouncing to `/auth`
   (proves the SSR proxy read the cookie server-side).
3. **Cold start:** fully kill the app (iOS swipe-close / Android force-stop — not
   just background), relaunch.
4. **Token refresh:** (optionally lower the Supabase access-token TTL for the
   test) leave idle past expiry, then hit a protected route again.

**PASS**
- After cold start the app reopens **still signed in**; `/gallery` loads with no
  redirect, no re-login.
- After token expiry, navigation **silently refreshes** (no forced re-login).
- Inspector: `sb-…-auth-token` cookie present in Application → Cookies; the
  protected-route request returns **200**, not a **307** to `/auth`.

**FAIL**
- Relaunch lands on `/auth`, or protected routes 307 to `/auth`, or the auth
  cookie is missing after cold start → WebView didn't persist cookies (watch for
  the known WKWebView `Set-Cookie`-on-XHR / app-bound-domain quirk). Remediation
  (if needed) is `CapacitorCookies` config — **not built in this milestone**,
  just diagnosed.

### ✅ (b) R2 presigned image DISPLAY renders (and record CORS state)

*Why on-device:* confirms private signed URLs actually render in the WebView and
surfaces the R2 CORS posture before the (deferred) download work.

1. Signed in, open `/gallery` (and `/output` for a result) where private R2
   outputs render via signed URLs.
2. In the device webview inspector console, run `fetch('<a signed URL>')` and
   watch the Network/console — this probes CORS independently of display.

**PASS (milestone goal)** — images **render** (no broken-image icons). `<img>` /
next-image display needs no CORS, so this passes whenever the signed https URL is
reachable from the device.

**CORS result is recorded, not gating:**
- console `fetch` succeeds → R2 bucket CORS already allows the origin (deferred
  download/share is unblocked later).
- console `fetch` throws a CORS error → R2 bucket CORS must be added (allow the
  app origin, plus `capacitor://localhost` / `https://localhost` if ever moved to
  a static bundle) **before** building the download feature.

**FAIL** — broken images → network reachability, expired/invalid signed URL, or
blocked host (check the request status in Network). This **would** block
Milestone 1 and must be investigated before proceeding.

---

## StatusBar / safe-area

`capacitor.config.ts` sets `StatusBar.overlaysWebView: true` (config-only). This
pairs with the app's existing `env(safe-area-inset-*)` padding (header `pt`, nav
`pb`) from the responsive batch. Verify on a notched device that the header sits
**below** the status bar and the bottom nav clears the home indicator. A dynamic,
theme-aware status-bar color (matching `next-themes`) would require importing
`@capacitor/status-bar` **in the Next app** — deferred.

---

## Deferred (kept on the list — NOT built in Milestone 1)

- **QPay bank deep-links** → `@capacitor/app-launcher` + iOS
  `LSApplicationQueriesSchemes` / Android `<queries>` (blocker only at real-QPay
  time; still mocked).
- **Poll-on-resume + QR-state restore** (`visibilitychange` / `@capacitor/app`
  resume listener).
- **Camera permissions** (iOS `NSCameraUsageDescription` /
  `NSPhotoLibraryUsageDescription`, Android perms) + `@capacitor/camera` for
  reliable Android capture.
- **R2 download/share** via `@capacitor/filesystem` + `@capacitor/share`, plus R2
  bucket CORS for the webview origin (see (b) above).
- **Android hardware back-button** handler (`@capacitor/app` `backButton` → close
  sheet/dialog → `router.back()` → exit at root).
- **Dynamic theme-aware status-bar color** (needs `@capacitor/status-bar`
  imported in the Next app).
