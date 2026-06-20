"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Check, Plus, Loader2, CheckCircle2, Frame as FrameIcon, MapPin, ImageOff, Wallet, QrCode } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { getOutputUrls } from "@/app/actions/storage";
import { listAddresses } from "@/app/actions/addresses";
import { createPrintIntent, payPrintWithWallet } from "@/app/actions/print";
import { getWalletBalance } from "@/app/actions/wallet";
import { formatMnt } from "@/lib/wallet";
import { formatAddress } from "@/lib/address";
import { FRAMES, SIZES, findFrame, findSize, priceFor, DEFAULT_FRAME_ID, DEFAULT_SIZE_ID } from "@/lib/print-catalog";
import { banks } from "@/lib/banks";
import { AddressForm } from "@/components/print/address-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { QPayDeepLink } from "@/lib/qpay";
import type { Database } from "@/lib/supabase/types";

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];

interface GalleryItem {
  path: string;
  url: string;
  generationId: string | null;
}

type PaymentPhase =
  | { kind: "idle" }
  | { kind: "choosing" }
  | { kind: "creating" }
  | { kind: "awaiting"; paymentId: string; orderId: string; qrImage: string; deepLinks: QPayDeepLink[] }
  | { kind: "confirmed" };

const POLL_MS = 2500;

// Tune these to adjust the size-responsive live preview.
const PREVIEW_CATALOG_MAX_CM = 60;
const PREVIEW_SCALE_MIN = 0.58;
const PREVIEW_SCALE_MAX = 1.0;
const PREVIEW_BASE_REM = 18;

// Parse "2:3" → aspect (w/h); default to 3/4 portrait.
function ratioToAspect(ratio: string): number {
  const m = ratio.match(/^(\d+):(\d+)$/);
  return m ? Number(m[1]) / Number(m[2]) : 3 / 4;
}

function PrintConfigurator() {
  const { t, lang } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const presetAsset = params.get("asset");
  const presetGen = params.get("gen");

  const [loading, setLoading] = useState(true);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [frameId, setFrameId] = useState(DEFAULT_FRAME_ID);
  const [sizeId, setSizeId] = useState(DEFAULT_SIZE_ID);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Wallet (default) vs QPay. Balance loads with the gallery/addresses.
  const [method, setMethod] = useState<"wallet" | "qpay">("wallet");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const [payment, setPayment] = useState<PaymentPhase>({ kind: "idle" });

  const frame = findFrame(frameId)!;
  const size = findSize(sizeId)!;
  const price = priceFor(sizeId, frameId);
  const selected = gallery.find((g) => g.path === selectedPath) ?? null;

  // ── Load gallery assets + addresses ───────────────────────
  const loadAddresses = useCallback(async () => {
    const list = await listAddresses();
    setAddresses(list);
    setAddressId((cur) => cur ?? list.find((a) => a.is_default)?.id ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      // Local session read (no network); the assets query is RLS-scoped.
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      const { data: assets } = await supabase
        .from("assets")
        .select("storage_path, generation_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (assets?.length) {
        const paths = assets.map((a) => a.storage_path);
        const signed = await getOutputUrls(paths);
        const items: GalleryItem[] = assets.map((a, i) => ({
          path: a.storage_path,
          url: signed[i] ?? "",
          generationId: a.generation_id,
        }));
        setGallery(items);

        // Preselect from query: explicit asset path, else first of the generation.
        const pre =
          (presetAsset && items.find((x) => x.path === presetAsset)) ||
          (presetGen && items.find((x) => x.generationId === presetGen)) ||
          items[0];
        setSelectedPath(pre?.path ?? null);
      }

      await loadAddresses();
      setWalletBalance(await getWalletBalance().catch(() => 0));
      setLoading(false);
    })();
  }, [presetAsset, presetGen, loadAddresses]);

  // ── Poll for payment confirmation ─────────────────────────
  useEffect(() => {
    if (payment.kind !== "awaiting") return;
    const { paymentId } = payment;
    const poll = async () => {
      try {
        const res = await fetch(`/api/payment/${paymentId}`);
        if (!res.ok) return;
        const data: { status: string } = await res.json();
        if (data.status === "paid") {
          setPayment({ kind: "confirmed" });
          setTimeout(() => router.push("/orders"), 1000);
        }
      } catch { /* keep polling */ }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [payment, router]);

  // QPay: open the QR overlay; the poll effect drives confirmation.
  const handleQpay = async (assetStoragePath: string, addr: string) => {
    setPayment({ kind: "creating" });
    try {
      const result = await createPrintIntent({ assetStoragePath, frameId, sizeId, addressId: addr });
      setPayment({ kind: "awaiting", ...result });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
      setPayment({ kind: "idle" });
    }
  };

  // Wallet: the debit settles synchronously (no QR/polling) — show the confirmed
  // splash and drop the user into their orders.
  const handleWallet = async (assetStoragePath: string, addr: string) => {
    setPayment({ kind: "creating" });
    try {
      await payPrintWithWallet({ assetStoragePath, frameId, sizeId, addressId: addr });
      setPayment({ kind: "confirmed" });
      setTimeout(() => router.push("/orders"), 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
      setPayment({ kind: "idle" });
      // Balance may have changed (or the debit raced) — refresh it.
      getWalletBalance().then(setWalletBalance).catch(() => {});
    }
  };

  // The sticky bar button validates the selection, then opens the payment sheet
  // where the user picks a method (wallet/QPay) and pays.
  const openPayment = () => {
    if (!selectedPath) { toast.error(t("printSelectImageFirst")); return; }
    if (!addressId) { toast.error(t("printSelectAddressFirst")); return; }
    setPayment({ kind: "choosing" });
  };

  const payNow = () => {
    if (!selectedPath || !addressId) return; // guarded by openPayment
    if (method === "wallet") return handleWallet(selectedPath, addressId);
    return handleQpay(selectedPath, addressId);
  };

  const previewAspect = ratioToAspect(size.ratio);
  const longEdge = Math.max(size.w_cm, size.h_cm);
  const previewScale =
    PREVIEW_SCALE_MIN +
    (PREVIEW_SCALE_MAX - PREVIEW_SCALE_MIN) * (longEdge / PREVIEW_CATALOG_MAX_CM);
  // Definite height (the portrait long edge) — aspect-ratio derives the width.
  // A *max*-height alone collapses the box, since its only content is an absolute <Image fill>.
  const previewHeight = `${(PREVIEW_BASE_REM * previewScale).toFixed(2)}rem`;
  const insufficient = walletBalance !== null && walletBalance < price;

  if (loading) {
    return (
      <div className="px-4 py-6 md:px-6 md:py-10">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="mb-6 h-5 w-24" />
          <Skeleton className="mb-4 h-64 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // No gallery images → can't print
  if (gallery.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <ImageOff size={40} className="text-muted-foreground/50" strokeWidth={1.5} />
        <p className="text-muted-foreground">{t("noGalleryImages")}</p>
        <Button render={<Link href="/generate" />} className="rounded-full">{t("startGenerating")}</Button>
      </div>
    );
  }

  // ── Payment confirmed splash ──────────────────────────────
  if (payment.kind === "confirmed") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
          <CheckCircle2 size={32} className="text-primary-foreground" />
        </div>
        <p className="text-xl font-black">{t("printOrdered")}</p>
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-[calc(11rem+env(safe-area-inset-bottom))] md:px-6 md:py-10 md:pb-32">
      <div className="mx-auto max-w-3xl">
        <button onClick={() => router.back()} className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> {t("back")}
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FrameIcon size={20} />
          </div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">{t("printTitle")}</h1>
        </div>

        {/* ── Live preview ── */}
        <div className="mb-8 flex justify-center rounded-2xl border border-border bg-muted/30 p-6">
          <motion.div
            layout
            className={cn("overflow-hidden rounded-sm shadow-xl transition-all", frame.swatchClass)}
            style={{ aspectRatio: String(previewAspect), height: previewHeight, maxWidth: "100%" }}
          >
            {/* white mat — omitted for "no frame" */}
            <div className={cn("h-full w-full", frame.id !== "none" && "bg-white p-1.5")}>
              <div className="relative h-full w-full overflow-hidden bg-background">
                {selected?.url && (
                  <Image src={selected.url} alt="preview" fill className="object-cover" sizes="320px" unoptimized />
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── 1. Image picker ── */}
        <Section step={1} title={t("printPickImage")} hint={t("printPickImageDesc")}>
          <div className="flex gap-2 overflow-x-auto p-1 scrollbar-hide">
            {gallery.map((g) => (
              <button
                key={g.path}
                onClick={() => setSelectedPath(g.path)}
                className={cn(
                  "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl transition-all",
                  selectedPath === g.path
                    ? "ring-2 ring-primary"
                    : "border border-border hover:ring-2 hover:ring-primary/50"
                )}
              >
                {g.url && <Image src={g.url} alt="" fill className="object-cover" sizes="80px" unoptimized />}
                {selectedPath === g.path && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check size={12} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </Section>

        {/* ── 2. Frame ── */}
        <Section step={2} title={t("printFrame")}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {FRAMES.map((f) => (
              <button
                key={f.id}
                onClick={() => setFrameId(f.id)}
                className={cn(
                  "flex h-full flex-col items-center gap-1.5 rounded-xl p-2 transition-all",
                  frameId === f.id
                    ? "bg-primary/10 ring-2 ring-primary"
                    : "border border-border hover:text-primary"
                )}
              >
                <span className="h-10 w-10 shrink-0 rounded-md ring-1 ring-foreground/10" style={{ background: f.swatchStyle }} />
                <span className="line-clamp-2 min-h-[2.5em] text-center text-[11px] font-semibold leading-tight">
                  {lang === "mn" ? f.name_mn : f.name_en}
                </span>
                <span className="mt-auto text-[10px] text-muted-foreground">
                  {f.surcharge_mnt === 0 ? "+0₮" : `+${(f.surcharge_mnt / 1000).toFixed(0)}мянга`}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* ── 3. Size ── */}
        <Section step={3} title={t("printSize")}>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSizeId(s.id)}
                className={cn(
                  "rounded-xl px-4 py-2 text-left transition-all",
                  sizeId === s.id
                    ? "bg-primary/10 text-primary ring-2 ring-primary"
                    : "border border-border hover:text-primary"
                )}
              >
                <p className="text-sm font-bold">{s.label}</p>
                <p className="text-xs text-muted-foreground">₮{s.base_mnt.toLocaleString()}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* ── 4. Address ── */}
        <Section step={4} title={t("printAddress")}>
          {addresses.length === 0 && !showAddForm && (
            <p className="mb-3 text-sm text-muted-foreground">{t("printNoAddress")}</p>
          )}
          <div className="flex flex-col gap-2">
            {addresses.map((a) => (
              <button
                key={a.id}
                onClick={() => setAddressId(a.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition-all",
                  addressId === a.id
                    ? "ring-2 ring-primary"
                    : "hover:text-primary"
                )}
              >
                <MapPin size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {a.recipient}
                    {a.label && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{a.label}</span>}
                    {a.is_default && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">{t("addrDefault")}</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{a.phone} · {formatAddress(a)}</p>
                </div>
                {addressId === a.id && <Check size={16} className="mt-0.5 shrink-0 text-primary" />}
              </button>
            ))}
          </div>

          {showAddForm ? (
            <div className="mt-3">
              <AddressForm
                onSaved={async (id) => { await loadAddresses(); setAddressId(id); setShowAddForm(false); }}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-3 flex items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus size={16} /> {t("printAddAddress")}
            </button>
          )}
        </Section>
      </div>

      {/* ── Sticky price + confirm bar ── */}
      {/* Sits above the mobile bottom nav, which is h-16 PLUS its safe-area pad —
          so clear both, else the bar overlaps the nav on notched devices. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background/90 backdrop-blur-lg md:bottom-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] md:px-6">
          <div>
            <p className="text-xs text-muted-foreground">
              {size.label} · {lang === "mn" ? frame.name_mn : frame.name_en}
            </p>
            <p className="text-xl font-black text-primary">₮{price.toLocaleString()}</p>
          </div>
          <Button
            onClick={openPayment}
            disabled={!selectedPath || !addressId}
            className="rounded-full font-bold bg-primary text-primary-foreground"
            variant="shadow"
            size="lg"
          >
            {t("printConfirm")}
          </Button>
        </div>
      </div>

      {/* ── Payment sheet: method chooser → QPay QR ── */}
      <AnimatePresence>
        {(payment.kind === "choosing" || payment.kind === "creating" || payment.kind === "awaiting") && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { if (payment.kind !== "creating") setPayment({ kind: "idle" }); }}
          >
            <motion.div
              className="chassis-surface relative w-full max-w-md rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-(--shadow-floating) sm:rounded-3xl sm:pb-6"
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  {payment.kind === "awaiting" ? t("qpayTitle") : t("paymentMethod")}
                </h2>
                {payment.kind !== "creating" && (
                  <button onClick={() => setPayment({ kind: "idle" })} className="text-xs text-muted-foreground hover:text-foreground">
                    {t("cancelBtn")}
                  </button>
                )}
              </div>

              {/* Price summary — shared by both steps */}
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{size.label} · {lang === "mn" ? frame.name_mn : frame.name_en}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                    <span className="font-bold">{t("totalPrice")}</span>
                    <span className="text-xl font-black text-primary">₮{price.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {payment.kind === "awaiting" ? (
                /* ── QPay QR ── */
                <>
                  <div className="flex flex-col items-center gap-3 rounded-2xl bg-muted p-6 shadow-(--shadow-recessed)">
                    <p className="text-sm font-semibold text-muted-foreground">{t("qpayDesc")}</p>
                    {/* QR keeps a white quiet-zone so it stays scannable on the dark chassis. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={payment.qrImage} alt="QPay QR" className="h-44 w-44 rounded-xl bg-white p-2" />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" /> {t("paymentWaiting")}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-sm font-semibold">{t("bankApps")}</p>
                    <div className="flex flex-wrap gap-2">
                      {payment.deepLinks.map((dl) => {
                        const bank = banks.find((b) => b.nameMn === dl.name);
                        return (
                          <a key={dl.name} href={dl.link} className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium shadow-(--shadow-card) transition-all hover:text-primary active:shadow-(--shadow-pressed)">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black text-white" style={{ background: bank?.color ?? "#666" }}>
                              {dl.name.slice(0, 1)}
                            </span>
                            <span className="whitespace-nowrap">{dl.name}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                /* ── Method chooser (choosing · creating) ── */
                <>
                  <div className="flex flex-col gap-2">
                    {/* Wallet (default) */}
                    <button
                      type="button"
                      onClick={() => setMethod("wallet")}
                      className={cn(
                        "flex items-center gap-3 rounded-xl p-4 text-left transition-all",
                        method === "wallet"
                          ? "bg-primary/10 ring-2 ring-primary"
                          : "border border-border hover:text-primary"
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Wallet size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{t("payWithWallet")}</p>
                        {walletBalance === null ? (
                          <p className="text-xs text-muted-foreground">…</p>
                        ) : insufficient ? (
                          <p className="text-xs text-destructive">
                            {t("insufficientBalance")} · {formatMnt(price - walletBalance)} {t("shortBy")}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {t("walletBalance")}: {formatMnt(walletBalance)}
                          </p>
                        )}
                      </div>
                      {method === "wallet" && <Check size={18} className="shrink-0 text-primary" />}
                    </button>

                    {/* QPay */}
                    <button
                      type="button"
                      onClick={() => setMethod("qpay")}
                      className={cn(
                        "flex items-center gap-3 rounded-xl p-4 text-left transition-all",
                        method === "qpay"
                          ? "bg-primary/10 ring-2 ring-primary"
                          : "border border-border hover:text-primary"
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <QrCode size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{t("qpayTitle")}</p>
                        <p className="text-xs text-muted-foreground">{t("qpayDesc")}</p>
                      </div>
                      {method === "qpay" && <Check size={18} className="shrink-0 text-primary" />}
                    </button>
                  </div>

                  {method === "wallet" && insufficient ? (
                    // Wallet can't cover it — nudge to top up instead of paying.
                    <Button
                      onClick={() => router.push("/wallet")}
                      className="mt-4 w-full rounded-full font-bold bg-primary text-primary-foreground"
                      variant="shadow"
                      size="lg"
                    >
                      <Plus size={16} className="mr-1.5" /> {t("topUp")}
                    </Button>
                  ) : (
                    <Button
                      onClick={payNow}
                      disabled={payment.kind === "creating" || (method === "wallet" && walletBalance === null)}
                      className="mt-4 w-full rounded-full font-bold bg-primary text-primary-foreground"
                      variant="shadow"
                      size="lg"
                    >
                      {payment.kind === "creating"
                        ? <><Loader2 size={16} className="mr-2 animate-spin" /> {t("processing")}</>
                        : t("printConfirm")}
                    </Button>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-(--shadow-key-sm) glow-brand-sm">{step}</span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {hint && <p className="mb-3 -mt-1 ml-8 text-sm text-muted-foreground">{hint}</p>}
      <div className="ml-8">{children}</div>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-full items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    }>
      <PrintConfigurator />
    </Suspense>
  );
}
