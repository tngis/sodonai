"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(JSON.stringify({
      event: "app.error",
      digest: error.digest,
      message: error.message,
      ts: new Date().toISOString(),
    }));
  }, [error]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle size={28} className="text-destructive" />
      </div>
      <h1 className="text-xl font-black">Алдаа гарлаа</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Техникийн алдаа гарлаа. Дахин оролдоно уу.
        {error.digest && (
          <span className="mt-1 block font-mono text-xs opacity-60">#{error.digest}</span>
        )}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} className="rounded-full">
          Дахин оролдох
        </Button>
        <Button render={<Link href="/" />} variant="outline" className="rounded-full">
          Нүүр хуудас
        </Button>
      </div>
    </div>
  );
}
