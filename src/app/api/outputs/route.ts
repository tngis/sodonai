import { NextRequest, NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route-auth";
import { getSignedUrls, OUTPUTS_BUCKET } from "@/lib/supabase/storage";

interface OutputEntry {
  path: string;
  thumbPath: string | null;
}

// Presign private R2 output images for the mobile gallery. Mirrors the
// getOutputUrlPairs server action: authorize by owner prefix, then batch-presign
// the full + thumbnail paths with stable (cacheable) URLs.
export async function POST(req: NextRequest) {
  const auth = await getRouteAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { user } = auth;

  let body: { entries?: OutputEntry[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Буруу хүсэлт." }, { status: 400 });
  }

  const entries = body.entries ?? [];
  if (entries.length === 0) return NextResponse.json({ pairs: [] });

  // Outputs are keyed {userId}/{generationId}/..., so the first path segment must
  // be the caller's id (mirrors the old Supabase Storage RLS rule).
  for (const { path } of entries) {
    if (path.split("/")[0] !== user.id) {
      return NextResponse.json({ error: "Хандах эрхгүй зам." }, { status: 403 });
    }
  }

  const urls = await getSignedUrls(
    OUTPUTS_BUCKET,
    entries.map((e) => e.path),
    undefined,
    { stable: true },
  );

  // Batch-presign only the non-null thumb paths, then scatter back to positions.
  const thumbBatch: string[] = [];
  const thumbIdxMap: number[] = [];
  entries.forEach(({ thumbPath }, i) => {
    if (thumbPath) {
      thumbIdxMap.push(i);
      thumbBatch.push(thumbPath);
    }
  });
  const thumbSigned = thumbBatch.length
    ? await getSignedUrls(OUTPUTS_BUCKET, thumbBatch, undefined, { stable: true })
    : [];
  const thumbUrls: (string | null)[] = entries.map(() => null);
  thumbIdxMap.forEach((entryIdx, batchIdx) => {
    thumbUrls[entryIdx] = thumbSigned[batchIdx] || null;
  });

  const pairs = entries.map((_, i) => ({ url: urls[i], thumbUrl: thumbUrls[i] }));
  return NextResponse.json({ pairs });
}
