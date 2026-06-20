"use client";

import { useMemo, useState } from "react";
import {
  Loader2, Search, Phone, Mail, ChevronLeft, ChevronRight, ShieldCheck,
} from "lucide-react";
import { setUserRole } from "@/app/actions/admin";
import { ROLE_LABELS_MN } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { UserRole } from "@/lib/supabase/types";

const PAGE_SIZE = 20;
const ROLES: UserRole[] = ["user", "order_manager", "admin"];

// Staff roles get a coloured badge so they stand out in the list.
const ROLE_BADGE: Record<UserRole, "secondary" | "default"> = {
  user: "secondary",
  order_manager: "default",
  admin: "default",
};

export interface AdminUserItem {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  created_at: string;
}

export function UserManager({
  users,
  currentUserId,
}: {
  users: AdminUserItem[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [page, setPage] = useState(0);

  const resetPage = () => setPage(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (q) {
        const hay = [u.id, u.name, u.phone, u.email].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, query, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const filterItems = { all: "Бүх роль", ...ROLE_LABELS_MN };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: search + role filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); resetPage(); }}
            placeholder="Нэр, утас, имэйл, ID-аар хайх…"
            className="pl-8"
          />
        </div>
        <Select
          items={filterItems}
          value={roleFilter}
          onValueChange={(v) => { if (typeof v === "string") { setRoleFilter(v as UserRole | "all"); resetPage(); } }}
        >
          <SelectTrigger className="w-40 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх роль</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS_MN[r]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {pageItems.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Хэрэглэгч олдсонгүй.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {pageItems.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">Нийт {filtered.length}</span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Өмнөх">
              <ChevronLeft size={15} />
            </Button>
            <span className="text-sm font-medium tabular-nums">{safePage + 1} / {pageCount}</span>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label="Дараах">
              <ChevronRight size={15} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({ user, isSelf }: { user: AdminUserItem; isSelf: boolean }) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [saving, setSaving] = useState(false);

  // Optimistic: flip the select immediately, roll back if the server rejects.
  const changeRole = async (next: UserRole) => {
    if (next === role) return;
    const prev = role;
    setRole(next);
    setSaving(true);
    try {
      await setUserRole(user.id, next);
      toast.success(`Роль: ${ROLE_LABELS_MN[next]}`);
    } catch (err) {
      setRole(prev);
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  const isStaff = role !== "user";

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{user.name ?? "Нэргүй"}</p>
            {isSelf && <Badge variant="secondary" className="text-[10px]">Та</Badge>}
            {isStaff && <ShieldCheck size={13} className="shrink-0 text-primary" />}
            <span className="font-mono text-xs text-muted-foreground">{user.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {user.phone && (
              <span className="flex items-center gap-1"><Phone size={12} /> {user.phone}</span>
            )}
            {user.email && (
              <span className="flex items-center gap-1"><Mail size={12} /> {user.email}</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          {isSelf ? (
            <Badge variant={ROLE_BADGE[role]} className="text-xs">{ROLE_LABELS_MN[role]}</Badge>
          ) : (
            <Select
              items={ROLE_LABELS_MN}
              value={role}
              onValueChange={(v) => { if (typeof v === "string") changeRole(v as UserRole); }}
              disabled={saving}
            >
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS_MN[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
