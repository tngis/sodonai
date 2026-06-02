import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: gen, error } = await supabase
    .from("generations")
    .select("id, status, progress, queue_position, result_urls, error")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !gen) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(gen);
}
