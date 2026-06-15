"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { debitWallet } from "@/lib/wallet-server";
import { getSignedUrls, OUTPUTS_BUCKET } from "@/lib/supabase/storage";

// Newest publicly-shared images across ALL users, for the landing-page marquee.
//
// Visibility is now a per-image property: an asset shows iff is_private=false.
// (The old per-user master switch was removed — sharing/hiding is decided per
// generation, with a discount on share and a repayment on un-share.) assets are
// owner-scoped under RLS, so this aggregate runs on the admin client. It returns
// ONLY presigned image URLs — never user or row-level data — so there is nothing
// sensitive to leak. No auth required: the landing page is public.
export async function getPublicShowcase(limit = 24): Promise<string[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("assets")
    .select("storage_path")
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  const paths = (data as { storage_path: string }[]).map((r) => r.storage_path);
  const urls = await getSignedUrls(OUTPUTS_BUCKET, paths, 3600);
  // getSignedUrls yields "" for a missing object — drop those.
  return urls.filter(Boolean);
}

// Hide a generation from the public feed — a ONE-WAY, FINAL action.
//
// Sharing can only be opted into at generation time (for the discount). There is
// no re-share: once hidden, an image stays private forever, and an image that was
// never shared can never be made public. So this is the only visibility mutation
// after generation, and it always moves public → unshared.
//
// It repays the discount the share consumed. The discount is read from the
// generation's snapshot (captured at generation time, never recomputed — the
// preset price may have changed since). The repayment is charged FIRST; only on
// success is the image made private, so a failed/insufficient payment leaves it
// shared. Returns the amount charged.
export async function unshareGeneration(generationId: string): Promise<{ charged: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  // Owner-scoped read of the price snapshot + the original share decision.
  const { data: gen } = await supabase
    .from("generations")
    .select("order_id, discount_mnt, shared_to_feed")
    .eq("id", generationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!gen) throw new Error("Зураг олдсонгүй.");

  const { order_id: orderId, discount_mnt, shared_to_feed } =
    gen as { order_id: string; discount_mnt: number | null; shared_to_feed: boolean };

  // A never-shared (private) image can't be hidden — it was never public.
  if (!shared_to_feed) throw new Error("Энэ зураг нийтэд хуваалцагдаагүй байна.");

  // State guard (replaces idempotency): only charge while the image is actually
  // public. If it's already hidden — e.g. a double-click or a second tab raced
  // us here — do nothing and charge nothing. Un-share is final, so there's no
  // legitimate second charge.
  const { data: assetRows } = await supabase
    .from("assets")
    .select("is_private")
    .eq("generation_id", generationId)
    .eq("user_id", user.id);
  const alreadyHidden =
    !assetRows?.length || assetRows.every((a) => (a as { is_private: boolean }).is_private);
  if (alreadyHidden) return { charged: 0 };

  const discount = discount_mnt ?? 0;

  // Repay the consumed discount before hiding the image. Nothing to repay when
  // it was generated via the no-pay path (discount_mnt = 0). The ledger key is
  // still deterministic per generation so the debit can't be applied twice even
  // if the state guard above is somehow bypassed.
  if (discount > 0) {
    const debit = await debitWallet({
      userId: user.id,
      amountMnt: discount,
      idempotencyKey: `unshare:${generationId}`,
      orderId,
      note: "Нийтэд хуваалцсан хямдралын буцаалт",
    });
    if (!debit.ok) {
      // Payment failed — keep the image shared.
      throw new Error("Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна. Хямдралыг буцаан төлж чадсангүй.");
    }
  }

  const { error } = await supabase
    .from("assets")
    .update({ is_private: true })
    .eq("generation_id", generationId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/gallery");
  revalidatePath("/");
  return { charged: discount };
}
