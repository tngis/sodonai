"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import {
  createPreset, updatePreset, deletePreset, addOptionSuggestion, deleteOptionSuggestion, type PresetInput,
} from "@/app/actions/admin";
import type { Database, Json, SuggestionKind } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  TextField, NumberField, TextareaField, CheckboxField, ChipListField, MinMaxField, ImageField, ImageListField,
} from "@/components/admin/fields";

type PresetRow = Database["public"]["Tables"]["presets"]["Row"];
type CategoryLite = { id: string; name_mn: string };

// Static selector options. Edit these lists to change what admins can pick.
const OUTPUT_RATIO_OPTIONS = ["Original", "1:1", "4:3", "3:4", "4:5", "3:2", "2:3", "16:9", "9:16"];
const AI_MODEL_OPTIONS = ["face-preserve-v1", "restore-v1", "colorize-v1"];

// Keep the current value selectable even if it isn't in the static list.
const withCurrent = (opts: string[], current: string) =>
  current && !opts.includes(current) ? [current, ...opts] : opts;
const recordOf = (opts: string[]) => Object.fromEntries(opts.map((o) => [o, o]));

// Auto-generate a preset id from its category, e.g. "cat-family" → "fam-001".
// The number is the next free sequence among presets that already share the prefix.
function nextPresetId(categoryId: string, presets: PresetRow[]): string {
  const base = categoryId.replace(/^cat[-_]/, "");
  const prefix = (base.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 3)) || "pst";
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const p of presets) {
    const m = p.id.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

interface PresetForm {
  id: string;
  category_id: string;
  name_mn: string;
  name_en: string;
  description_mn: string;
  description_en: string;
  output_ratio: string;
  steps: number;
  price_mnt: number;
  eta_min: string;
  warnings: string[];
  internal_prompt: string;
  ai_model: string;
  example_output: string;
  example_inputs: string[];
  optionsText: string;
  required_min: number;
  required_max: number;
  sort_order: number;
  is_active: boolean;
}

function rowToForm(p: PresetRow): PresetForm {
  return {
    id: p.id,
    category_id: p.category_id,
    name_mn: p.name_mn,
    name_en: p.name_en,
    description_mn: p.description_mn ?? "",
    description_en: p.description_en ?? "",
    output_ratio: p.output_ratio,
    steps: p.steps,
    price_mnt: p.price_mnt,
    eta_min: p.eta_min,
    warnings: p.warnings_mn ?? [],
    internal_prompt: p.internal_prompt,
    ai_model: p.ai_model ?? "",
    example_output: p.example_output,
    example_inputs: p.example_inputs ?? [],
    optionsText: p.options ? JSON.stringify(p.options, null, 2) : "",
    required_min: p.required_min ?? 1,
    required_max: p.required_max ?? 9,
    sort_order: p.sort_order,
    is_active: p.is_active,
  };
}

function emptyForm(categories: CategoryLite[]): PresetForm {
  return {
    id: "", category_id: categories[0]?.id ?? "", name_mn: "", name_en: "",
    description_mn: "", description_en: "",
    output_ratio: "Original", steps: 1, price_mnt: 1900, eta_min: "1–2",
    warnings: [], internal_prompt: "", ai_model: AI_MODEL_OPTIONS[0], example_output: "",
    example_inputs: [], optionsText: "", required_min: 1, required_max: 9, sort_order: 0, is_active: true,
  };
}

// Convert the form into the server-action payload. Throws on invalid JSON.
function buildInput(f: PresetForm): PresetInput {
  let options: Json | null = null;
  const ot = f.optionsText.trim();
  if (ot) {
    try {
      options = JSON.parse(ot) as Json;
    } catch {
      throw new Error("Options талбар буруу JSON байна.");
    }
  }
  return {
    id: f.id.trim(),
    category_id: f.category_id,
    name_mn: f.name_mn,
    // EN fields are hidden in the form for now; fall back to the MN value.
    name_en: f.name_en.trim() || f.name_mn,
    description_mn: f.description_mn,
    description_en: f.description_en.trim() || f.description_mn,
    output_ratio: f.output_ratio,
    steps: f.steps,
    price_mnt: f.price_mnt,
    eta_min: f.eta_min,
    warnings_mn: f.warnings,
    internal_prompt: f.internal_prompt,
    ai_model: f.ai_model.trim() || null,
    example_output: f.example_output,
    example_inputs: f.example_inputs.filter(Boolean),
    options,
    required_min: f.required_min,
    required_max: f.required_max,
    sort_order: f.sort_order,
    is_active: f.is_active,
  };
}

export function PresetManager({
  initialPresets, categories, savedWarnings, savedExampleInputs,
}: {
  initialPresets: PresetRow[]; categories: CategoryLite[];
  savedWarnings: string[]; savedExampleInputs: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<PresetForm | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const catName = (id: string) => categories.find((c) => c.id === id)?.name_mn ?? id;
  // Maps category id → label so the Select can render the chosen category's name.
  const categoryItems = Object.fromEntries(categories.map((c) => [c.id, c.name_mn]));
  // Quick-select pools: saved options first, then any values used by existing presets.
  const warningSuggestions = [...new Set([...savedWarnings, ...initialPresets.flatMap((p) => p.warnings_mn ?? [])])];

  const persist = (kind: SuggestionKind, v: string) =>
    addOptionSuggestion(kind, v).catch((e) => toast.error(e instanceof Error ? e.message : "Хадгалахад алдаа."));
  const unpersist = (kind: SuggestionKind, v: string) =>
    deleteOptionSuggestion(kind, v).catch((e) => toast.error(e instanceof Error ? e.message : "Устгахад алдаа."));

  const startNew = () => {
    const form = emptyForm(categories);
    // New presets get an auto-generated id derived from the chosen category.
    setEditing({ ...form, id: form.category_id ? nextPresetId(form.category_id, initialPresets) : "" });
    setIsNew(true);
  };
  const startEdit = (p: PresetRow) => { setEditing(rowToForm(p)); setIsNew(false); };
  const patch = (p: Partial<PresetForm>) => setEditing((e) => (e ? { ...e, ...p } : e));

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const input = buildInput(editing);
      if (isNew) {
        await createPreset(input);
      } else {
        const { id, ...rest } = input;
        await updatePreset(id, rest);
      }
      toast.success("Хадгаллаа.");
      setEditing(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Энэ пресетийг устгах уу?")) return;
    try {
      await deletePreset(id);
      toast.success("Устгалаа.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Алдаа гарлаа. (Захиалгатай пресетийг устгах боломжгүй — идэвхгүй болго.)");
    }
  };

  const toggleActive = async (p: PresetRow) => {
    try {
      const { id, ...rest } = buildInput(rowToForm(p));
      await updatePreset(id, { ...rest, is_active: !p.is_active });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Алдаа гарлаа.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Пресет ({initialPresets.length})</h2>
        <Button onClick={startNew} size="sm" className="rounded-full font-bold" disabled={categories.length === 0}>
          <Plus size={14} className="mr-1" /> Шинэ пресет
        </Button>
      </div>
      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">Эхлээд ангилал нэмнэ үү.</p>
      )}

      {/* List */}
      <div className="flex flex-col gap-2">
        {initialPresets.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center gap-1 p-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10">
                {p.example_output ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.example_output} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 ml-2">
                <p className="truncate font-semibold mb-2">
                  {p.name_mn}
                  {!p.is_active && <Badge variant="secondary" className="ml-2 text-xs">Идэвхгүй</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {catName(p.category_id)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  ₮{p.price_mnt.toLocaleString()} · {p.output_ratio}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => toggleActive(p)} aria-label="Идэвх солих">
                {p.is_active ? <Eye size={15} /> : <EyeOff size={15} className="text-muted-foreground" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => startEdit(p)} aria-label="Засах">
                <Pencil size={15} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(p.id)} aria-label="Устгах">
                <Trash2 size={15} className="text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {initialPresets.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Пресет алга байна.</p>
        )}
      </div>

      {/* Editor dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{isNew ? "Шинэ пресет" : "Пресет засах"}</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField label="ID (автомат)" value={editing.id} onChange={() => {}} disabled placeholder="fam-001" mono />
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-semibold">Ангилал</Label>
                  <Select
                    items={categoryItems}
                    value={editing.category_id}
                    onValueChange={(v) => {
                      if (typeof v !== "string") return;
                      // Regenerate the auto id when the category changes (new presets only).
                      patch(isNew ? { category_id: v, id: nextPresetId(v, initialPresets) } : { category_id: v });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name_mn}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <TextField label="Нэр (MN)" value={editing.name_mn} onChange={(v) => patch({ name_mn: v })} />
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-semibold">Гаралтын харьцаа</Label>
                  <Select
                    items={recordOf(withCurrent(OUTPUT_RATIO_OPTIONS, editing.output_ratio))}
                    value={editing.output_ratio}
                    onValueChange={(v) => { if (typeof v === "string") patch({ output_ratio: v }); }}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {withCurrent(OUTPUT_RATIO_OPTIONS, editing.output_ratio).map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm font-semibold">AI модель</Label>
                  <Select
                    items={recordOf(withCurrent(AI_MODEL_OPTIONS, editing.ai_model))}
                    value={editing.ai_model}
                    onValueChange={(v) => { if (typeof v === "string") patch({ ai_model: v }); }}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {withCurrent(AI_MODEL_OPTIONS, editing.ai_model).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <TextField label="ETA (хугацаа)" value={editing.eta_min} onChange={(v) => patch({ eta_min: v })} placeholder="1–3" />
                <NumberField label="Үнэ (₮)" value={editing.price_mnt} onChange={(v) => patch({ price_mnt: v })} />
              </div>

              <TextareaField label="Тайлбар (MN)" value={editing.description_mn} onChange={(v) => patch({ description_mn: v })} rows={2} />

              <TextareaField
                label="Дотоод prompt (хэрэглэгчид харагдахгүй)"
                value={editing.internal_prompt}
                onChange={(v) => patch({ internal_prompt: v })}
                rows={3}
              />
              <ChipListField
                label="Анхааруулга (MN)"
                hint="Анхааруулга бичээд Enter эсвэл 'Нэмэх' дарна."
                value={editing.warnings}
                onChange={(v) => patch({ warnings: v })}
                placeholder="Анхааруулга бичих"
                suggestions={warningSuggestions}
                onPersist={(v) => persist("warning", v)}
                onUnpersist={(v) => unpersist("warning", v)}
              />
              <MinMaxField
                label="Шаардлагатай зургийн тоо"
                hint="Хэрэглэгчийн оруулах зургийн доод ба дээд хязгаар."
                min={editing.required_min}
                max={editing.required_max}
                onMinChange={(v) => patch({ required_min: v })}
                onMaxChange={(v) => patch({ required_max: v })}
              />

              <ImageField label="Жишээ гаралт (example output)" value={editing.example_output} onChange={(v) => patch({ example_output: v })} />
              <ImageListField
                label="Жишээ оролтууд (example inputs)"
                value={editing.example_inputs}
                onChange={(v) => patch({ example_inputs: v })}
                library={savedExampleInputs}
                onPersist={(v) => persist("example_input", v)}
                onUnpersist={(v) => unpersist("example_input", v)}
              />

              <TextareaField
                label="Options (JSON, заавал биш)"
                hint='Ж: {"styleIntensityDefault":30}'
                value={editing.optionsText}
                onChange={(v) => patch({ optionsText: v })}
                rows={3}
                mono
              />

              <CheckboxField label="Идэвхтэй" checked={editing.is_active} onChange={(v) => patch({ is_active: v })} />

              <DialogFooter>
                <Button onClick={() => setEditing(null)} variant="outline" className="rounded-full">Болих</Button>
                <Button onClick={save} disabled={saving} className="rounded-full font-bold">
                  {saving ? "Хадгалж байна..." : "Хадгалах"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
