"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { GENERATION_STARTED_EVENT } from "@/lib/generation-events";
import { useAuth } from "./AuthContext";

export interface GenItem {
  id: string;
  status: string; // queued | processing | done | failed
  result_urls: string[] | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const ACTIVE = new Set(["queued", "processing"]);
const POLL_MS = 3000;

interface GenerationsContextValue {
  items: GenItem[];
  active: GenItem[];
  finished: GenItem[];
  hasActive: boolean;
  loading: boolean;
  reload: () => void;
}

const GenerationsContext = createContext<GenerationsContextValue>({
  items: [],
  active: [],
  finished: [],
  hasActive: false,
  loading: true,
  reload: () => {},
});

// Single shared store for the current user's recent generations. Previously
// useUserGenerations() was a per-component hook, so the always-mounted Header
// and GenerationNotifier each ran their own getUser() + query + poll. Now one
// provider loads and polls once; every consumer reads the same state. The user
// id comes from AuthContext (local session) — no per-load getUser() round-trip.
export function GenerationsProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const [items, setItems] = useState<GenItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Reset when the signed-in user changes (incl. logout) — adjusting state
  // during render, the React-recommended alternative to a reset effect. This
  // also stops the poll (hasActive falls to false on an empty list).
  const [trackedUser, setTrackedUser] = useState<string | null>(userId);
  if (userId !== trackedUser) {
    setTrackedUser(userId);
    setItems([]);
    setLoading(!!userId);
  }

  const load = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("generations")
      .select("id, status, result_urls, error, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as unknown as GenItem[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    // Initial / on-user-change fetch. load() only setStates after its await, so
    // this isn't a synchronous-setState-in-effect; the rule can't see past the
    // async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Reload the moment a generation is kicked off (e.g. right after payment), so
  // polling starts without waiting for a page reload.
  useEffect(() => {
    const onStarted = () => load();
    window.addEventListener(GENERATION_STARTED_EVENT, onStarted);
    return () => window.removeEventListener(GENERATION_STARTED_EVENT, onStarted);
  }, [load]);

  const hasActive = items.some((g) => ACTIVE.has(g.status));
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [hasActive, load]);

  const active = items.filter((g) => ACTIVE.has(g.status));
  const finished = items.filter((g) => g.status === "done" || g.status === "failed");

  return (
    <GenerationsContext.Provider
      value={{ items, active, finished, hasActive, loading, reload: load }}
    >
      {children}
    </GenerationsContext.Provider>
  );
}

export function useUserGenerations() {
  return useContext(GenerationsContext);
}
