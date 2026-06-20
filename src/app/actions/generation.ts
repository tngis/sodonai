"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  storeOutputFile,
  storeThumbFile,
  getSignedUrls,
  UPLOADS_BUCKET,
} from "@/lib/supabase/storage";
import { getPresetModelConfig } from "@/lib/presets-server";
import { refundForGeneration, rechargeForRetry } from "@/lib/wallet-server";
import { assertCapability } from "@/lib/auth-admin";
import { callAI } from "@/lib/ai/generate";
import type { Database } from "@/lib/supabase/types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type GenerationRow = Database["public"]["Tables"]["generations"]["Row"];
type GenUpdate = Database["public"]["Tables"]["generations"]["Update"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

export interface RunGenerationParams {
  generationId: string;
  orderId: string;
  userId: string;
  uploadPaths: string[];
  internalPrompt: string;
  model: string;
  options: {
    ratio: string;
    background: string | null;
    isPrivate?: boolean;
  };
  /** Retry counter — keys the refund per attempt (see refundForGeneration). */
  attempt?: number;
}

export async function runGeneration({
  generationId,
  orderId,
  userId,
  uploadPaths,
  internalPrompt,
  model,
  options,
  attempt = 0,
}: RunGenerationParams): Promise<void> {
  const admin = createAdminClient();

  const updateGen = (fields: GenUpdate) =>
    admin
      .from("generations")
      .update(fields as GenUpdate)
      .eq("id", generationId);

  const log = (event: string, extra?: Record<string, unknown>) =>
    console.log(
      JSON.stringify({
        event,
        generationId,
        orderId,
        ts: new Date().toISOString(),
        ...extra,
      }),
    );

  log("generation.started");
  try {
    await updateGen({
      status: "processing",
      progress: 10,
      queue_position: null,
    });

    // Get short-lived signed URLs so the AI backend can read the private uploads.
    // getSignedUrls yields "" for a missing object — fail loudly here rather
    // than passing an empty URL to the AI backend.
    const signedUrls = await getSignedUrls(UPLOADS_BUCKET, uploadPaths, 900);
    const missing = uploadPaths.filter((_, i) => !signedUrls[i]);
    if (missing.length > 0) {
      throw new Error(`Оруулсан зураг олдсонгүй: ${missing.join(", ")}`);
    }

    await updateGen({ progress: 20 });

    log("generation.ai_call");
    const { imageUrls } = await callAI({
      model,
      imageUrls: signedUrls,
      prompt: internalPrompt,
      options,
    });

    await updateGen({ progress: 80 });

    // Download AI outputs and store them in the private outputs bucket.
    // Thumbnails (for the gallery grid) are generated in parallel — failures are
    // non-fatal: a null thumb_path makes the grid fall back to the full image.
    const [resultPaths, thumbPaths] = await Promise.all([
      Promise.all(
        imageUrls.map((url, idx) =>
          storeOutputFile(url, userId, generationId, idx),
        ),
      ),
      Promise.all(
        imageUrls.map(async (url, idx) => {
          try {
            return await storeThumbFile(url, userId, generationId, idx);
          } catch (err) {
            log("generation.thumb_failed", {
              index: idx,
              error: err instanceof Error ? err.message : String(err),
            });
            return null;
          }
        }),
      ),
    ]);

    await updateGen({
      status: "done",
      progress: 100,
      result_urls: resultPaths,
    });
    await admin
      .from("orders")
      .update({ status: "completed" } as OrderUpdate)
      .eq("id", orderId);

    // Auto-save every output to the user's gallery (assets). Deduped on
    // generation_id so a re-run never double-inserts.
    const { data: existingAssets } = await admin
      .from("assets")
      .select("id")
      .eq("generation_id", generationId)
      .limit(1);
    if (!existingAssets?.length) {
      // Honour the user's per-generation "show to others" choice (defaults to
      // private). This is the only point sharing is decided; a shared image
      // appears in the public showcase until the owner hides it (which is final).
      const isPrivate = options.isPrivate ?? true;
      await admin.from("assets").insert(
        resultPaths.map((path, idx) => ({
          user_id: userId,
          generation_id: generationId,
          storage_path: path,
          thumb_path: thumbPaths[idx] ?? null,
          is_private: isPrivate,
        })),
      );
    }

    log("generation.done", { outputCount: resultPaths.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    log("generation.failed", { error: message });
    await updateGen({ status: "failed", error: message });
    await admin
      .from("orders")
      .update({ status: "failed" } as OrderUpdate)
      .eq("id", orderId);

    // Auto-refund the paid amount back to the wallet (instant, no QPay refund
    // API). Idempotent per generation; a no-op when the order had no successful
    // payment (e.g. the submitOrder/no-pay path).
    try {
      await refundForGeneration({ userId, orderId, generationId, attempt });
      log("generation.refunded", { attempt });
    } catch (refundErr) {
      log("generation.refund_failed", {
        error:
          refundErr instanceof Error ? refundErr.message : String(refundErr),
      });
    }
  }
}

interface RetrySnapshot {
  ratio: string;
  background: string | null;
  isPrivate?: boolean;
  uploadPaths?: string[];
}

// Admin re-run of a failed generation. Reuses the original order's uploads and
// option snapshot, and keeps the money invariant intact: the failed run already
// refunded the user, so we reverse that refund before re-running (blocking the
// retry if the user already spent it). Idempotency keys are attempt-scoped, so a
// retry that fails again refunds afresh.
export async function retryGeneration(generationId: string): Promise<void> {
  await assertCapability("orders");
  const admin = createAdminClient();

  const { data: genRow } = await admin
    .from("generations")
    .select("id, order_id, user_id, status, attempt")
    .eq("id", generationId)
    .single();
  const gen = genRow as Pick<
    GenerationRow,
    "id" | "order_id" | "user_id" | "status" | "attempt"
  > | null;
  if (!gen) throw new Error("Үүсгэлт олдсонгүй.");
  if (gen.status !== "failed") {
    throw new Error("Зөвхөн амжилтгүй болсон үүсгэлтийг дахин оролдоно.");
  }

  const { data: orderRow } = await admin
    .from("orders")
    .select("id, preset_id, options_snapshot")
    .eq("id", gen.order_id)
    .single();
  const order = orderRow as Pick<
    OrderRow,
    "id" | "preset_id" | "options_snapshot"
  > | null;
  if (!order?.preset_id) throw new Error("Захиалга олдсонгүй эсвэл пресетгүй.");

  const snapshot = (order.options_snapshot ?? {}) as unknown as RetrySnapshot;
  const uploadPaths = snapshot.uploadPaths ?? [];
  if (uploadPaths.length === 0) {
    throw new Error("Оруулсан зургийн зам алга (хуучин захиалга). Дахин оролдох боломжгүй.");
  }

  const failedAttempt = gen.attempt;
  const nextAttempt = failedAttempt + 1;

  // Resolve model/prompt up front (read-only) so a misconfigured preset fails
  // before any money or state is touched.
  const { prompt: internalPrompt, model } = await getPresetModelConfig(order.preset_id);

  // Reverse the failed run's refund so a successful retry stays paid. If the
  // user already spent it, block — don't hand out a free result.
  const recharge = await rechargeForRetry({
    userId: gen.user_id,
    orderId: order.id,
    generationId: gen.id,
    attempt: failedAttempt,
  });
  if (!recharge.ok) {
    throw new Error(
      "Хэрэглэгч буцаалтаа зарцуулсан тул дахин оролдох боломжгүй (хэтэвчийн үлдэгдэл хүрэлцэхгүй).",
    );
  }

  // Atomically claim the failed→queued transition so a concurrent retry can't
  // double-run the same generation (recharge above is idempotent per attempt).
  const { data: claimed } = await admin
    .from("generations")
    .update({
      status: "queued",
      progress: 0,
      error: null,
      result_urls: null,
      queue_position: 1,
      attempt: nextAttempt,
    } as GenUpdate)
    .eq("id", gen.id)
    .eq("status", "failed")
    .select("id");
  if (!claimed?.length) {
    throw new Error("Энэ үүсгэлтийг аль хэдийн дахин эхлүүлсэн байна.");
  }

  await admin
    .from("orders")
    .update({ status: "paid" } as OrderUpdate)
    .eq("id", order.id);

  after(() =>
    runGeneration({
      generationId: gen.id,
      orderId: order.id,
      userId: gen.user_id,
      uploadPaths,
      internalPrompt,
      model,
      options: {
        ratio: snapshot.ratio,
        background: snapshot.background,
        isPrivate: snapshot.isPrivate,
      },
      attempt: nextAttempt,
    }),
  );

  revalidatePath("/admin/orders");
}

export async function saveToGallery(generationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  const genRes = await supabase
    .from("generations")
    .select("result_urls, user_id")
    .eq("id", generationId)
    .eq("user_id", user.id)
    .single();

  type GenPartial = Pick<GenerationRow, "result_urls" | "user_id">;
  const gen = genRes.data as GenPartial | null;
  const error = genRes.error;

  if (error || !gen) throw new Error("Generation олдсонгүй.");
  if (!gen.result_urls?.length) throw new Error("Зургууд байхгүй байна.");

  // Avoid duplicate saves
  const { data: existing } = await supabase
    .from("assets")
    .select("id")
    .eq("generation_id", generationId)
    .limit(1);

  if (existing?.length) throw new Error("Аль хэдийн хадгалагдсан байна.");

  const { error: insertErr } = await supabase.from("assets").insert(
    gen.result_urls.map((path: string) => ({
      user_id: user.id,
      generation_id: generationId,
      storage_path: path,
      is_private: true,
    })),
  );

  if (insertErr) throw new Error(insertErr.message);
  revalidatePath("/gallery");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function reportGeneration(_generationId: string): Promise<void> {
  // TODO Phase 5: insert into a reports table and notify admins
}
