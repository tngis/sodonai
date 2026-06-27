import "server-only";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { sendSms } from "@/lib/sms";
import type { StaffUser } from "@/lib/auth-admin";
import type {
  Database,
  PrintProductionStatus,
  PrintDeliveryStatus,
} from "@/lib/supabase/types";

export interface PrintFulfillmentInput {
  production_status: PrintProductionStatus;
  delivery_status: PrintDeliveryStatus;
  admin_note: string | null;
}

// Customer SMS copy per new status (phrase includes its own punctuation). Only
// forward-meaningful stages notify; reverting to "pending" sends nothing.
const PRODUCTION_SMS: Partial<Record<PrintProductionStatus, string>> = {
  printing: "хэвлэгдэж эхэллээ.",
  framing: "жаазлагдаж байна.",
  ready: "бэлэн боллоо.",
};
const DELIVERY_SMS: Partial<Record<PrintDeliveryStatus, string>> = {
  shipping: "хүргэлтэд гарлаа.",
  delivered: "амжилттай хүргэгдлээ. Баярлалаа!",
};

// Core fulfillment mutation, shared by the web server action (cookie-auth) and
// the mobile API route (Bearer-auth). The caller MUST have already verified that
// `staff` holds the "orders" capability — this function trusts the staff object.
export async function applyPrintFulfillment(
  staff: StaffUser,
  printOrderId: string,
  input: PrintFulfillmentInput,
): Promise<void> {
  // Delivery can't run ahead of production: an item must be produced
  // (production = "ready") before it can be shipped or delivered. Blocks
  // inconsistent states like "production pending + delivered".
  if (input.delivery_status !== "pending" && input.production_status !== "ready") {
    throw new Error("Хүргэлт эхлэхээс өмнө үйлдвэрлэл 'Бэлэн' байх ёстой.");
  }

  const admin = createAdminClient();

  // Read current values: detect real changes (audit + notify) and get the
  // recipient's phone for the SMS.
  const { data: before } = await admin
    .from("print_orders")
    .select("order_id, production_status, delivery_status, admin_note, ship_phone")
    .eq("id", printOrderId)
    .single();

  const nextNote = input.admin_note?.trim() || null;

  const { error } = await admin
    .from("print_orders")
    .update({
      production_status: input.production_status,
      delivery_status: input.delivery_status,
      admin_note: nextNote,
    })
    .eq("id", printOrderId);
  if (error) throw new Error(error.message);

  const prev = before as {
    order_id: string;
    production_status: PrintProductionStatus;
    delivery_status: PrintDeliveryStatus;
    admin_note: string | null;
    ship_phone: string;
  } | null;
  if (!prev) {
    revalidatePath("/admin/orders");
    return;
  }

  const productionChanged = prev.production_status !== input.production_status;
  const deliveryChanged = prev.delivery_status !== input.delivery_status;
  const noteChanged = (prev.admin_note?.trim() || null) !== nextNote;

  // Audit log — who changed what, before→after.
  const events: Database["public"]["Tables"]["print_order_events"]["Insert"][] = [];
  const event = (field: "production" | "delivery" | "note", from: string | null, to: string | null) => ({
    print_order_id: printOrderId,
    order_id: prev.order_id,
    actor_id: staff.id,
    actor_name: staff.name,
    field,
    from_value: from,
    to_value: to,
  });
  if (productionChanged) events.push(event("production", prev.production_status, input.production_status));
  if (deliveryChanged) events.push(event("delivery", prev.delivery_status, input.delivery_status));
  if (noteChanged) events.push(event("note", prev.admin_note?.trim() || null, nextNote));
  if (events.length) await admin.from("print_order_events").insert(events);

  // Internal structured log (unchanged behaviour).
  if (productionChanged) {
    await notify("print.production.updated", {
      printOrderId, orderId: prev.order_id, from: prev.production_status, to: input.production_status,
    });
  }
  if (deliveryChanged) {
    await notify("print.delivery.updated", {
      printOrderId, orderId: prev.order_id, from: prev.delivery_status, to: input.delivery_status,
    });
  }

  // Customer SMS on a meaningful stage change — best-effort, after the response.
  const smsLines: string[] = [];
  const pPhrase = PRODUCTION_SMS[input.production_status];
  if (productionChanged && pPhrase) smsLines.push(`aistudio.mn: Таны хэвлэлийн захиалга ${pPhrase}`);
  const dPhrase = DELIVERY_SMS[input.delivery_status];
  if (deliveryChanged && dPhrase) smsLines.push(`aistudio.mn: Таны хэвлэлийн захиалга ${dPhrase}`);
  if (smsLines.length) {
    after(async () => {
      for (const line of smsLines) await sendSms(prev.ship_phone, line);
    });
  }

  revalidatePath("/admin/orders");
}
