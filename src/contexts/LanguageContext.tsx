"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Lang, translations, TranslationKey } from "@/lib/i18n";

const LANG_COOKIE = "aistudio_lang";
const LANG_STORAGE = "aistudio_lang";

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "mn";
  try {
    const stored = localStorage.getItem(LANG_STORAGE) as Lang | null;
    if (stored === "mn" || stored === "en") return stored;
  } catch {}
  return "mn";
}

function persistLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE, lang);
  } catch {}
  // Also set a cookie so server components / middleware can read it
  document.cookie = `${LANG_COOKIE}=${lang};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "mn",
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("mn");

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const saved = getInitialLang();
    if (saved !== lang) setLangState(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    persistLang(next);
  };

  const t = (key: TranslationKey): string => {
    const val = translations[lang][key];
    if (Array.isArray(val)) return val.join(" ");
    return val as string;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
