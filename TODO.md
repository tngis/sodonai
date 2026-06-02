# aistudio.mn — Roadmap to a Production AI Platform

> Promptless, picture-first AI photo app for Mongolian users.
> This document tracks the work to turn the current **frontend prototype** into a real, paying-customer platform.

---

## Current state (2026-05-29)

Phases 0–4 are complete. The app has a real backend:

- Supabase auth (email + session), protected routes via proxy middleware, auto-created `public.users` rows on sign-up.
- Files uploaded to private Supabase Storage buckets; AI generation pipeline wired (`AI_API_URL` env var, mock mode while key is pending).
- QPay payment flow: real invoice creation, QR + bank deep links, server-side payment polling, generation only starts after payment confirmed. Mock auto-approves after 5s (`QPAY_MOCK=false` to go live).
- Profile page shows real gallery (signed URLs), orders (live status), payments history. Settings has working Export (JSON download) and Delete account (cascade + storage purge).
- `/terms` and `/privacy` pages live. Sign-out calls `supabase.auth.signOut()` everywhere.

**Remaining gaps before public launch**: real Skytel OTP (Phase 1), real AI API key, real QPay credentials, Phase 5 hardening.

---

## Phase 0 — Foundations ✅

- [x] **Wire up Supabase**: `src/lib/supabase/client.ts` (browser) and `server.ts` (`@supabase/ssr`) created; types in `src/lib/supabase/types.ts`; `.env.example` updated with all required vars.
- [x] **Add proxy**: `src/proxy.ts` — session refresh via `getUser()`, protects `/generate`, `/profile`, `/settings`, `/output`, `/progress`; redirects auth→home when already logged in.
- [x] **Database schema**: `supabase/migrations/0001_initial_schema.sql` — enums, all 6 tables, RLS policies, `updated_at` trigger, seed data for categories/presets. `presets_public` view uses `security_invoker = true`.
- [x] **Row-Level Security**: enabled on all tables; owner-only policies for `users`, `orders`, `payments`, `generations`, `assets`; public read on `categories`/`presets`.
- [x] **Storage buckets**: `supabase/migrations/0002_storage.sql` — private `uploads` + `outputs` buckets with RLS policies (idempotent).
- [x] **User trigger**: `supabase/migrations/0003_user_trigger.sql` — auto-creates `public.users` row on Supabase auth sign-up; backfills existing auth users.
- [x] **Persist language**: `LanguageContext.tsx` — hydrates from `localStorage` on mount, writes cookie for SSR; fixed `t()` array handling.

## Phase 1 — Real auth (Skytel OTP)

- [ ] Replace the fake OTP with **phone OTP via Skytel SMS** — server action/route to send code, store hashed code with 60s expiry, verify, then create Supabase session.
- [ ] Real **rate limiting** on send/verify (per phone + IP) to prevent SMS abuse.
- [ ] Handle returning vs. new user (name step) from actual DB lookup.

## Phase 2 — Upload & generation pipeline ✅

- [x] **Upload images to Supabase Storage** (private bucket, signed URLs); validate type/size/dimensions (min 256×256); real per-slot previews.
- [x] **Generation backend**: `src/lib/ai/generate.ts` calls `AI_API_URL`; mock returns placeholder images when key not set; `internalPrompt` server-only in `presets-server.ts`.
- [x] **Job queue + real progress**: `after()` triggers `runGeneration` post-response; `generations.status` (queued → processing → done/failed) with DB progress updates; polling route `/api/generation/[id]`.
- [x] **Output page from real data**: signed URLs, Download (fetch+blob), Save to Gallery, Share (Web Share API / clipboard), Regenerate, Report.
- [x] **Failure states**: generation failure written to DB; Progress and Output pages handle `failed` status with retry messaging.

## Phase 3 — Payments (QPay) ✅

- [x] **QPay integration**: `src/lib/qpay.ts` — real invoice creation (mock: `QPAY_MOCK=true` default, auto-approves after 5s); real QR image + bank deep links replace CSS-grid placeholder. Set `QPAY_MOCK=false` + credentials to go live.
- [x] **Payment flow**: `createPaymentIntent` server action uploads files, creates order + payment record, creates QPay invoice. Step 3 UI polls `/api/payment/[id]` every 2.5s; generation only starts after payment confirmed server-side.
- [x] **Webhook stub**: `/api/webhooks/qpay` — receives QPay callback (TODO: add HMAC signature verification when going live).
- [x] **Receipts**: order ID, amount, preset name shown on payment screen and in Profile → Payments history.
- [x] **No-refund enforcement**: business logic enforced server-side (generation starts only after `order.status = paid`); checkbox is UI reminder only.

## Phase 4 — Account surfaces ✅

- [x] **Profile**: real Gallery from `assets` table (signed URLs, download/share on hover), Orders with live status + preset name, Payments history — all `MOCK_` arrays removed.
- [x] **Settings → Account**: shows real user name/email loaded from `public.users` + `auth.getUser()`.
- [x] **Settings → Privacy**: **Export** downloads a JSON of all user data (orders, payments, asset count); **Delete account** two-step confirm → deletes storage files + `auth.admin.deleteUser()` (cascades all DB rows).
- [x] **Notifications**: removed fake red dot from bell; notifications section honestly says "coming soon."
- [x] **Terms of Service** (`/terms`) and **Privacy Policy** (`/privacy`) pages — linked from Settings and payment checkbox.
- [x] **Sign-out**: calls `supabase.auth.signOut()` in Header dropdown and Settings page (was a dead link before).

## Phase 5 — Quality, hardening, "modern platform" polish ✅ (partial)

- [~] **Responsive** — code reviewed; no obvious breakpoint bugs found. Needs real-device testing at 375/430/768/1024/1280/1536px before launch.
- [x] **Accessibility**: dropzone has `role="button"`, `tabIndex`, `aria-label`, keyboard Enter/Space handler; progress bar uses `role="progressbar"` + `aria-live="polite"`; output lightbox has `role="dialog"` + Escape key; Header buttons have `aria-label`; MobileBottomNav has `aria-current="page"` + `aria-label` on `<nav>`.
- [x] **Error boundaries**: `src/app/error.tsx` (segment-level) and `src/app/global-error.tsx` (root-level) added with structured error logging and user-facing retry UI.
- [x] **SEO/PWA**: root layout has full `metadata` (OG, Twitter, manifest, apple-web-app) + dual `themeColor`; `public/manifest.json` with icons, shortcuts, screenshots; per-route layouts export `metadata` for auth, generate, profile, settings; terms and privacy pages already had metadata.
- [x] **Observability**: structured JSON logs (`event`, `generationId`, `orderId`, `ts`) on generation.started / ai_call / done / failed and payment.poll / confirmed. Compatible with Datadog, Cloud Logging, etc. Sentry can be wired later with `NEXT_PUBLIC_SENTRY_DSN`.
- [x] **CI**: `.github/workflows/ci.yml` — runs `tsc --noEmit` + `eslint` + `next build` on push/PR to main.
- [x] **Security hardening**: QPay webhook now verifies HMAC-SHA256 signature (`QPAY_WEBHOOK_SECRET` env var) using `timingSafeEqual` to prevent timing attacks; enforced when secret is set, logged + 401 when invalid. RLS reviewed — all tables owner-only; `presets_public` view uses `security_invoker = true`; service-role key used server-side only; signed URLs expire in 1h.
- [ ] **Unit tests** — vitest setup and tests for `lib/i18n`, `lib/data`, `lib/utils` helpers not yet written.
- [ ] **Admin/catalog** — category/preset management without code edits not yet implemented.
- [ ] **Icons** — `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` need to be created (192×192, 512×512, 180×180 PNG files with the aistudio brand mark).
