import { createClient } from "./server";
import { createAdminClient } from "./admin";

export const UPLOADS_BUCKET = "uploads";
export const OUTPUTS_BUCKET = "outputs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Зөвхөн JPEG, PNG, WEBP зураг оруулна уу.";
  if (file.size > MAX_FILE_SIZE) return "Зургийн хэмжээ 10MB-аас хэтрэхгүй байх ёстой.";
  return null;
}

// Upload a user-provided image to the private uploads bucket.
// Path: {userId}/{orderId}/{index}.{ext}
export async function uploadFile(
  file: File,
  userId: string,
  orderId: string,
  index: number
): Promise<string> {
  const supabase = await createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${orderId}/${index}.${ext}`;

  const { error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) throw new Error(`Зураг оруулахад алдаа: ${error.message}`);
  return path;
}

// Store a generated output image using the service-role client.
// imageData can be a public URL (fetched and re-uploaded) or a base64 data URI.
// Path: {userId}/{generationId}/{index}.{ext}
export async function storeOutputFile(
  imageData: string,
  userId: string,
  generationId: string,
  index: number
): Promise<string> {
  const adminClient = createAdminClient();

  let buffer: ArrayBuffer;
  let contentType = "image/jpeg";

  if (imageData.startsWith("data:")) {
    const [header, b64] = imageData.split(",");
    contentType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
    const binary = atob(b64);
    buffer = new Uint8Array(binary.length).map((_, i) => binary.charCodeAt(i)).buffer;
  } else {
    const res = await fetch(imageData);
    contentType = res.headers.get("content-type") ?? "image/jpeg";
    buffer = await res.arrayBuffer();
  }

  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `${userId}/${generationId}/${index}.${ext}`;

  const { error } = await adminClient.storage
    .from(OUTPUTS_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Output upload error: ${error.message}`);
  return path;
}

// Generate a signed URL for a private storage object (server-side, user session).
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// Batch-generate signed URLs for private storage objects (server-side, user session).
export async function getSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn = 3600
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn);
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => d.signedUrl ?? "");
}

// Generate signed URLs for output images using the admin client.
// Used server-side when no user session is available (e.g., generation worker).
export async function getAdminSignedUrls(
  bucket: string,
  paths: string[],
  expiresIn = 3600
): Promise<string[]> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.storage
    .from(bucket)
    .createSignedUrls(paths, expiresIn);
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => d.signedUrl ?? "");
}
