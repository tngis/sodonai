import type { CapacitorConfig } from "@capacitor/cli";

// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ⚠️  TEMPORARY placeholder appId — `mn.sodonai.app.placeholder`.          │
// │     This MUST be finalized to the real reverse-DNS id (likely            │
// │     `mn.sodonai.app` or `com.sodonai.app`, pending the locked domain)    │
// │     BEFORE any TestFlight / Play Store submission. See                   │
// │     docs/capacitor-milestone-1.md → "Finalize the appId" for the exact   │
// │     three places to change (this file + iOS bundle id + Android          │
// │     applicationId).                                                      │
// └─────────────────────────────────────────────────────────────────────────┘
const config: CapacitorConfig = {
  appId: "mn.sodonai.app.placeholder",
  appName: "Sodon AI",

  // Capacitor requires a non-empty webDir to copy into the native projects.
  // With `server.url` set, the webview loads the hosted SSR app instead, so the
  // shell here is only an offline fallback (see capacitor-shell/index.html).
  webDir: "capacitor-shell",

  // Thin remote shell: the WebView loads the deployed SSR app (server actions,
  // RSC, middleware, route handlers all run on the server). The native Capacitor
  // bridge is auto-injected into the remote page. https only — Supabase SSR
  // cookies are Secure+SameSite=Lax and would be dropped over cleartext.
  server: {
    url: "https://sodonai.vercel.app",
    cleartext: false,
  },

  plugins: {
    // Config-only: applied natively at launch (no Next code change). Overlay
    // mode pairs with the app's env(safe-area-inset-*) padding (header pt / nav
    // pb). Theme-aware status-bar color would require importing the plugin in
    // the Next app — deferred.
    StatusBar: {
      overlaysWebView: true,
      style: "DEFAULT",
    },
  },
};

export default config;
