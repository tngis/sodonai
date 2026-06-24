import { NextRequest, NextResponse } from "next/server";
import { getRouteAuth } from "@/lib/supabase/route-auth";
import { unshareGenerationCore } from "@/lib/showcase-core";

// Hide a generation from the public feed (mobile). Bearer auth; mirrors the
// unshareGeneration server action.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await getRouteAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await unshareGenerationCore({ ...auth, generationId: id }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Алдаа гарлаа.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
