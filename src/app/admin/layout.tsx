import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaff } from "@/lib/auth-admin";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = {
  title: "Админ",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-black tracking-tight">Админ</h1>
        <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Сайт руу буцах
        </Link>
      </div>
      <AdminNav role={staff.role} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
