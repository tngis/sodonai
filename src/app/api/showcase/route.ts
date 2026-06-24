import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedUrls, OUTPUTS_BUCKET } from "@/lib/supabase/storage";

// Public — no auth required. Returns presigned URLs for publicly-shared assets
// (is_private = false), newest first. Used by the mobile home marquee.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "24"), 48);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("assets")
    .select("storage_path")
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) {
    return Response.json({ urls: [] });
  }

  const paths = (data as { storage_path: string }[]).map((r) => r.storage_path);
  const urls = await getSignedUrls(OUTPUTS_BUCKET, paths, 3600);
  return Response.json({ urls: urls.filter(Boolean) });
}
