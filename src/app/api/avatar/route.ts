import { NextRequest, NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route-auth";
import {
  storeAvatarFile,
  validateImageFile,
  removeFiles,
  getSignedUrls,
  OUTPUTS_BUCKET,
} from "@/lib/supabase/storage";

// Mobile avatar upload. Mirrors the uploadAvatar server action: store the image
// under {userId}/profile/ in the private outputs bucket, point users.avatar_url
// at it, clean up the previous profile-prefixed avatar, and return a presigned URL.
export async function POST(req: NextRequest) {
  const auth = await getRouteAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, user } = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Зураг хүлээж авахад алдаа гарлаа." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Зураг сонгоно уу." }, { status: 400 });
  }
  const invalid = validateImageFile(file);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { data: current } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  const path = await storeAvatarFile(file, user.id);

  const { error } = await supabase
    .from("users")
    .update({ avatar_url: path })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Best-effort cleanup of the previous avatar — only profile-prefixed objects
  // (a gallery-set avatar points at a real asset and must never be deleted).
  const old = (current as { avatar_url: string | null } | null)?.avatar_url ?? null;
  if (old && old.startsWith(`${user.id}/profile/`)) {
    await removeFiles(OUTPUTS_BUCKET, [old]);
  }

  const [url] = await getSignedUrls(OUTPUTS_BUCKET, [path], undefined, { stable: true });
  return NextResponse.json({ url: url ?? "" });
}
