"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadFile, storeOutputFile, validateImageFile, getSignedUrls, UPLOADS_BUCKET } from "@/lib/supabase/storage";
import { getInternalPrompt } from "@/lib/presets-server";
import { callAI } from "@/lib/ai/generate";
import type { Database } from "@/lib/supabase/types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type GenerationRow = Database["public"]["Tables"]["generations"]["Row"];
type GenUpdate = Database["public"]["Tables"]["generations"]["Update"];
type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

export interface SubmitOrderResult {
  generationId: string;
  orderId: string;
}

export async function submitOrder(formData: FormData): Promise<SubmitOrderResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Нэвтэрч орно уу.");

  const presetId = formData.get("presetId") as string;
  const amountMnt = Number(formData.get("amountMnt"));
  const ratio = formData.get("ratio") as string;
  const background = (formData.get("background") as string) || null;
  const intensity = formData.has("intensity") ? Number(formData.get("intensity")) : null;
  const isPrivate = formData.get("isPrivate") !== "false";

  const internalPrompt = await getInternalPrompt(presetId);

  // Collect and validate uploaded files
  const files: File[] = [];
  let i = 0;
  while (formData.has(`file_${i}`)) {
    const file = formData.get(`file_${i}`) as File;
    const err = validateImageFile(file);
    if (err) throw new Error(err);
    files.push(file);
    i++;
  }
  if (files.length === 0) throw new Error("Зураг оруулаагүй байна.");

  // Create order (status=pending — Phase 3 flips to 'paid' after QPay)
  const orderRes = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      preset_id: presetId,
      status: "pending" as const,
      amount_mnt: amountMnt,
      options_snapshot: { ratio, background, intensity, isPrivate },
    })
    .select()
    .single();

  const order = orderRes.data as OrderRow | null;
  const orderErr = orderRes.error;
  if (orderErr || !order) throw new Error(orderErr?.message ?? "Захиалга үүсгэхэд алдаа гарлаа.");

  // Upload source images to private storage bucket; collect storage paths
  const uploadPaths = await Promise.all(
    files.map((file, idx) => uploadFile(file, user.id, order.id, idx))
  );

  // Create generation record (queued)
  const genRes = await supabase
    .from("generations")
    .insert({
      order_id: order.id,
      user_id: user.id,
      status: "queued" as const,
      progress: 0,
      queue_position: 1,
    })
    .select()
    .single();

  const generation = genRes.data as GenerationRow | null;
  const genErr = genRes.error;
  if (genErr || !generation) throw new Error(genErr?.message ?? "Боловсруулалт эхлүүлэхэд алдаа гарлаа.");

  // Kick off generation after the response is sent to the client.
  // The client immediately starts polling /api/generation/{id} for status.
  after(() =>
    runGeneration({
      generationId: generation.id,
      orderId: order.id,
      userId: user.id,
      uploadPaths,
      internalPrompt,
      options: { ratio, background, intensity },
    })
  );

  return { generationId: generation.id, orderId: order.id };
}

export interface RunGenerationParams {
  generationId: string;
  orderId: string;
  userId: string;
  uploadPaths: string[];
  internalPrompt: string;
  options: { ratio: string; background: string | null; intensity: number | null };
}

export async function runGeneration({
  generationId,
  orderId,
  userId,
  uploadPaths,
  internalPrompt,
  options,
}: RunGenerationParams): Promise<void> {
  const admin = createAdminClient();

  const updateGen = (fields: GenUpdate) =>
    admin.from("generations").update(fields as GenUpdate).eq("id", generationId);

  const log = (event: string, extra?: Record<string, unknown>) =>
    console.log(JSON.stringify({ event, generationId, orderId, ts: new Date().toISOString(), ...extra }));

  log("generation.started");
  try {
    await updateGen({ status: "processing", progress: 10, queue_position: null });

    // Get short-lived signed URLs so the AI backend can read the private uploads
    const signedUrls = await getSignedUrls(UPLOADS_BUCKET, uploadPaths, 900);

    await updateGen({ progress: 20 });

    log("generation.ai_call");
    const { imageUrls } = await callAI({ imageUrls: signedUrls, prompt: internalPrompt, options });

    await updateGen({ progress: 80 });

    // Download AI outputs and store them in the private outputs bucket
    const resultPaths = await Promise.all(
      imageUrls.map((url, idx) => storeOutputFile(url, userId, generationId, idx))
    );

    await updateGen({ status: "done", progress: 100, result_urls: resultPaths });
    await admin.from("orders").update({ status: "completed" } as OrderUpdate).eq("id", orderId);
    log("generation.done", { outputCount: resultPaths.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    log("generation.failed", { error: message });
    await updateGen({ status: "failed", error: message });
  }
}

export async function saveToGallery(generationId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    }))
  );

  if (insertErr) throw new Error(insertErr.message);
  revalidatePath("/gallery");
}

export async function reportGeneration(_generationId: string): Promise<void> {
  // TODO Phase 5: insert into a reports table and notify admins
}
