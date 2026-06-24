import { getRouteAuth } from "@/lib/supabase/route-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await getRouteAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, user } = auth;

  const { data: gen, error } = await supabase
    .from("generations")
    .select("id, status, progress, queue_position, result_urls, error")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !gen) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(gen);
}
