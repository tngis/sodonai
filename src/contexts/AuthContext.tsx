"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getProfile, type Profile } from "@/app/actions/profile";

interface AuthContextValue {
  /** The current user, or null when signed out. */
  user: User | null;
  /** Convenience: user.id or null — for RLS-scoped client queries. */
  userId: string | null;
  isAuthed: boolean;
  /** True until the initial session read resolves. */
  loading: boolean;
  /** Loaded once per session (avatar + name); null while loading / signed out. */
  profile: Profile | null;
  /** Re-fetch the profile (e.g. after the user edits their name/avatar). */
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userId: null,
  isAuthed: false,
  loading: true,
  profile: null,
  refreshProfile: () => {},
});

// Single source of truth for client-side auth state. Reads the session from
// local storage via getSession() (no network round-trip — unlike getUser(),
// which validates against the auth server) and keeps it fresh via
// onAuthStateChange. Mounted once in the root layout so every page reads auth
// from context instead of each component firing its own getUser() per mount.
// Security-sensitive gating still happens server-side (proxy.ts + RLS); this
// only drives UI and id-scoped client queries.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = user?.id ?? null;

  // Clear the profile the instant the signed-in user changes (incl. logout) —
  // adjusting state during render, the React-recommended alternative to a reset
  // effect, so we never flash the previous user's name/avatar.
  const [trackedUser, setTrackedUser] = useState<string | null>(userId);
  if (userId !== trackedUser) {
    setTrackedUser(userId);
    setProfile(null);
  }

  const refreshProfile = useCallback(() => {
    getProfile()
      .then(setProfile)
      .catch(() => {});
  }, []);

  // Load the profile once when a user is present. Keyed on userId so it doesn't
  // refire on unrelated token refreshes.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    getProfile()
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <AuthContext.Provider
      value={{ user, userId, isAuthed: !!user, loading, profile, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
