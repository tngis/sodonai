import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRouteAuth } from "@/lib/supabase/route-auth";
import {
  type Capability,
  type StaffRole,
  isStaffRole,
  roleHasCapability,
  roleHome,
} from "@/lib/roles";

export interface StaffUser {
  id: string;
  email: string | null;
  name: string | null;
  role: StaffRole;
}

// Returns the current user if they hold a staff role, otherwise null.
// Reads `role` from public.users (RLS allows a user to read their own row).
export async function getStaffUser(): Promise<StaffUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (!isStaffRole(data?.role)) return null;
  return { id: user.id, email: user.email ?? null, name: data!.name, role: data!.role };
}

// For pages/layouts: ensure the caller is staff (optionally with a capability).
// Non-staff → home; staff lacking the capability → their own role's landing tab.
export async function requireStaff(capability?: Capability): Promise<StaffUser> {
  const staff = await getStaffUser();
  if (!staff) redirect("/");
  if (capability && !roleHasCapability(staff.role, capability)) {
    redirect(roleHome(staff.role));
  }
  return staff;
}

// For API route handlers (mobile): resolve the caller from a Bearer token (or
// cookies), then require a staff role — optionally with a capability. Returns
// null when unauthenticated/non-staff so the route can answer 401; throws a
// dedicated marker when staff but lacking the capability so the route can 403.
export class ForbiddenError extends Error {}

export async function getRouteStaff(
  req: Request,
  capability?: Capability,
): Promise<StaffUser | null> {
  const auth = await getRouteAuth(req);
  if (!auth) return null;

  const { data } = await auth.supabase
    .from("users")
    .select("role, name")
    .eq("id", auth.user.id)
    .single();

  if (!isStaffRole(data?.role)) return null;
  const staff: StaffUser = {
    id: auth.user.id,
    email: auth.user.email ?? null,
    name: data!.name,
    role: data!.role,
  };
  if (capability && !roleHasCapability(staff.role, capability)) {
    throw new ForbiddenError("Зөвшөөрөлгүй: эрх хүрэлцэхгүй байна.");
  }
  return staff;
}

// For server actions: throw unless the caller's role grants the capability.
export async function assertCapability(capability: Capability): Promise<StaffUser> {
  const staff = await getStaffUser();
  if (!staff || !roleHasCapability(staff.role, capability)) {
    throw new Error("Зөвшөөрөлгүй: эрх хүрэлцэхгүй байна.");
  }
  return staff;
}
