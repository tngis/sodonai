import { redirect } from "next/navigation";
import { getPresetServer } from "@/lib/catalog-server";
import PresetClient from "./preset-client";

export default async function PresetDetailPage({ params }: { params: Promise<{ presetId: string }> }) {
  const { presetId } = await params;
  const data = await getPresetServer(presetId);
  if (!data) redirect("/generate");
  return <PresetClient category={data.category} preset={data.preset} />;
}
