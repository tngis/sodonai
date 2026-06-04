import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string | null;
  name: string | null;
}

// Returns the current user if they are an admin, otherwise null.
// Reads is_admin from public.users (RLS allows a user to read their own row).
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("is_admin, name")
    .eq("id", user.id)
    .single();

  if (!data?.is_admin) return null;
  return { id: user.id, email: user.email ?? null, name: data.name };
}

// For pages/layouts: redirect non-admins away (to home, or to auth if signed out).
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) redirect("/");
  return admin;
}

// For server actions: throw if the caller is not an admin.
export async function assertAdmin(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Зөвшөөрөлгүй: админ эрх шаардлагатай.");
  return admin;
}
