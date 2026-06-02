"use client";

import { useEffect } from "react";

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
        <p style={{ fontSize: "3rem" }}>⚠️</p>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 900 }}>Системийн алдаа</h1>
        <p style={{ color: "#666", fontSize: "0.875rem", maxWidth: "20rem" }}>
          Техникийн алдаа гарлаа. Хуудсыг дахин ачаалж үзнэ үү.
        </p>
        <button
          onClick={reset}
          style={{ padding: "0.5rem 1.5rem", borderRadius: "999px", background: "#D1FE18", fontWeight: 700, cursor: "pointer", border: "none" }}
        >
          Дахин оролдох
        </button>
      </body>
    </html>
  );
}
