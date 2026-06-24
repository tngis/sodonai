"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createPrintIntentCore,
  payPrintWithWalletCore,
  type PrintIntentInput,
  type PrintWalletResult,
} from "@/lib/payments/print-intent";
import type { PaymentIntentResult } from "@/lib/payments/intent";

export type { PrintIntentInput, PrintWalletResult };

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return { supabase, user };
}

// Thin cookie-auth wrappers around the shared cores (the mobile path
// authenticates via Bearer in src/app/api/print/route.ts and calls the same cores).
export async function createPrintIntent(input: PrintIntentInput): Promise<PaymentIntentResult> {
  const { supabase, user } = await requireUser();
  return createPrintIntentCore({ supabase, user, input });
}

export async function payPrintWithWallet(input: PrintIntentInput): Promise<PrintWalletResult> {
  const { supabase, user } = await requireUser();
  return payPrintWithWalletCore({ supabase, user, input });
}
