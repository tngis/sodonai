# aistudio.mn — Бүтээгдэхүүн болж гарах хүртэлх бүрэн TASK LIST

> Зорилго: одоогийн prototype + backend-ийг **жинхэнэ мөнгө төлдөг хэрэглэгчид ашигладаг live бүтээгдэхүүн** болгох.
> Энэ файл нь `TODO.md` (backend) болон `TODO-UI-UX.md` (дизайн)-ийг нэгтгэж, нэмж **гэрээ, эрх зүй, deploy, marketing, ажиллагаа**-г бүрэн хамруулсан.
> Сүүлд шинэчилсэн: 2026-06-04

**Тэмдэглэгээ:** `[ ]` хийгдээгүй · `[~]` хагас · `[x]` дууссан · 🔴 launch-д ЗААВАЛ хэрэгтэй (blocker) · 🟡 launch-д сайн байх · 🟢 launch-ийн дараа болно

---

## A. ХУУЛЬ, ЭРХ ЗҮЙ, БИЗНЕС БҮРТГЭЛ (хамгийн түрүүнд — энэ дуусаагүй бол доорх гэрээнүүд эхлэхгүй)

- [ ] 🔴 **Хуулийн этгээд / ХХК бүртгэл** — QPay merchant болон банкны данс нээхэд ХХК эсвэл хувиараа бизнес эрхлэгчийн гэрчилгээ шаардлагатай. Татварын албанд бүртгүүлэх.
- [ ] 🔴 **Бизнесийн дансны данс нээх** — орлого хүлээн авах банкны данс (QPay settlement энд орно).
- [ ] 🔴 **Татварын бүртгэл (НӨАТ/ХХОАТ)** — цахим үйлчилгээний орлогын татварын дэглэмийг тодорхойлох; и-баримт (НӨАТ) системд холбогдох эсэхийг шийдэх.
- [ ] 🔴 **И-баримт (ebarimt) интеграц** — Монголд төлбөрийн дараа и-баримт олгох хууль шаардлага. QPay-тэй хослуулан баримт автоматаар үүсгэх эсэхийг шалгах. (Үүнгүй бол татварын зөрчил.)
- [ ] 🟡 **Хэрэглэгчийн гэрээ (Terms of Service)-г хуульчаар хянуулах** — одоо `/terms` хуудас бий, гэхдээ хуульчийн review хийлгэх (буцаалтгүй нөхцөл, хариуцлага).
- [ ] 🟡 **Нууцлалын бодлого (Privacy Policy)-г хуульчаар хянуулах** — зураг (хувийн биометрик дата) хадгалах, устгах бодлого Монголын "Хувь хүний мэдээлэл хамгаалах тухай хууль"-д нийцэж байгаа эсэх.
- [ ] 🟡 **Зураг ашиглах зөвшөөрөл/contour** — хэрэглэгчийн царайны зургийг AI-д өгөх зөвшөөрөл, дата хадгалах хугацаа, гуравдагч AI провайдерт дамжуулах эсэхийг Terms-д тодорхой бичих.
- [ ] 🟢 **Контентийн бодлого** — насанд хүрээгүй, садар самуун, бусдын зургийг зөвшөөрөлгүй ашиглахыг хориглох дүрэм, гомдол барагдуулах журам.

---

## B. ГУРАВДАГЧ ТАЛЫН ДАНС, ГЭРЭЭ, КРЕДЕНШЛ (long lead-time — эрт эхлүүл)

### B1. QPay (төлбөр)
- [ ] 🔴 **QPay merchant гэрээ байгуулах** — qpay.mn-тэй merchant болох гэрээ, KYC бичиг баримт.
- [ ] 🔴 **Production QPay credentials авах** — `QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_INVOICE_CODE`.
- [ ] 🔴 **`QPAY_MOCK=false` болгож live горимд шилжүүлэх** (`src/lib/qpay.ts` бэлэн, зөвхөн credential + flag).
- [ ] 🔴 **QPay webhook callback URL бүртгүүлэх** — production домэйн дээрх `/api/webhooks/qpay`-г QPay портал дээр тохируулах.
- [ ] 🔴 **`QPAY_WEBHOOK_SECRET` тохируулах** — HMAC verify код бэлэн (`src/app/api/webhooks/qpay/route.ts`), зөвхөн secret өгөх.
- [ ] 🔴 **Жинхэнэ QPay QR + банкны deep link тест** — Khan, Golomt, TDB, Xac, State Bank апп бүрээр бодит төлбөр туршиж амжилттай эсэхийг шалгах.
- [ ] 🟡 **Settlement / тооцоо нийлэх процесс** — QPay-аас данс руу мөнгө орох хугацаа, шимтгэлийн хувь баталгаажуулах.

### B2. Skytel SMS (OTP)
- [ ] 🔴 **Skytel SMS gateway гэрээ** — SMS API эрх авах, sender ID бүртгүүлэх.
- [ ] 🔴 **Production credentials** — `SKYTEL_API_URL`, `SKYTEL_API_KEY`.
- [ ] 🔴 **OTP илгээх/шалгах backend бичих** (одоо fake) — доорх C1 хэсгийг үз.
- [ ] 🟡 **SMS зардлын тооцоо** — нэг SMS-ийн үнэ × хүлээгдэж буй хэрэглэгчийн тоо; rate limit-аар хамгаалах.

### B3. AI зураг үүсгэх backend
- [ ] 🔴 **AI провайдер сонгох ба данс нээх** — (жишээ: Replicate, fal.ai, эсвэл өөрийн Stable Diffusion / Flux server, эсвэл Gemini/Nano-banana image API). Face-preserving, image-to-image дэмждэг байх ёстой.
- [ ] 🔴 **Production AI credentials** — `AI_API_URL`, `AI_API_KEY`.
- [ ] 🔴 **`src/lib/ai/generate.ts`-ийг жинхэнэ провайдерт тааруулах** — mock-оос live болгох, response формат (URL/base64) шалгах.
- [ ] 🔴 **Preset internalPrompt бүрийг бодит загвар дээр тааруулах** — гэр бүл (multi-face), сэргээх (restoration), ID зураг тус бүрийн чанарыг бодит загвар дээр шалгаж, prompt-ийг засах (`src/lib/presets-server.ts`).
- [ ] 🔴 **AI зардал vs үнэ тооцоо** — generation бүрийн API зардал < борлуулах үнэ (₮1,900–3,900) эсэхийг баталгаажуулах. Ашиггүй preset-үүдийг үнээ засах.
- [ ] 🟡 **NSFW / content moderation filter** — AI гаралт ба оролтыг шүүх (хууль ёсны эрсдэл).
- [ ] 🟡 **Concurrency / queue limit** — олон хэрэглэгч зэрэг үүсгэх үед AI backend-ийн rate limit, queue удирдлага.

---

## C. ХӨГЖҮҮЛЭЛТ (Development)

### C1. Auth — жинхэнэ Skytel OTP (Phase 1, ОДОО FAKE) 🔴
- [ ] **OTP илгээх server action/route** — 6 оронтой код үүсгэх, hash хийж 60 сек хугацаатай хадгалах (DB эсвэл Redis), Skytel-ээр SMS илгээх.
- [ ] **OTP шалгах** — код таарвал Supabase session үүсгэх (phone-based auth).
- [ ] **Rate limiting** — нэг утас + IP-д хязгаар (SMS abuse-аас хамгаалах).
- [ ] **Шинэ vs буцаж ирсэн хэрэглэгч** — DB-ээс шалгаж нэр асуух алхмыг шийдэх.
- [ ] **Утасны дугаар засах flow** — session алдалгүй буцах (UI бэлэн, backend холбох).
- [ ] **+976 country code, формат шалгалт** баталгаажуулах.

### C2. Admin / каталог удирдлага 🟡
- [ ] **Admin хуудас** — код засалгүйгээр category/preset нэмэх, засах, идэвхгүй болгох.
- [ ] **Admin эрхийн хяналт** — зөвхөн admin role-той хэрэглэгч (RLS / route guard).
- [ ] **Preset бүрийн зураг (example input/output) upload хийх UI**.
- [ ] **Үнэ, ETA, идэвхтэй эсэхийг admin-аас тохируулах**.
- [ ] **Захиалга / төлбөрийн dashboard** — өдрийн борлуулалт, амжилттай/амжилтгүй generation харах.

### C3. Контент ба бодит зураг (одоо emoji placeholder) 🔴
- [ ] **Preset бүрийн жинхэнэ before/after жишээ зураг** — гэр бүл, сэргээх, ID, фон солих. (Хэрэглэгч худалдаж авахаасаа өмнө үр дүнг харах ёстой — энэ нь conversion-ийн гол хүчин зүйл.)
- [ ] **Hero / featured хэсгийн бодит дээж зураг** (одоо emoji fallback).
- [ ] **Results marquee / social proof-д бодит үр дүнгийн зураг**.
- [ ] **Банкны жинхэнэ лого** — Khan, Golomt, TDB, Xac, State Bank (одоо өнгөт үсэгтэй дугуй) — `src/lib/banks.ts`.
- [ ] **PWA icons** — `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (192/512/180px, брэнд тэмдэгтэй).
- [ ] **OG / share зураг** — Facebook/Messenger дээр share хийхэд харагдах зураг.
- [ ] **Каталогийн эцсийн жагсаалт ба үнэ** — launch-д гарах preset-үүд, MN үнэ эцэслэх.

### C4. UI/UX дуусгах (`TODO-UI-UX.md`-ээс үлдсэн) 🟡
- [ ] **Дизайн системийн чиглэл эцэслэх** — brand glow vs fill дүрэм, depth/glass surfaces.
- [ ] **Hero 3D/visual centerpiece** (Spline/Three.js эсвэл хөнгөн CSS/SVG parallax).
- [ ] **Зураг cropper/aligner** — generate flow-д (crop lib хэрэгтэй).
- [ ] **Before/After reveal output хуудсанд**.
- [ ] **Бүх empty / error / loading state-үүд** тогтвортой загвартай.
- [ ] **Brand-styled toasts** (sonner glow/icon).
- [ ] **Modal focus trap, scroll lock, swipe-to-close**.
- [ ] **Haptics** — pay/capture/download дээр (дэмжсэн төхөөрөмж дээр).
- [ ] 🟢 Number/counter animation, skeleton shimmer бүх surface дээр.

### C5. Чанар, тест, hardening (Phase 5) 🔴/🟡
- [ ] 🔴 **Responsive QA pass** — 375 / 430 / 768 / 1024 / 1280 / 1536px, portrait + landscape бодит төхөөрөмж дээр (spec-ийн hard requirement: ямар ч overflow/clip/overlap байж болохгүй).
- [ ] 🔴 **End-to-end төлбөрийн тест** — upload → options → QPay төлбөр → generation → output → gallery бүтэн урсгалыг жинхэнэ мөнгөөр.
- [ ] 🔴 **OTP бодит тест** — жинхэнэ утсанд SMS ирэх, resend, timeout.
- [ ] 🟡 **Unit tests (vitest)** — `lib/i18n`, `lib/catalog`, `lib/utils` (`TODO.md`-д дурдсан).
- [ ] 🟡 **E2E tests (Playwright)** — гол money path автоматжуулах.
- [ ] 🟡 **Accessibility audit** — focus ring, lime-on-white contrast, keyboard nav бүтэн урсгалаар.
- [ ] 🟡 **Performance budget** — LCP мобайл дээр хурдан, `next/image` оптимизаци, layout shift байхгүй, 3D lazy-load.
- [ ] 🟡 **Error monitoring (Sentry)** — `NEXT_PUBLIC_SENTRY_DSN` холбох (observability log-ууд бэлэн).
- [ ] 🟡 **Load test** — нэгэн зэрэг олон хэрэглэгч (auth, payment poll, generation queue).

### C6. Аюулгүй байдал 🔴
- [ ] **Production secrets management** — бүх key-г Vercel/hosting env-д аюулгүй хадгалах, git-д орохгүй.
- [ ] **Supabase RLS production review** — бүх table owner-only, service-role зөвхөн server дээр (бэлэн, дахин шалгах).
- [ ] **Rate limiting** — auth, payment, generation API дээр (abuse, cost protection).
- [ ] **CORS / webhook signature** — QPay webhook HMAC enforce (бэлэн, secret тохируулах).
- [ ] **Хувийн зураг хадгалах хугацаа** — устгах policy (signed URL 1ц, bucket private — бэлэн).
- [ ] 🟢 **Security review** — гадны audit эсвэл `/security-review` ажиллуулах.

---

## D. ДЭД БҮТЭЦ / DEVOPS

- [ ] 🔴 **Production Supabase project** — dev-ээс тусдаа production project үүсгэх.
- [ ] 🔴 **Migration-ууд production дээр ажиллуулах** — `0001_initial_schema`, `0002_storage`, `0003_user_trigger`.
- [ ] 🔴 **Production storage buckets** — `uploads`, `outputs` private + RLS (migration бэлэн).
- [ ] 🔴 **Seed data** — category/preset production DB-д (эцсийн каталогоор).
- [ ] 🔴 **Бүх production env var** — `.env.example`-ийн жагсаалтыг hosting дээр бүрэн нөхөх.
- [ ] 🟡 **Database backup** — Supabase автомат backup идэвхжүүлэх.
- [ ] 🟡 **CI** — `.github/workflows/ci.yml` (tsc + eslint + build) бэлэн; PR бүр дээр ажиллаж байгаа эсэхийг шалгах.
- [ ] 🟡 **Staging орчин** — production-той ижил тусдаа preview орчин.
- [ ] 🟢 **Log aggregation** — structured JSON log-ийг Datadog/Cloud Logging руу (бэлэн, холбох).

---

## E. DEPLOYMENT (нийтэд гаргах)

- [ ] 🔴 **Домэйн худалдаж авах** — `aistudio.mn` (.mn домэйн — Datacom/MonNIC-ээс). Боломжтой эсэхийг шалгах.
- [ ] 🔴 **Hosting сонгох ба deploy** — Vercel (Next.js-д хамгийн тохиромжтой) дээр deploy хийх.
- [ ] 🔴 **DNS тохиргоо** — домэйнийг Vercel рүү заах (A/CNAME record).
- [ ] 🔴 **SSL / HTTPS** — Vercel автоматаар, баталгаажуулах.
- [ ] 🔴 **Production env vars hosting дээр** — Supabase, QPay, Skytel, AI бүх key.
- [ ] 🔴 **QPay webhook URL-г production домэйноор шинэчлэх**.
- [ ] 🔴 **Supabase Auth redirect/allowed URLs** — production домэйн нэмэх.
- [ ] 🔴 **`next.config.ts` image domains** — Supabase storage + AI provider домэйн зөвшөөрөх.
- [ ] 🟡 **Production smoke test** — deploy хийсний дараа бүх гол хуудас, money path ажиллаж байгаа эсэх.
- [ ] 🟡 **robots.txt / sitemap.xml** — SEO.
- [ ] 🟡 **www → apex redirect** (эсвэл эсрэгээр) тохируулах.
- [ ] 🟢 **Uptime monitoring** — (UptimeRobot гэх мэт) сайт унасан үед мэдэгдэх.

---

## F. ШИНЖИЛГЭЭ / ANALYTICS / SUPPORT

- [ ] 🟡 **Analytics суулгах** — Vercel Analytics эсвэл Plausible/PostHog (хэрэглэгчийн funnel: нүүр → preset → upload → pay).
- [ ] 🟡 **Conversion funnel хэмжилт** — хаана хэрэглэгч унаж байгааг харах (ялангуяа payment дээр).
- [ ] 🟡 **Customer support суваг** — Facebook page Messenger, эсвэл утас/имэйл; гомдол/буцаалтын хүсэлт хүлээн авах.
- [ ] 🟡 **FAQ / Тусламж** — settings доторх Help хэсгийг бодит контентоор дүүргэх.
- [ ] 🟢 **Хэрэглэгчийн санал хүсэлт цуглуулах** механизм.

---

## G. ЛАУНЧИЙН ӨМНӨХ ТЕСТ (Beta / Soft launch)

- [ ] 🔴 **Дотоод бүрэн тест** — багийн гишүүд жинхэнэ утас, жинхэнэ төлбөрөөр бүх preset туршина.
- [ ] 🟡 **Хаалттай beta** — 10–30 жинхэнэ хэрэглэгч (танил/гэр бүл) урьж бодит ашиглуулах, санал авах.
- [ ] 🟡 **Бодит зураг дээр AI чанарын үнэлгээ** — монгол хүний царай хадгалах чанар хангалттай эсэх (энэ нь продакттын гол).
- [ ] 🟡 **Төлбөр буцаалт / маргааны кейс тест** — амжилтгүй generation үед юу болохыг шалгах.
- [ ] 🟡 **Ачаалал ихтэй үеийн тест** (хэд хэдэн хэрэглэгч зэрэг).

---

## H. MARKETING / БРЭНД / ЛАУНЧ

### H1. Брэнд ба контент
- [ ] **Лого, брэнд гайд эцэслэх** (одоо logo бий).
- [ ] **Facebook бизнес хуудас** — Монголын зорилтот хэрэглэгч энд байгаа (spec: "Facebook болон Messenger дээр share хийдэг").
- [ ] **Instagram / TikTok данс** — before/after видео контент.
- [ ] **Demo видео** — апп хэрхэн ажилладаг (3 tap: preset → upload → pay) богино видео.
- [ ] **Before/after контент банк** — олон жишээ зураг/видео (гэр бүл, сэргээх, ID).

### H2. Influencer / нөлөөлөгч
- [ ] **Зорилтот influencer-ийн жагсаалт** — гэр бүлийн, гэрэл зурагчин, лайфстайл блогер (монгол).
- [ ] **Influencer-тэй гэрээ/deal** — апп ашиглаж бодит үр дүн харуулсан бичлэг хийлгэх.
- [ ] **Промо код / referral** — influencer бүрт хэмжих код өгөх.
- [ ] **UGC (хэрэглэгчийн контент)** — хэрэглэгчид үр дүнгээ share хийхийг урамшуулах.

### H3. Лаунч кампанит ажил
- [ ] **Soft launch зарлал** — Facebook дээр анхны зарлал.
- [ ] **Facebook/Instagram төлбөртэй сурталчилгаа** — зорилтот audience (25–55, Монгол, iPhone).
- [ ] **Лаунчийн онцгой урамшуулал** — анхны хэрэглэгчдэд хямдрал/үнэгүй эхний generation.
- [ ] **PR / мэдээ** — технологийн/стартап мэдээллийн сувгаар.
- [ ] **App Store / Play Store** (хэрэв PWA-аас цааш native/TWA хийх бол) — 🟢 ирээдүйд.

### H4. Лаунчийн дараах өсөлт
- [ ] **Хэмжилт ба давталт** — CAC, conversion, давтан худалдан авалт.
- [ ] **Шинэ preset нэмэх** — хэрэглэгчийн эрэлтээр (хурим, найз нөхөд, амьтан гэх мэт).
- [ ] **Улирлын кампанит ажил** — Цагаан сар, шинэ жил гэх мэт гэр бүлийн зураг эрэлттэй үе.

---

## I. ЛАУНЧИЙН ДАРААХ АЖИЛЛАГАА (Operations)

- [ ] **AI зардал vs орлогын өдөр тутмын хяналт** — alert тохируулах (зардал давсан үед).
- [ ] **Амжилтгүй generation-ийн хяналт** — error rate өндөр бол мэдэгдэх.
- [ ] **Төлбөрийн тооцоо нийлэх** — QPay settlement сар бүр баталгаажуулах.
- [ ] **Татвар / и-баримтын тайлан** — сар/улирал бүр.
- [ ] **Хэрэглэгчийн дэмжлэг** — Messenger/имэйлд хариу өгөх SLA.
- [ ] **Аюулгүй байдлын patch** — Next.js/Supabase/dependency шинэчлэлт тогтмол.

---

## ЭН ТЭРГҮҮНИЙ ЛАУНЧ BLOCKER-УУД (🔴 эдгээргүйгээр гарч болохгүй)

1. ХХК/бизнес бүртгэл + банкны данс + и-баримт (A хэсэг)
2. QPay merchant гэрээ + production credentials + webhook (B1)
3. Skytel SMS гэрээ + бодит OTP backend (B2 + C1)
4. AI провайдер + бодит generation + зардлын баталгаа (B3)
5. Бодит before/after жишээ зураг (C3 — conversion-д амин чухал)
6. Домэйн + Vercel deploy + production Supabase + env (D + E)
7. End-to-end бодит төлбөр/OTP/generation тест + responsive QA (C5, G)

> **Санал болгох дараалал:** A → B (зэрэг эхлүүл, lead-time урт) → C1/C3 (auth + контент) → D/E (deploy) → G (тест) → H (marketing) → I (ажиллагаа).
