"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LoginPrompt } from "./login-prompt";
import { useLang } from "@/contexts/LanguageContext";

// Reusable commit-time login gate. Opens the bottom Sheet with the shared
// LoginPrompt when a signed-out user tries a gated action (a preset's "эхлэх",
// a protected bottom-nav tab). `next` is the post-login return path — forwarded
// to /auth?next= by LoginPrompt, which the proxy + auth page already round-trip.
//
// This is UX only: it diverts the *tap* to a friendlier prompt instead of a hard
// /auth bounce. The proxy + RLS still protect the routes server-side, so direct
// URLs / deep links / prefetch remain gated regardless of this component.
export function LoginGate({
  open,
  onOpenChange,
  next,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  next?: string;
  title?: string;
  description?: string;
}) {
  const { t } = useLang();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle className="sr-only">{t("loginPromptTitle")}</SheetTitle>
        <LoginPrompt
          next={next}
          title={title}
          description={description}
          onNavigate={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
