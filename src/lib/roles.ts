// Role + capability model shared by the server guards (auth-admin.ts) and the
// client UI (admin nav, header). Pure data/functions with no secrets, so it is
// safe to import from "use client" components — unlike auth-admin.ts, which is
// "server-only".
import type { UserRole } from "@/lib/supabase/types";

// Roles that can reach the admin area. `user` (the default) is not staff.
export type StaffRole = "admin" | "order_manager";

// What a staff member is allowed to do. Tabs and server actions gate on these.
export type Capability = "orders" | "catalog" | "dashboard" | "users";

const ROLE_CAPABILITIES: Record<StaffRole, readonly Capability[]> = {
  // Full access, including managing other users' roles.
  admin: ["orders", "catalog", "dashboard", "users"],
  // Print/order fulfillment only — the Захиалга tab.
  order_manager: ["orders"],
};

// Human-readable role labels (Mongolian, app default). Used by the admin UI.
export const ROLE_LABELS_MN: Record<UserRole, string> = {
  user: "Хэрэглэгч",
  order_manager: "Захиалга хариуцагч",
  admin: "Админ",
};

export function isStaffRole(role: UserRole | null | undefined): role is StaffRole {
  return role === "admin" || role === "order_manager";
}

export function roleHasCapability(role: StaffRole, cap: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(cap);
}

// The landing tab for a role — order_manager has no dashboard, so it lands on
// the orders tab instead of /admin.
export function roleHome(role: StaffRole): string {
  return role === "admin" ? "/admin" : "/admin/orders";
}
