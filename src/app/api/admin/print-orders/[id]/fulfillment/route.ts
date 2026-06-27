import { NextRequest, NextResponse } from "next/server";
import { getRouteStaff, ForbiddenError } from "@/lib/auth-admin";
import { applyPrintFulfillment } from "@/lib/print-fulfillment";
import type {
  PrintProductionStatus,
  PrintDeliveryStatus,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const PRODUCTION: PrintProductionStatus[] = ["pending", "printing", "framing", "ready"];
const DELIVERY: PrintDeliveryStatus[] = ["pending", "shipping", "delivered"];

// Update a print order's production/delivery status + admin note (mobile admin).
// Shares the exact mutation core (audit log + customer SMS) used by the web admin
// server action; only the auth differs (Bearer token vs. cookie session).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let staff;
  try {
    staff = await getRouteStaff(req, "orders");
  } catch (e) {
    if (e instanceof ForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: {
    production_status?: string;
    delivery_status?: string;
    admin_note?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }

  if (
    !PRODUCTION.includes(body.production_status as PrintProductionStatus) ||
    !DELIVERY.includes(body.delivery_status as PrintDeliveryStatus)
  ) {
    return NextResponse.json({ error: "Тодорхойгүй төлөв." }, { status: 400 });
  }

  try {
    await applyPrintFulfillment(staff, id, {
      production_status: body.production_status as PrintProductionStatus,
      delivery_status: body.delivery_status as PrintDeliveryStatus,
      admin_note: typeof body.admin_note === "string" ? body.admin_note : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Хадгалахад алдаа гарлаа." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
