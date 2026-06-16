"use client";

import { useEffect, useState } from "react";

// UI-style axis (flat vs neumorphic), orthogonal to next-themes' light/dark.
// The choice lives in the `ui-style` cookie so the root layout can read it
// server-side and put `flat` on <html> before paint (no FOUC); next-themes
// only ever touches its own theme class, so `flat` survives its hydration.
const COOKIE = "ui-style";
// 1 year — a deliberate UI preference, not a session detail.
const MAX_AGE = 60 * 60 * 24 * 365;

export function useUiStyle() {
  const [flat, setFlatState] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydrate from the class the server already applied (the cookie's source of
  // truth), so we never toggle the class on mount and cause a flash.
  useEffect(() => {
    setMounted(true);
    setFlatState(document.documentElement.classList.contains("flat"));
  }, []);

  const setFlat = (next: boolean) => {
    setFlatState(next);
    document.documentElement.classList.toggle("flat", next);
    document.cookie = `${COOKIE}=${next ? "flat" : "neu"};path=/;max-age=${MAX_AGE};samesite=lax`;
  };

  return { flat, setFlat, mounted };
}
