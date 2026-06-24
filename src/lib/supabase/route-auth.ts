import "server-only";
import {
  createClient as createTokenClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import type { Database } from "./types";

export interface RouteAuth {
  // RLS-scoped client bound to the caller (cookie session OR Bearer JWT).
  supabase: SupabaseClient<Database>;
  user: User;
}

// Authenticate an API route from EITHER an Authorization: Bearer <token> header
// (mobile — Supabase access_token) OR the browser's cookies (web). Both yield an
// RLS-scoped client so downstream `.eq("user_id", user.id)` queries stay enforced
// server-side. Returns null when there's no valid session.
export async function getRouteAuth(req: Request): Promise<RouteAuth | null> {
  const header = req.headers.get("authorization");
  const token =
    header && header.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : null;

  if (token) {
    // Anon client with the user's JWT attached to every PostgREST request, so RLS
    // resolves auth.uid() to this user — the same posture as the mobile client.
    const supabase = createTokenClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    );
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return { supabase, user };
  }

  const supabase = await createCookieClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}
