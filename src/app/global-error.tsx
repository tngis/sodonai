"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

// Global error boundary — replaces the root layout on catastrophic failures.
// Must be self-contained (no imports from app components).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(JSON.stringify({
      event: "app.global_error",
      digest: error.digest,
      message: error.message,
      ts: new Date().toISOString(),
    }));
  }, [error]);

  return (
    <html lang="mn">
      <body style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem", padding: "1rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <TriangleAlert size={48} color="#ff4757" strokeWidth={1.5} aria-hidden />
        <h1 style={{ fontSize: "1.25rem", fontWeight: 900 }}>Системийн алдаа</h1>
        <p style={{ color: "#666", fontSize: "0.875rem", maxWidth: "20rem" }}>
          Техникийн алдаа гарлаа. Хуудсыг дахин ачаалж үзнэ үү.
        </p>
        <button
          onClick={reset}
          style={{ padding: "0.5rem 1.5rem", borderRadius: "999px", background: "#ff4757", color: "#ffffff", fontWeight: 700, cursor: "pointer", border: "none" }}
        >
          Дахин оролдох
        </button>
      </body>
    </html>
  );
}
