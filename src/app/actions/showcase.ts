"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { debitWallet } from "@/lib/wallet-server";
import { getSignedUrls, OUTPUTS_BUCKET, storeShareCard } from "@/lib/supabase/storage";
import { randomUUID } from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://aistudio.mn";

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

// Turn a generation into a public share link (/s/{token}) for the Facebook
// "link post" loop. Builds a branded OG card once and stores the opaque token on
// the generation. Idempotent: re-sharing the same generation returns the existing
// link (the card lives forever in the public bucket). Returns the absolute URL.
export async function createShareLink(generationId: string): Promise<{ url: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  // Owner-scoped read — proves ownership and pulls what we need.
  const { data: gen } = await supabase
    .from("generations")
    .select("result_urls, share_token")
    .eq("id", generationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!gen) throw new Error("Зураг олдсонгүй.");

  const { result_urls, share_token } =
    gen as { result_urls: string[] | null; share_token: string | null };

  // Already shared → reuse the token; the card was built once and is permanent.
  if (share_token) return { url: `${APP_URL}/s/${share_token}` };

  // First stored output (skip legacy public-URL mock entries).
  const firstPath = result_urls?.find((u) => !u.startsWith("http"));
  if (!firstPath) throw new Error("Зураг бэлэн болоогүй байна.");

  const token = randomUUID().replace(/-/g, "").slice(0, 16);

  // Build + store the branded public OG card from the (private) first output.
  const [signed] = await getSignedUrls(OUTPUTS_BUCKET, [firstPath], 3600);
  if (!signed) throw new Error("Зураг ачааллаж чадсангүй.");
  await storeShareCard(signed, token);

  // Persist the token. generations is owner-read only (no owner-update policy),
  // so write through the admin client — ownership is already proven above.
  const admin = createAdminClient();
  const { error } = await admin
    .from("generations")
    .update({ share_token: token })
    .eq("id", generationId);
  if (error) throw new Error(error.message);

  return { url: `${APP_URL}/s/${token}` };
}
