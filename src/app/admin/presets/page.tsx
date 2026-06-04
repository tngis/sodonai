import { createAdminClient } from "@/lib/supabase/admin";
import { PresetManager } from "@/components/admin/preset-manager";

export const dynamic = "force-dynamic";

export default async function AdminPresetsPage() {
  const admin = createAdminClient();
  const [presetsRes, catsRes, suggestionsRes] = await Promise.all([
    admin.from("presets").select("*").order("sort_order"),
    admin.from("categories").select("id, name_mn").order("sort_order"),
    admin.from("option_suggestions").select("kind, value"),
  ]);

  const saved = suggestionsRes.data ?? [];
  const savedWarnings = saved.filter((s) => s.kind === "warning").map((s) => s.value);
  const savedExampleInputs = saved.filter((s) => s.kind === "example_input").map((s) => s.value);

  return (
    <PresetManager
      initialPresets={presetsRes.data ?? []}
      categories={catsRes.data ?? []}
      savedWarnings={savedWarnings}
      savedExampleInputs={savedExampleInputs}
    />
  );
}
