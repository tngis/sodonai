import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { debitWallet } from "@/lib/wallet-server";
import { getSignedUrls, OUTPUTS_BUCKET, storeShareCard } from "@/lib/supabase/storage";
import type { Database } from "@/lib/supabase/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://aistudio.mn";

interface CoreArgs {
  supabase: SupabaseClient<Database>;
  user: User;
  generationId: string;
}

// Hide a generation from the public feed — final, repays the consumed discount.
// Auth is resolved by the caller (cookie action or Bearer route). See the
// unshareGeneration action for the full rationale.
export async function unshareGenerationCore({
  supabase,
  user,
  generationId,
}: CoreArgs): Promise<{ charged: number }> {
  const { data: gen } = await supabase
    .from("generations")
    .select("order_id, discount_mnt, shared_to_feed")
    .eq("id", generationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!gen) throw new Error("Зураг олдсонгүй.");

  const { order_id: orderId, discount_mnt, shared_to_feed } = gen as {
    order_id: string;
    discount_mnt: number | null;
    shared_to_feed: boolean;
  };

  if (!shared_to_feed) throw new Error("Энэ зураг нийтэд хуваалцагдаагүй байна.");

  const { data: assetRows } = await supabase
    .from("assets")
    .select("is_private")
    .eq("generation_id", generationId)
    .eq("user_id", user.id);
  const alreadyHidden =
    !assetRows?.length || assetRows.every((a) => (a as { is_private: boolean }).is_private);
  if (alreadyHidden) return { charged: 0 };

  const discount = discount_mnt ?? 0;

  if (discount > 0) {
    const debit = await debitWallet({
      userId: user.id,
      amountMnt: discount,
      idempotencyKey: `unshare:${generationId}`,
      orderId,
      note: "Нийтэд хуваалцсан хямдралын буцаалт",
    });
    if (!debit.ok) {
      throw new Error("Хэтэвчийн үлдэгдэл хүрэлцэхгүй байна. Хямдралыг буцаан төлж чадсангүй.");
    }
  }

  const { error } = await supabase
    .from("assets")
    .update({ is_private: true })
    .eq("generation_id", generationId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  return { charged: discount };
}

// Mint (or reuse) a public /s/{token} share link with a branded OG card.
export async function createShareLinkCore({
  supabase,
  user,
  generationId,
}: CoreArgs): Promise<{ url: string }> {
  const { data: gen } = await supabase
    .from("generations")
    .select("result_urls, share_token")
    .eq("id", generationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!gen) throw new Error("Зураг олдсонгүй.");

  const { result_urls, share_token } = gen as {
    result_urls: string[] | null;
    share_token: string | null;
  };

  if (share_token) return { url: `${APP_URL}/s/${share_token}` };

  const firstPath = result_urls?.find((u) => !u.startsWith("http"));
  if (!firstPath) throw new Error("Зураг бэлэн болоогүй байна.");

  const token = randomUUID().replace(/-/g, "").slice(0, 16);

  const [signed] = await getSignedUrls(OUTPUTS_BUCKET, [firstPath], 3600);
  if (!signed) throw new Error("Зураг ачааллаж чадсангүй.");
  await storeShareCard(signed, token);

  const admin = createAdminClient();
  const { error } = await admin
    .from("generations")
    .update({ share_token: token })
    .eq("id", generationId);
  if (error) throw new Error(error.message);

  return { url: `${APP_URL}/s/${token}` };
}
