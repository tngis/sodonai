"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createPaymentIntentCore,
  payWithWalletCore,
  resumePaymentCore,
  payPendingWithWalletCore,
  type PaymentIntentResult,
  type WalletPaymentResult,
  type ResumePaymentResult,
  type ResumeWalletResult,
} from "@/lib/payments/intent";

// Thin cookie-auth wrapper around the shared core (the mobile path authenticates
// via Bearer in src/app/api/payment/route.ts and calls the same core).
export async function createPaymentIntent(formData: FormData): Promise<PaymentIntentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return createPaymentIntentCore({ supabase, user, formData });
}

// Re-issue the QPay QR for a still-pending order so the user can finish paying
// from /orders. Thin cookie-auth wrapper around the shared core (mobile uses
// Bearer via src/app/api/orders/resume/route.ts).
export async function resumePayment(orderId: string): Promise<ResumePaymentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return resumePaymentCore({ supabase, user, orderId });
}

// Pay an existing *pending* order from the wallet (the /orders resume flow's
// wallet option). Thin cookie-auth wrapper around the shared core (the mobile
// path authenticates via Bearer in src/app/api/orders/pay-wallet/route.ts).
export async function payPendingWithWallet(orderId: string): Promise<ResumeWalletResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return payPendingWithWalletCore({ supabase, user, orderId });
}

// Thin cookie-auth wrapper around the shared core (see createPaymentIntent).
export async function payWithWallet(formData: FormData): Promise<WalletPaymentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");
  return payWithWalletCore({ supabase, user, formData });
}
