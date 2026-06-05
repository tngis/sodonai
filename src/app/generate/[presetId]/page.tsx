"use client";

import { use, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, Upload, Camera, AlertTriangle, Check, X, Loader2, CheckCircle2, Plus } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { getPreset, type Category, type Preset } from "@/lib/catalog";
import { banks } from "@/lib/banks";
import { createPaymentIntent, type PaymentIntentResult } from "@/app/actions/payment";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/category-icon";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { QPayDeepLink } from "@/lib/qpay";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MIN_DIMENSION = 256;

function checkDimensions(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width < MIN_DIMENSION || img.height < MIN_DIMENSION) {
        resolve(`"${file.name}" хамгийн багадаа ${MIN_DIMENSION}×${MIN_DIMENSION}px байх ёстой.`);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// Parse a ratio label ("4:3", "16:9") to a numeric aspect (width / height).
// Returns null for "Original"/unknown — the caller falls back to the input image's aspect.
function parseRatio(ratio: string): number | null {
  const m = ratio.match(/^(\d+)\s*:\s*(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  return null;
}

// Example input thumbnail — shows the real preset sample image, falling back
// to the category emoji if the src is missing or fails to load.
function ExampleThumb({ src, fallback }: { src: string; fallback: string }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-muted text-3xl">
        {fallback}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Жишээ оролт"
      className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-foreground/10"
      onError={() => setError(true)}
    />
  );
}

type Step = 1 | 2 | 3;

type PaymentPhase =
  | { kind: "idle" }
  | { kind: "creating" }
  | { kind: "awaiting"; paymentId: string; orderId: string; qrImage: string; deepLinks: QPayDeepLink[] }
  | { kind: "confirmed"; generationId: string };

const POLL_MS = 2500;

export default function GeneratePage({ params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = use(params);
  const { t, lang } = useLang();
  const router = useRouter();

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [category, setCategory] = useState<Category | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [uploads, setUploads] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedBg, setSelectedBg] = useState("");
  const [intensity, setIntensity] = useState(50);
  const [isPrivate, setIsPrivate] = useState(true);
  const [ratio, setRatio] = useState("");
  // Aspect (width / height) of the first uploaded image — used to render the
  // "Original" preview at the real input proportions.
  const [originalAspect, setOriginalAspect] = useState<number | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [payment, setPayment] = useState<PaymentPhase>({ kind: "idle" });

  useEffect(() => {
    getPreset(presetId).then((result) => {
      if (!result) { router.push("/generate"); return; }
      setPreset(result.preset);
      setCategory(result.category);
      setSelectedBg(result.preset.options?.backgroundPresets?.[0] ?? "");
      setIntensity(result.preset.options?.styleIntensityDefault ?? 50);
      setRatio(result.preset.output_ratio);
      setCatalogLoading(false);
    });
  }, [presetId, router]);

  // How many images this preset expects (min required + max cap).
  const minUploads = preset?.required_min ?? 1;
  const maxUploads = preset?.required_max ?? 9;
  const finalFiles = uploads;
  const canContinue = uploads.length >= minUploads;

  // The preset's own output_ratio is always the first (leftmost) chip and the
  // default selection; the rest are common photo ratios the user can switch to.
  const RATIO_CHOICES = ["1:1", "4:3", "3:4", "16:9", "9:16", "4:5", "3:2", "2:3"];
  const ratioOptions = preset
    ? [preset.output_ratio, ...RATIO_CHOICES].filter((v, i, a) => a.indexOf(v) === i)
    : [];

  // Measure the first upload's aspect ratio so "Original" previews at its real shape.
  useEffect(() => {
    const file = uploads[0];
    if (!file) { setOriginalAspect(null); return; }
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => { setOriginalAspect(img.width / img.height); URL.revokeObjectURL(url); };
    img.onerror = () => { URL.revokeObjectURL(url); };
    img.src = url;
  }, [uploads]);

  // Aspect used by the live preview frame: the chosen numeric ratio, else the
  // input image's aspect (for "Original"), else a square fallback.
  const previewAspect = parseRatio(ratio) ?? originalAspect ?? 1;

  // Validate a single image (type, size, min dimensions). Returns error or null.
  const validateFile = useCallback(async (file: File): Promise<string | null> => {
    if (!ALLOWED_TYPES.includes(file.type)) return "Зөвхөн JPEG, PNG, WEBP зураг оруулна уу.";
    if (file.size > MAX_FILE_SIZE) return `"${file.name}" 10MB-аас их байна.`;
    return checkDimensions(file);
  }, []);

  // Validate and APPEND new files to the existing selection (dedupe, capped).
  const validateAndAddFiles = useCallback(async (files: FileList | null) => {
    if (!files || !preset) return;
    const cap = preset.required_max ?? 9;
    const incoming = Array.from(files);
    const valid: File[] = [];
    for (const file of incoming) {
      const err = await validateFile(file);
      if (err) { toast.error(err); return; }
      valid.push(file);
    }
    setUploads((prev) => {
      const merged = [...prev];
      for (const f of valid) {
        if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
      }
      return merged.slice(0, cap);
    });
  }, [preset, validateFile]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      validateAndAddFiles(e.dataTransfer.files);
    },
    [validateAndAddFiles]
  );

  // Poll for payment confirmation once the invoice is created
  useEffect(() => {
    if (payment.kind !== "awaiting") return;
    const { paymentId } = payment;

    const poll = async () => {
      try {
        const res = await fetch(`/api/payment/${paymentId}`);
        if (!res.ok) return;
        const data: { status: string; generationId?: string } = await res.json();
        if (data.status === "paid" && data.generationId) {
          setPayment({ kind: "confirmed", generationId: data.generationId });
          setTimeout(() => router.push(`/progress?id=${data.generationId}`), 800);
        }
      } catch {
        // network hiccup — keep polling
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [payment, router]);

  const handleCreateInvoice = async () => {
    if (!termsAccepted) {
      toast.error("Нөхцлийг зөвшөөрнө үү.");
      return;
    }
    setPayment({ kind: "creating" });

    try {
      const formData = new FormData();
      formData.set("presetId", preset!.id);
      formData.set("amountMnt", String(preset!.price_mnt));
      formData.set("ratio", ratio);
      formData.set("background", selectedBg);
      formData.set("intensity", String(intensity));
      formData.set("isPrivate", String(isPrivate));
      finalFiles.forEach((file, i) => formData.set(`file_${i}`, file));

      const result: PaymentIntentResult = await createPaymentIntent(formData);
      setPayment({
        kind: "awaiting",
        paymentId: result.paymentId,
        orderId: result.orderId,
        qrImage: result.qrImage,
        deepLinks: result.deepLinks,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа. Дахин оролдоно уу.");
      setPayment({ kind: "idle" });
    }
  };

  const stepLabels = [t("uploadStep"), t("optionsStep"), t("paymentStep")];

  if (catalogLoading || !preset || !category) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <button
          onClick={() => (step > 1 ? setStep((s) => (s - 1) as Step) : router.back())}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> {t("back")}
        </button>

        {/* Preset info */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary text-xl">
            <CategoryIcon category={category} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">
              {lang === "mn" ? category.name_mn : category.name_en}
            </p>
            <p className="truncate font-bold">{lang === "mn" ? preset.name_mn : preset.name_en}</p>
          </div>
          <span className="text-lg font-black text-primary">₮{preset.price_mnt.toLocaleString()}</span>
        </div>

        {/* Step indicators */}
        <div className="mb-8 flex items-center">
          {stepLabels.map((label, i) => {
            const n = (i + 1) as Step;
            const done = n < step;
            const active = n === step;
            return (
              <div key={i} className="flex items-center">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ scale: active ? 1.1 : 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                      done
                        ? "bg-primary text-primary-foreground glow-brand-sm"
                        : active
                        ? "border-2 border-primary bg-background text-primary glow-brand-sm"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {done ? <Check size={12} /> : n}
                  </motion.div>
                  <span
                    className={cn(
                      "hidden text-xs font-medium sm:block",
                      active ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className="mx-2 h-0.5 w-8 overflow-hidden rounded-full bg-border sm:w-12">
                    <motion.div
                      className="h-full bg-primary"
                      initial={false}
                      animate={{ width: done ? "100%" : "0%" }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ─── STEP 1: UPLOAD ─── */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <h2 className="text-xl font-bold">{t("uploadImages")}</h2>

            {preset.warnings_mn.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-yellow-500/30 bg-yellow-50/50 p-3 dark:bg-yellow-900/10">
                {preset.warnings_mn.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-300">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Single multi-file dropzone; thumbnails live inside it ── */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "rounded-2xl border-2 border-dashed p-4 transition-all",
                dragOver ? "border-primary bg-primary/10" : "border-border"
              )}
            >
              {uploads.length === 0 ? (
                /* Empty state — whole area is the clickable input */
                <label
                  className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl p-4 text-center transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-primary"
                  aria-label={t("uploadDesc")}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => { validateAndAddFiles(e.target.files); e.target.value = ""; }}
                  />
                  <motion.div
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"
                    animate={dragOver ? { scale: 1.1 } : { scale: 1 }}
                  >
                    <Upload size={20} className="text-muted-foreground" />
                  </motion.div>
                  <div>
                    <p className="font-semibold">{t("uploadDesc")}</p>
                    <p className="text-sm text-muted-foreground">
                      {minUploads === maxUploads ? `${maxUploads} зураг` : `${minUploads}–${maxUploads} зураг`}
                    </p>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                    <Camera size={11} /> {t("cameraCapture")}
                  </Badge>
                </label>
              ) : (
                /* Thumbnails inside the input + an "add more" tile */
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {uploads.map((file, idx) => (
                      <motion.div
                        key={file.name + file.size}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="group relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(file)} alt={file.name} className="h-full w-full object-cover" />
                        <button
                          onClick={() => setUploads((u) => u.filter((_, j) => j !== idx))}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Устгах"
                        >
                          <X size={10} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {uploads.length < maxUploads && (
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40 focus-within:ring-2 focus-within:ring-primary">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={(e) => { validateAndAddFiles(e.target.files); e.target.value = ""; }}
                      />
                      <Plus size={20} />
                      <span className="text-[10px] font-medium">Нэмэх</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Example inputs */}
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">{t("exampleInputs")}</p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {preset.example_inputs.map((src, idx) => (
                  <ExampleThumb key={idx} src={src} fallback={category.icon} />
                ))}
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!canContinue}
              className="w-full rounded-full font-bold bg-primary text-black"
              size="lg"
              variant="shadow"
            >
              {t("continueBtn")} <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        )}

        {/* ─── STEP 2: OPTIONS ─── */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <h2 className="text-xl font-bold">{t("optionsStep")}</h2>

            {/* Output ratio + live preview frame */}
            <div className="flex flex-col gap-3">
              <Label className="font-semibold">{t("outputRatio")}</Label>
              <div className="flex items-center gap-4">
                <div className="flex flex-1 flex-wrap gap-2">
                  {ratioOptions.map((r) => (
                    <motion.button
                      key={r}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setRatio(r)}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                        ratio === r
                          ? "border-primary bg-primary text-primary-foreground glow-brand-sm"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {r}
                    </motion.button>
                  ))}
                </div>
                {/* Live preview frame */}
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-muted/50 ring-1 ring-foreground/10">
                  <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 300, damping: 26 }}
                    className="flex max-h-16 max-w-16 items-center justify-center rounded-md bg-linear-to-br from-primary/30 to-primary/10 ring-1 ring-primary/40"
                    style={{
                      aspectRatio: String(previewAspect),
                      width: previewAspect >= 1 ? "3.5rem" : "auto",
                      height: previewAspect >= 1 ? "auto" : "3.5rem",
                    }}
                  >
                    <span className="text-[9px] font-bold text-primary">{ratio}</span>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Style intensity — controlled slider */}
            {preset.options?.styleIntensityDefault !== undefined && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">{t("styleIntensity")}</Label>
                  <span className="text-sm font-bold text-primary">{intensity}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={10}
                  value={[intensity]}
                  onValueChange={(v) => setIntensity(Array.isArray(v) ? (v as number[])[0] : (v as number))}
                />
              </div>
            )}

            {/* Private toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="font-semibold">{t("privateToggle")}</p>
                <p className="text-xs text-muted-foreground">Зөвхөн та харах боломжтой</p>
              </div>
              <button
                onClick={() => setIsPrivate(!isPrivate)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  isPrivate ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                    isPrivate ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            <Button
              onClick={() => setStep(3)}
              className="w-full rounded-full font-bold bg-primary text-black"
              variant="shadow"
              size="lg"
            >
              {t("continueBtn")} <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        )}

        {/* ─── STEP 3: PAYMENT ─── */}
        {step === 3 && (
          <div className="flex flex-col gap-6">

            {/* ── Payment confirmed ──────────────────────────────── */}
            {payment.kind === "confirmed" && (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                  <CheckCircle2 size={32} className="text-primary-foreground" />
                </div>
                <p className="text-xl font-black">{t("paymentConfirmed")}</p>
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            )}

            {/* ── Waiting for payment (QR shown) ─────────────────── */}
            {payment.kind === "awaiting" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">{t("qpayTitle")}</h2>
                  <button
                    onClick={() => setPayment({ kind: "idle" })}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t("cancelPayment")}
                  </button>
                </div>

                {/* Receipt */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("presetName")}</span>
                      <span className="font-semibold">{lang === "mn" ? preset.name_mn : preset.name_en}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">{t("receiptOrderId")}</span>
                      <span className="font-mono text-xs text-muted-foreground">{payment.orderId.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                      <span className="font-bold">{t("totalPrice")}</span>
                      <span className="text-xl font-black text-primary">₮{preset.price_mnt.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* QPay QR */}
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-6">
                  <p className="text-sm font-semibold text-muted-foreground">{t("qpayDesc")}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={payment.qrImage}
                    alt="QPay QR code"
                    className="h-48 w-48 rounded-xl"
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" />
                    <span>{t("paymentWaiting")}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70">{t("paymentAwaitDesc")}</p>
                </div>

                {/* Bank deep links from QPay */}
                <div>
                  <p className="mb-3 text-sm font-semibold">{t("bankApps")}</p>
                  <div className="flex flex-wrap gap-2">
                    {payment.deepLinks.map((dl) => {
                      const bank = banks.find((b) => b.nameMn === dl.name);
                      return (
                        <a
                          key={dl.name}
                          href={dl.link}
                          className="flex h-12 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted"
                        >
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                            style={{ background: bank?.color ?? "#666" }}
                          >
                            {dl.name.slice(0, 1)}
                          </div>
                          <span className="whitespace-nowrap">{dl.name}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ── Idle: show summary + terms + pay button ─────────── */}
            {(payment.kind === "idle" || payment.kind === "creating") && (
              <>
                <h2 className="text-xl font-bold">{t("qpayTitle")}</h2>

                {/* Order summary */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("presetName")}</span>
                      <span className="font-semibold">{lang === "mn" ? preset.name_mn : preset.name_en}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                      <span className="font-bold">{t("totalPrice")}</span>
                      <span className="text-xl font-black text-primary">₮{preset.price_mnt.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Terms checkbox */}
                <div className="flex items-start gap-3 rounded-xl border border-border p-4">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(v) => setTermsAccepted(!!v)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="terms" className="cursor-pointer text-sm leading-relaxed text-muted-foreground">
                    {t("termsCheckbox")}
                  </Label>
                </div>

                <Button
                  onClick={handleCreateInvoice}
                  disabled={!termsAccepted || payment.kind === "creating"}
                  className="w-full rounded-full font-bold bg-primary text-black"
                  size="lg"
                  variant="shadow"
                >
                  {payment.kind === "creating" ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Нэхэмжлэл үүсгэж байна...</>
                  ) : (
                    t("payGenerate")
                  )}
                </Button>
              </>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
