# aistudio.mn — UI / UX Roadmap

> Goal: a modern, "cool", late-2025-AI-platform feel — depth, motion, 3D/visual objects,
> glow around the `#D1FE18` brand — while fixing the UX gaps and visible bugs in the
> current prototype.
>
> Backend/data work lives in `TODO.md`. This file is purely look-feel-and-interaction.

---

## 0. Bugs to fix first (visible today)

- [x] **Bottom nav active state** — Gallery/Orders now have their own routes; active match uses `pathname.startsWith(href)` + an `also` list (Generate stays active on `/category/*`). Profile removed entirely.
- [x] **Profile tabs** — superseded: Profile deleted, Gallery/Orders/Settings are separate routes; no `?tab=` sync needed.
- [x] **Localized back buttons** — auth + generate route through `t("back")` / `t("generate")`.
- [x] **Language persistence** — `LanguageContext` hydrates from `localStorage` + cookie (done in Phase 0).
- [x] **Theme toggle desync** — `Header` uses a `mounted` guard, renders a stable icon until hydrated.
- [x] **Style-intensity slider** — now controlled (`value={[intensity]}`).
- [~] **Emoji placeholders** — preset cards now show `example_output` with emoji fallback; gallery/output use real signed images. Hero/featured still use emoji until real sample art is added.

---

## 1. Design system & visual language

- [ ] **Pick a clear aesthetic direction**: dark-first, high-contrast, with the lime `#D1FE18` as a glowing accent (not a flat fill). Define when brand color is glow vs. fill vs. text.
- [ ] **Depth & surfaces**: introduce layered surfaces — subtle glass/blur cards, soft inner/outer shadows, 1px highlight borders. Move away from flat `border-border` boxes everywhere.
- [ ] **Brand glow utilities**: reusable `glow-brand` (box-shadow + blur halo) for CTAs, active states, and hero objects.
- [ ] **Grain/noise overlay** + subtle animated gradient mesh background for hero and key sections (the "AI platform" texture).
- [ ] **Typography scale**: stronger display hierarchy — oversized hero headline, tighter tracking, a distinctive display weight. Add a second accent font if it fits the brand.
- [ ] **Spacing & radius rhythm**: audit the radius scale already in `globals.css` (`--radius-*`) and apply consistently; pick 2–3 radii max per screen.
- [ ] **Iconography**: consistent stroke widths; consider duotone/filled-on-active treatment site-wide (already started in bottom nav).

---

## 2. Motion & animation (add `framer-motion`)

- [ ] **Add `framer-motion`** (or the Motion lib) as the animation foundation.
- [ ] **Page/route transitions**: fade+slide between routes; shared-element transition from preset card → generate header.
- [ ] **Scroll-reveal** on Home sections (categories, featured, how-it-works, CTA) — stagger children in on enter.
- [ ] **Stepper transitions** in the Generate flow: animate step 1→2→3 (slide/scale), animated progress connector fill.
- [ ] **Micro-interactions**: button press (scale 0.97), hover lift on cards, icon taps, toggle spring animation, ripple on primary CTA.
- [ ] **Number/counter animations** for prices, stats, queue position, progress %.
- [ ] **Skeleton shimmer** loaders for gallery/orders/output while data loads (replace bare `Skeleton` blocks with branded shimmer).
- [ ] **Respect `prefers-reduced-motion`** — gate non-essential motion.

---

## 3. "Objects" / 3D & hero visuals

- [ ] **Hero centerpiece**: an animated visual object — options in priority order:
  - Spline/Three.js floating 3D object (camera, photo frame, orb) reacting to cursor/scroll.
  - Or a lighter CSS/SVG: floating glassy photo cards with parallax + glow (cheaper, mobile-safe).
- [ ] **Parallax / cursor-follow** on hero objects and category cards (desktop), disabled on touch.
- [ ] **Floating example-photo cloud**: real before/after thumbnails drifting behind the hero headline.
- [ ] **Animated brand blob/mesh** replacing the two static blurred circles currently in `page.tsx`.
- [ ] Keep all of the above **mobile-performant** (iPhone Safari is the primary surface) — lazy-load heavy 3D, fall back to static on low-power.

---

## 4. Per-screen UX upgrades

### Home (Discover)
- [~] Category thumbnails — cards animate/hover-lift; still emoji (no real art yet).
- [x] Featured carousel: snap scrolling + edge-fade mask (native drag-scroll). Autoplay-on-idle not added.
- [x] Social proof results-wall marquee (`ResultsMarquee`) with rating line.

### Category detail
- [x] Animated **ratio filter chips** with live result count (shown when >1 distinct ratio).
- [x] **Before/After comparison slider** (`components/before-after.tsx`) on single-subject preset cards (clip-path, drag + keyboard).

### Generate flow (the money path)
- [x] Richer **dropzone**: per-slot named targets ("1-р хүн" …) for multi-input presets, single animated dropzone otherwise, animated thumbnails, per-slot check badges. (Reorder + per-file progress ring not added.)
- [ ] **Image cropper/aligner** — not done (needs a crop lib).
- [x] Options: **color-swatch** background presets + **live ratio preview frame**.
- [~] Payment: animated waiting state ✓; QR is a mock SVG; bank chips are colored letter-circles (real logos need assets).
- [x] **Sticky bottom action bar** on mobile for step CTAs.

### Progress
- [x] Branded generative orb (orbiting particles + glow), animated % counter, crossfading MN tips.

### Output
- [x] Result lightbox with **arrows + drag-swipe** between results, dots, keyboard nav. (Pinch-zoom not added.)
- [ ] **Before/After reveal** — not done on output (original input not surfaced here; slider component exists if we add it).
- [x] Download/Save/Share/Regenerate real; spring success banner + staggered grid.
- [x] Celebratory **confetti** on completion.

### Settings
- [x] Animated language pill (layoutId), `whileTap` theme cards with glow; grouped cards with icon headers.

### Auth
- [x] OTP: paste-to-fill ✓, per-digit fill animation, **success check** when complete, **animated resend countdown ring**. (Error shake skipped — mock has no wrong-code path.)

---

## 5. Global polish & quality

- [ ] **Empty / error / loading states** for every data surface (consistent illustrated style).
- [ ] **Toasts**: brand-styled `sonner` (glow, icon, position) instead of defaults.
- [ ] **Modal/lightbox**: focus trap, scroll lock, backdrop blur, ESC + swipe-to-close.
- [ ] **Haptics** (where supported) on key mobile taps — pay, capture, download.
- [ ] **PWA install + splash** so it feels native on iPhone (also in `TODO.md`).
- [ ] **Responsive QA pass**: 375 / 430 / 768 / 1024 / 1280 / 1536px, portrait + landscape — no overflow, no clipped text, no overlap (spec hard requirement).
- [ ] **Accessibility**: visible focus rings, contrast on lime-on-white, `aria` for toggles/dropzone/stepper, keyboard nav through the whole flow.
- [ ] **Performance budget**: lazy-load 3D/animation, optimize images (`next/image`), avoid layout shift; keep LCP fast on mobile.

---

## Suggested order

1. **Section 0** — fix the visible bugs. Quick wins, stop it looking broken.
2. **Section 1 + 2** — design system + framer-motion foundation (everything else builds on these).
3. **Section 4 (Generate → Output)** — polish the money path first.
4. **Section 3** — hero 3D/objects for the "wow" landing.
5. **Section 5** — global polish, a11y, responsive QA.

---

## ✅ Done in this pass (2026-05-29)

**Foundation**
- `motion` (Framer Motion v12) installed; `MotionConfig reducedMotion="user"` wraps the app (`components/providers.tsx`). Dark-first default theme.
- Design system in `globals.css`: `.glow-brand` / `.glow-brand-sm` / `.glow-brand-hover`, `.text-glow`, `.glass` / `.glass-strong`, `.grain` noise overlay, `.mesh-bg` animated gradient, `.shimmer`, and keyframes (`mesh-shift`, `shimmer`, `float-y`, `pulse-glow`) + a global `prefers-reduced-motion` guard.
- Reusable motion primitives: `Reveal` / `RevealStagger` / `RevealItem` (scroll reveal), `AnimatedCounter`, `SegmentedTabs` (layoutId indicator), `Celebrate` (confetti), `app/template.tsx` (route fade/slide), `HeroVisual` (floating glass cards).

**Per-screen**
- **Home**: animated mesh+grain hero, floating glass-card centerpiece, staggered headline, glow CTA, scroll-reveal sections, glass category cards with hover lift, snap-scroll featured carousel.
- **Generate**: animated stepper (spring scale + connector fill), color-swatch background presets, animated upload thumbnails (AnimatePresence), `whileTap` chips, glow CTAs.
- **Progress**: branded generative orb (orbiting particles + glow core), animated % counter, crossfading tips.
- **Output**: confetti on completion, spring success banner, staggered result grid, animated lightbox.
- **Gallery/Orders**: staggered entrances, glass rows, animated lightbox, branded shimmer skeletons.
- **Settings**: animated language pill (layoutId), `whileTap` theme cards with glow.
- **Auth**: spring-in glowing logo.

**Global**
- Button: universal press micro-interaction (`active:scale-[0.97]`).
- Skeleton: branded shimmer sweep instead of pulse.
- Toaster: top-center, glass blur, brand-tinted success.
- a11y: `aria-label`s on icon buttons, `role`/keyboard on dropzone, `aria-live` progress, dialog roles + Esc on lightboxes.
- `eslint.config.mjs`: `set-state-in-effect` downgraded to warn (app's intentional on-mount fetch pattern). `tsc`, `eslint` (0 errors), and `next build` all green.

**Still open**: real sample imagery for hero/featured (emoji fallback today), Spline/Three.js 3D option, before/after comparison sliders, category filters, image cropper, haptics, PWA icon PNGs, full multi-breakpoint responsive QA.
