import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Хүлээгдэж буй",
  paid: "Төлсөн",
  processing: "Боловсруулж буй",
  completed: "Дууссан",
  failed: "Амжилтгүй",
};

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-black tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  // order_manager has no dashboard access — redirected to its orders tab.
  await requireStaff("dashboard");
  const admin = createAdminClient();

  const [ordersRes, paymentsRes, gensRes, recentRes, presetsRes] = await Promise.all([
    admin.from("orders").select("status"),
    admin.from("payments").select("amount_mnt, status, paid_at"),
    admin.from("generations").select("status"),
    admin.from("orders").select("id, preset_id, status, amount_mnt, created_at").order("created_at", { ascending: false }).limit(10),
    admin.from("presets").select("id, name_mn"),
  ]);

  const orders = ordersRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const gens = gensRes.data ?? [];
  const recent = recentRes.data ?? [];
  const presetNames = new Map((presetsRes.data ?? []).map((p) => [p.id, p.name_mn]));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const paidPayments = payments.filter((p) => p.status === "success");
  const totalRevenue = paidPayments.reduce((sum, p) => sum + p.amount_mnt, 0);
  const todayRevenue = paidPayments
    .filter((p) => p.paid_at && new Date(p.paid_at) >= startOfToday)
    .reduce((sum, p) => sum + p.amount_mnt, 0);

  const ordersByStatus = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const gensDone = gens.filter((g) => g.status === "done").length;
  const gensFailed = gens.filter((g) => g.status === "failed").length;

  const fmt = (n: number) => `₮${n.toLocaleString()}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Нийт орлого" value={fmt(totalRevenue)} hint={`${paidPayments.length} төлбөр`} />
        <StatCard label="Өнөөдрийн орлого" value={fmt(todayRevenue)} />
        <StatCard label="Нийт захиалга" value={String(orders.length)} />
        <StatCard
          label="Үүсгэлт"
          value={`${gensDone} / ${gens.length}`}
          hint={gensFailed > 0 ? `${gensFailed} амжилтгүй` : "бүгд амжилттай"}
        />
      </div>

      {/* Orders by status */}
      <div>
        <h2 className="mb-3 text-lg font-bold">Захиалгын төлөв</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((status) => (
            <Badge key={status} variant="secondary" className="text-sm">
              {ORDER_STATUS_LABELS[status]}: <span className="ml-1 font-bold">{ordersByStatus[status] ?? 0}</span>
            </Badge>
          ))}
        </div>
      </div>

      {/* Recent orders */}
      <div>
        <h2 className="mb-3 text-lg font-bold">Сүүлийн захиалгууд</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Захиалга алга байна.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {recent.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {o.preset_id ? (presetNames.get(o.preset_id) ?? o.preset_id) : "Хэвлэмэл зураг"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("mn-MN")}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {ORDER_STATUS_LABELS[o.status]}
                    </Badge>
                    <span className="shrink-0 font-bold text-primary">{fmt(o.amount_mnt)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
