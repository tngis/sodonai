# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Next.js version warning (from AGENTS.md):** This repo runs Next.js 16 with React 19.
> APIs and file conventions differ from older Next.js. Read the relevant guide under
> `node_modules/next/dist/docs/` before writing framework code. Concrete examples already in this repo:
> middleware is now **`src/proxy.ts`** (exports `proxy()` + `config`, not `middleware()`);
> route/page `params` are a **`Promise`** you must `await`; background work uses
> **`after()`** from `next/server`.

## Commands

```bash
npm run dev      # dev server (http://localhost:3000)
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint (flat config, eslint.config.mjs)
```

There is **no test framework** configured — no `test` script and no test runner in `package.json`. Don't assume `npm test` exists.

Path alias: `@/*` → `src/*`.

## What this is

`aistudio.mn` — a **Mongolian-first** consumer web app for AI photo generation and physical photo printing, paid via QPay. The product audience is Mongolian, so **user-facing strings and thrown error messages are written in Mongolian Cyrillic** (e.g. `throw new Error("Нэвтэрч орно уу.")`). Match that convention; UI copy is centralized in `src/lib/i18n.ts` (mn/en, mn default) and consumed via `useLang()` from `src/contexts/LanguageContext.tsx`.

## Architecture

### Three external services
- **Supabase** — Postgres (with RLS) + Auth. Schema lives in `supabase/migrations/` (numbered SQL, apply in order).
- **Cloudflare R2** (S3-compatible) — all image storage. **Mid-migration off Supabase Storage**; see the migration note below.
- **QPay** — Mongolian QR payment gateway. **Mocked by default** (`QPAY_MOCK !== "false"`).

### Supabase clients — pick the right one
- `src/lib/supabase/client.ts` — browser, anon key, RLS enforced.
- `src/lib/supabase/server.ts` — `createClient()`, RSC/route handlers, reads the user's cookies, RLS enforced. Use `supabase.auth.getUser()` (never `getSession()`) to authenticate.
- `src/lib/supabase/admin.ts` — `createAdminClient()`, **service-role key, bypasses RLS, server-only**. Used for privileged writes (flipping order/generation status, reading `internal_prompt`).

### Auth & route protection
`src/proxy.ts` is the auth proxy (Next 16's renamed middleware). It refreshes the Supabase session and gates `PROTECTED_ROUTES` plus `/generate/<presetId>` (the `/generate` index and `/category/*` are public catalog browsing). Auth itself (`src/app/auth/page.tsx`) supports email/password and phone OTP; SMS goes through Skytel (`SKYTEL_*` env). Admin gating is separate: `src/lib/auth-admin.ts` (`requireAdmin` for pages, `assertAdmin` for server actions) checks `users.is_admin`.

### The generation pipeline (core flow)
Order → payment → AI generation, all keyed off the `orders` table:
1. **`src/app/actions/payment.ts`** `createPaymentIntent()` — creates a `pending` order, uploads source images to R2, stores upload paths in `orders.options_snapshot`, creates a QPay invoice + `payments` row, returns QR/deep-links.
2. **`src/app/api/payment/[id]/route.ts`** — the client **polls** this. On payment confirmation it flips the order to `paid`, creates a `queued` generation, and kicks off `runGeneration()` via `after()` (runs after the response is sent). *(QPay webhooks at `src/app/api/webhooks/qpay/route.ts` are stubbed; polling is the live path.)*
3. **`src/app/actions/generation.ts`** `runGeneration()` — uses the **admin client**, presigns the uploads, calls `callAI()`, stores outputs to R2, sets `generations.status=done` + `result_urls`, marks the order `completed`, and auto-inserts gallery `assets`. Failures set `status=failed` with the error. Progress is written to the row (0→10→20→80→100); the client polls `src/app/api/generation/[id]/route.ts`.

`src/app/actions/generation.ts` also exposes a direct `submitOrder()` path that skips payment (also via `after()`), used where generation runs without the pay step.

### AI provider abstraction
`src/lib/ai/generate.ts` — `callAI({ model, imageUrls, prompt, options })` routes by `model` string to an **adapter**. `ADAPTERS` maps known model ids (e.g. `chatgpt-2-image` → OpenAI Images *edits* endpoint, which re-encodes inputs to sRGB PNG via `sharp`); everything else falls back to a generic gateway (`AI_API_URL`). With no API key configured, adapters return a mock image after a delay, so local dev works end-to-end. **To add a provider: write an adapter and register it in `ADAPTERS`.** The model is chosen per-preset (`presets.ai_model`), not by the user.

### Storage facade & the R2 migration (in progress)
`src/lib/supabase/storage.ts` is the storage entry point (importers like `generation.ts`/`payment.ts` are unaware of the backend). Buckets: `uploads` (private source images), `outputs` (private results + avatars), `examples` (public). Keys are `{userId}/{...}` so the **first path segment is the owner** — authorization checks rely on this (see `src/app/actions/storage.ts` `getOutputUrls`).

R2 private objects can only be presigned **server-side** (secret key never reaches the browser; `src/lib/r2/client.ts` is `server-only`). The old browser-side `supabase.storage.createSignedUrls()` was replaced by the `getOutputUrls` server action. During migration, `getSignedUrls()` does a **dual read**: HEAD the object in R2, else fall back to a Supabase signed URL; `removeFiles()` deletes from both. These fallbacks (and `*.supabase.co` in `next.config.ts` `remotePatterns`) are temporary — remove once the one-time copy (`scripts/r2-migrate.sh`) is verified and Supabase buckets are emptied.

### Catalog & the internal_prompt boundary
Categories and presets live in Postgres. The client reads via `src/lib/catalog.ts` (in-memory cached, `invalidateCatalog()` after admin edits) against the **`presets_public` view**, which strips `internal_prompt`. `internal_prompt` (the real AI instruction) is **never exposed to the client** — only server code reads it through the admin client (`src/lib/presets-server.ts`). Preserve this boundary when touching presets.

### Print orders
Physical print orders reuse the same `orders`/`payments`/QPay machinery via an `orders.kind` discriminator (`generation` | `print`); print orders have no preset and are fulfilled manually by an admin. Frame/size catalog is in code (`src/lib/print-catalog.ts`), addresses + fulfillment tracking are in the DB (migration `0010`).

## Conventions
- **Server-only secrets:** modules touching R2 secrets, service-role key, or `internal_prompt` import `"server-only"`. Keep them out of any `"use client"` import graph.
- **Background work:** use `after()` from `next/server` to run generation after the HTTP response — don't block the response on the AI call.
- **Migrations** are plain SQL files applied in numeric order; there's no ORM. New tables need RLS policies (every existing table enables RLS with owner-scoped policies).
- **UI:** shadcn (`style: base-nova`, components in `src/components/ui`), Tailwind v4 (config-less, `src/app/globals.css`), `next-themes` (dark default), Motion (`motion/react`), Lucide icons, Sonner toasts.
- **Canonical Tailwind classes (no needless arbitrary values):** write the shortest form the theme already provides — the Tailwind v4 language server flags the rest as `suggestCanonicalClasses`.
  - CSS variables use the shorthand, not `var()` brackets: `text-(--neu-text)`, `shadow-(--shadow-card)` — **not** `text-[var(--neu-text)]`. (Multi-value brackets like `shadow-[inset_…,var(--x)]` stay arbitrary — the shorthand only covers a single bare variable.)
  - Sizes that land on a scale step use the utility, not raw px. Spacing is the default `0.25rem` step, so `w-[280px]` → `w-70`, `min-w-[96px]` → `min-w-24`. Radius is **customized** in `globals.css` (`sm 4px · md 8px · lg 16px · xl 24px · 2xl 30px · 3xl 40px · 4xl full`), so `rounded-[24px]` → `rounded-xl` (not `3xl`). Off-scale values (e.g. `rounded-t-[23px]`, `text-[10px]`, `ring-[3px]`) have no canonical — leave them arbitrary.
