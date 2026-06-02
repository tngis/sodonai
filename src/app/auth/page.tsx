"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Phone, Shield, Mail, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Method = "phone" | "email";
type PhoneStep = "phone" | "otp" | "name";
type EmailStep = "signin" | "signup";

// Circular countdown that depletes as `value` → 0 (out of `total`).
function CountdownRing({ value, total }: { value: number; total: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / total));
  return (
    <span className="relative inline-flex h-9 w-9 items-center justify-center">
      <svg className="absolute -rotate-90" width={36} height={36} viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-border" />
        <motion.circle
          cx="18" cy="18" r={r} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </svg>
      <span className="text-[11px] font-bold tabular-nums">{value}</span>
    </span>
  );
}

export default function AuthPage() {
  const { t } = useLang();
  const router = useRouter();
  const supabase = createClient();

  // ─── method toggle ───────────────────────────────────────
  const [method, setMethod] = useState<Method>("phone");

  // ─── phone flow ──────────────────────────────────────────
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ─── email flow ───────────────────────────────────────────
  const [emailStep, setEmailStep] = useState<EmailStep>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailName, setEmailName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ─── shared ───────────────────────────────────────────────
  const [loading, setLoading] = useState(false);

  // OTP countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  // Reset sub-steps when switching method
  const switchMethod = (m: Method) => {
    setMethod(m);
    setPhoneStep("phone");
    setEmailStep("signin");
    setLoading(false);
  };

  // ─── phone handlers ───────────────────────────────────────
  const handleSendOtp = async () => {
    if (phone.length < 8) return;
    setLoading(true);
    // TODO: call Skytel OTP API via server action
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setPhoneStep("otp");
    setCountdown(60);
    toast.success(t("otpSent"));
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  // Handle paste on OTP
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    if (digits.length === 0) return;
    e.preventDefault();
    const next = [...otp];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    const focusIdx = Math.min(digits.length, 5);
    otpRefs.current[focusIdx]?.focus();
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) return;
    setLoading(true);
    // TODO: verify via server action against Skytel + create Supabase session
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    if (code === "000000") {
      setPhoneStep("name");
    } else {
      toast.success(t("welcomeBack"));
      router.push("/");
      router.refresh();
    }
  };

  const handlePhoneFinish = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    toast.success(t("welcomeBack"));
    router.push("/");
    router.refresh();
  };

  // ─── email handlers ───────────────────────────────────────
  const handleEmailSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("welcomeBack"));
    router.push("/");
    router.refresh();
  };

  const handleEmailSignUp = async () => {
    if (!email || !password || !emailName.trim()) return;
    if (password !== confirmPassword) {
      toast.error("Нууц үг таарахгүй байна.");
      return;
    }
    if (password.length < 8) {
      toast.error("Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: emailName.trim() } },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Баталгаажуулах имэйл илгээлээ. Имэйлээ шалгана уу.");
  };

  // ─── render ───────────────────────────────────────────────
  const isPhoneBack = phoneStep !== "phone";

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Back button */}
        {(isPhoneBack) && (
          <button
            onClick={() => {
              if (phoneStep === "otp") setPhoneStep("phone");
              if (phoneStep === "name") setPhoneStep("otp");
            }}
            className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={14} /> {t("back")}
          </button>
        )}

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <motion.div
            className="glow-brand flex h-12 w-12 items-center justify-center rounded-xl bg-primary"
            initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 18 }}
          >
            <span className="text-lg font-black text-primary-foreground">AI</span>
          </motion.div>
          <h1 className="font-display text-2xl font-black tracking-tight">aistudio.mn</h1>
        </div>

        {/* Method toggle — only show on first step */}
        {(method === "phone" ? phoneStep === "phone" : true) && (
          <div className="mb-6 flex gap-1 rounded-xl bg-muted p-1">
            <button
              onClick={() => switchMethod("phone")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                method === "phone"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Phone size={14} /> Утас
            </button>
            <button
              onClick={() => switchMethod("email")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                method === "email"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Mail size={14} /> Имэйл
            </button>
          </div>
        )}

        {/* ══════════════ PHONE FLOW ══════════════ */}
        {method === "phone" && (
          <>
            {phoneStep === "phone" && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-xl font-bold">{t("phoneLogin")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("enterPhone")}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">{t("enterPhone")}</Label>
                  <div className="flex gap-2">
                    <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-md border border-input bg-muted px-3 text-sm font-semibold text-muted-foreground">
                      +976
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder={t("phonePlaceholder")}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSendOtp}
                  disabled={phone.length < 8 || loading}
                  className="w-full rounded-full font-bold"
                  size="lg"
                >
                  <Phone size={16} className="mr-2" />
                  {loading ? "..." : t("sendOtp")}
                </Button>
              </div>
            )}

            {phoneStep === "otp" && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-xl font-bold">{t("enterOtp")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("otpSent")} +976 {phone}
                  </p>
                </div>

                <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <motion.input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      animate={{ scale: digit ? 1.05 : 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      className={cn(
                        "h-12 w-10 rounded-lg border bg-background text-center text-lg font-bold outline-none transition-colors focus:ring-2 focus:ring-primary/20",
                        digit ? "border-primary glow-brand-sm" : "border-input focus:border-primary"
                      )}
                    />
                  ))}
                </div>

                {/* Success check when all 6 digits are entered */}
                <AnimatePresence>
                  {otp.join("").length === 6 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-1.5 text-sm font-semibold text-primary"
                    >
                      <CheckCircle2 size={15} /> Код бэлэн
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  {countdown > 0 ? (
                    <>
                      <CountdownRing value={countdown} total={60} />
                      <span>{t("otpExpires")}</span>
                    </>
                  ) : (
                    <button
                      onClick={() => { setCountdown(60); toast.success(t("otpSent")); }}
                      className="font-semibold text-primary hover:underline"
                    >
                      {t("resendCode")}
                    </button>
                  )}
                </div>

                <Button
                  onClick={handleVerifyOtp}
                  disabled={otp.join("").length < 6 || loading}
                  className="w-full rounded-full font-bold"
                  size="lg"
                >
                  <Shield size={16} className="mr-2" />
                  {loading ? "..." : t("verify")}
                </Button>

                <button
                  onClick={() => setPhoneStep("phone")}
                  className="text-center text-sm text-muted-foreground hover:text-primary"
                >
                  {t("editNumber")}
                </button>
              </div>
            )}

            {phoneStep === "name" && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-xl font-bold">Тавтай морил!</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Нэрээ оруулна уу.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">{t("nameLabel")}</Label>
                  <Input
                    id="name"
                    placeholder={t("namePlaceholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePhoneFinish()}
                  />
                </div>
                <Button
                  onClick={handlePhoneFinish}
                  disabled={!name.trim() || loading}
                  className="w-full rounded-full font-bold"
                  size="lg"
                >
                  {loading ? "..." : t("continueBtn")}
                </Button>
              </div>
            )}
          </>
        )}

        {/* ══════════════ EMAIL FLOW ══════════════ */}
        {method === "email" && (
          <>
            {/* Sign-in / Sign-up sub-toggle */}
            <div className="mb-6 flex gap-4 border-b border-border">
              <button
                onClick={() => setEmailStep("signin")}
                className={cn(
                  "pb-2.5 text-sm font-semibold transition-colors",
                  emailStep === "signin"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Нэвтрэх
              </button>
              <button
                onClick={() => setEmailStep("signup")}
                className={cn(
                  "pb-2.5 text-sm font-semibold transition-colors",
                  emailStep === "signup"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Бүртгүүлэх
              </button>
            </div>

            {/* Sign In */}
            {emailStep === "signin" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Имэйл</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleEmailSignIn()}
                    autoComplete="email"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Нууц үг</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleEmailSignIn()}
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <Button
                  onClick={handleEmailSignIn}
                  disabled={!email || !password || loading}
                  className="w-full rounded-full font-bold"
                  size="lg"
                >
                  <Mail size={16} className="mr-2" />
                  {loading ? "..." : "Нэвтрэх"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Бүртгэлгүй юу?{" "}
                  <button
                    onClick={() => setEmailStep("signup")}
                    className="font-semibold text-primary hover:underline"
                  >
                    Бүртгүүлэх
                  </button>
                </p>
              </div>
            )}

            {/* Sign Up */}
            {emailStep === "signup" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-name">{t("nameLabel")}</Label>
                  <Input
                    id="signup-name"
                    placeholder={t("namePlaceholder")}
                    value={emailName}
                    onChange={(e) => setEmailName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-email">Имэйл</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    inputMode="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="signup-password">Нууц үг</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Хамгийн багадаа 8 тэмдэгт"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password">Нууц үг давтах</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Нууц үгийг дахин оруулна уу"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleEmailSignUp()}
                      autoComplete="new-password"
                      className={cn(
                        "pr-10",
                        confirmPassword && confirmPassword !== password && "border-destructive focus-visible:ring-destructive"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-xs text-destructive">Нууц үг таарахгүй байна.</p>
                  )}
                </div>

                <Button
                  onClick={handleEmailSignUp}
                  disabled={!email || !password || !emailName.trim() || password !== confirmPassword || loading}
                  className="w-full rounded-full font-bold"
                  size="lg"
                >
                  {loading ? "..." : "Бүртгүүлэх"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Бүртгэлтэй юу?{" "}
                  <button
                    onClick={() => setEmailStep("signin")}
                    className="font-semibold text-primary hover:underline"
                  >
                    Нэвтрэх
                  </button>
                </p>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
