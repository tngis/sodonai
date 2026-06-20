import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth-admin";
import { UserManager, type AdminUserItem } from "@/components/admin/user-manager";

export const dynamic = "force-dynamic";

const USERS_LIMIT = 1000;

export default async function AdminUsersPage() {
  const me = await requireStaff("users");
  const admin = createAdminClient();

  const { data } = await admin
    .from("users")
    .select("id, name, phone, email, role, created_at")
    .order("created_at", { ascending: false })
    .limit(USERS_LIMIT);

  const users: AdminUserItem[] = (data ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    role: u.role,
    created_at: u.created_at,
  }));

  return <UserManager users={users} currentUserId={me.id} />;
}
