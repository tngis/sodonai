"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface GenItem {
  id: string;
  status: string; // queued | processing | done | failed
  result_urls: string[] | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const ACTIVE = new Set(["queued", "processing"]);

// Shared client hook: loads the current user's recent generations and polls
// while any are still running. Drives both the gallery "generating…" cards and
// the header notification bell, so notifications are derived from generation
// state instead of a separate table.
export function useUserGenerations(pollMs = 3000) {
  const [items, setItems] = useState<GenItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setItems([]); setLoading(false); return; }
    const { data } = await supabase
      .from("generations")
      .select("id, status, result_urls, error, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as unknown as GenItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const hasActive = items.some((g) => ACTIVE.has(g.status));
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [hasActive, load, pollMs]);

  const active = items.filter((g) => ACTIVE.has(g.status));
  const finished = items.filter((g) => g.status === "done" || g.status === "failed");

  return { items, active, finished, hasActive, loading, reload: load };
}
