import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundForGeneration } from "@/lib/wallet-server";
import type { Database } from "@/lib/supabase/types";

type GenerationRow = Database["public"]["Tables"]["generations"]["Row"];
type GenUpdate = Database["public"]["Tables"]["generations"]["Update"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];
type StaleGen = Pick<
  GenerationRow,
  "id" | "user_id" | "order_id" | "attempt" | "status"
>;

export const dynamic = "force-dynamic";

// Backstop for a generation whose runGeneration() never reached a terminal
// status — e.g. the serverless function running the after() work was killed, so
// the row is stuck on 'queued'/'processing' forever (no failure, no refund). The
// updated_at trigger bumps on every progress write, so a row untouched for 15min
// is genuinely abandoned. Sweeps such rows, fails them, and reuses the exact same
// wallet refund path as the runGeneration catch block (idempotent per attempt).
// Protect with CRON_SECRET and call from a scheduler (Vercel Cron sends GET with
// `Authorization: Bearer ${CRON_SECRET}`).

const STALE_MS = 15 * 60 * 1000; // 15 minutes
const BATCH = 100;

function authorized(req: NextRequest, secret: string): boolean {
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

async function failStale(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorized(req, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - STALE_MS).toISOString();
  const { data } = await admin
    .from("generations")
    .select("id, user_id, order_id, attempt, status")
    .in("status", ["queued", "processing"])
    .lt("updated_at", since)
    .order("updated_at", { ascending: true })
    .limit(BATCH);

  const stale = (data ?? []) as unknown as StaleGen[];
  let failed = 0;

  for (const gen of stale) {
    try {
      // Atomically claim the stuck→failed transition, guarded on the status we
      // read. If 0 rows come back, another process (a late runGeneration, or a
      // concurrent cron) already moved the row — skip, so we never double-refund.
      const { data: claimed } = await admin
        .from("generations")
        .update({ status: "failed", error: "timeout" } as GenUpdate)
        .eq("id", gen.id)
        .eq("status", gen.status)
        .select("id");
      if (!claimed?.length) continue;

      await admin
        .from("orders")
        .update({ status: "failed" } as OrderUpdate)
        .eq("id", gen.order_id);

      // Reuse the same refund path as the runGeneration catch block. Idempotent
      // per (generation, attempt); a no-op when the order had no successful
      // payment. Refund failures are non-fatal — the row stays correctly failed.
      try {
        await refundForGeneration({
          userId: gen.user_id,
          orderId: gen.order_id,
          generationId: gen.id,
          attempt: gen.attempt,
        });
      } catch (refundErr) {
        console.error(JSON.stringify({
          event: "fail_stale.refund_error",
          generationId: gen.id,
          error: refundErr instanceof Error ? refundErr.message : String(refundErr),
          ts: new Date().toISOString(),
        }));
      }

      failed++;
    } catch (err) {
      console.error(JSON.stringify({
        event: "fail_stale.generation_error",
        generationId: gen.id,
        error: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }));
    }
  }

  console.log(JSON.stringify({
    event: "fail_stale.done", scanned: stale.length, failed, ts: new Date().toISOString(),
  }));
  return NextResponse.json({ ok: true, scanned: stale.length, failed });
}

// GET for Vercel Cron (sends GET); POST for manual/other schedulers.
export async function GET(req: NextRequest) { return failStale(req); }
export async function POST(req: NextRequest) { return failStale(req); }
