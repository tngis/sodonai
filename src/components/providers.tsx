"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { GenerationsProvider } from "@/contexts/GenerationsContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <MotionConfig reducedMotion="user">
        <LanguageProvider>
          {/* AuthProvider holds the session (one local read) and feeds
              GenerationsProvider's id-scoped poll; both wrap Header +
              GenerationNotifier so per-page auth/query round-trips collapse. */}
          <AuthProvider>
            <GenerationsProvider>{children}</GenerationsProvider>
          </AuthProvider>
        </LanguageProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
