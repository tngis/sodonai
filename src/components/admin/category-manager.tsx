"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "motion/react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Eye, EyeOff, GripVertical } from "lucide-react";
import {
  createCategory, updateCategory, deleteCategory, reorderCategories, type CategoryInput,
} from "@/app/actions/admin";
import type { Database } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { TextField, NumberField, TextareaField, CheckboxField, ImageField } from "@/components/admin/fields";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

const EMPTY: CategoryInput = {
  id: "", name_mn: "", name_en: "", description_mn: "", description_en: "",
  icon: "", image_url: null, sort_order: 0, is_active: true,
};

function rowToInput(c: CategoryRow): CategoryInput {
  return {
    id: c.id,
    name_mn: c.name_mn,
    name_en: c.name_en,
    description_mn: c.description_mn,
    description_en: c.description_en,
    icon: c.icon,
    image_url: c.image_url,
    sort_order: c.sort_order,
    is_active: c.is_active,
  };
}

export function CategoryManager({ initialCategories }: { initialCategories: CategoryRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CategoryInput | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // Local copy of the list so drag reordering feels instant. Re-synced whenever
  // the server sends fresh props (after any create/edit/delete/toggle refresh).
  const [cats, setCats] = useState<CategoryRow[]>(initialCategories);
  const [syncedProps, setSyncedProps] = useState(initialCategories);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync local order when the server sends fresh props (after any refresh).
  // Adjusting state during render is React's recommended alternative to an effect.
  if (syncedProps !== initialCategories) {
    setSyncedProps(initialCategories);
    setCats(initialCategories);
  }

  // Persist the full current order to the database.
  const persistOrder = async (list: CategoryRow[]) => {
    const updates = list.map((c, i) => ({ id: c.id, sort_order: i }));
    try {
      await reorderCategories(updates);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Эрэмбэ хадгалахад алдаа.");
      router.refresh(); // revert to server truth
    }
  };

  const handleReorder = (next: CategoryRow[]) => {
    setCats(next);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => { void persistOrder(next); }, 500);
  };

  const startNew = () => { setEditing({ ...EMPTY }); setIsNew(true); };
  const startEdit = (c: CategoryRow) => { setEditing(rowToInput(c)); setIsNew(false); };

  const patch = (p: Partial<CategoryInput>) => setEditing((e) => (e ? { ...e, ...p } : e));

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      if (isNew) {
        await createCategory(editing);
      } else {
        const { id, ...rest } = editing;
        await updateCategory(id, rest);
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
    if (!confirm("Энэ ангиллыг устгах уу? Доторх пресетүүд бас устана.")) return;
    try {
      await deleteCategory(id);
      toast.success("Устгалаа.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Алдаа гарлаа.");
    }
  };

  const toggleActive = async (c: CategoryRow) => {
    try {
      const { id, ...rest } = rowToInput(c);
      await updateCategory(id, { ...rest, is_active: !c.is_active });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Алдаа гарлаа.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Ангилал ({cats.length})</h2>
        <Button onClick={startNew} size="sm" className="rounded-full font-bold">
          <Plus size={14} className="mr-1" /> Шинэ ангилал
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Эрэмбийг өөрчлөхдөө <GripVertical size={12} className="inline align-text-bottom" />-ээс чирнэ үү.</p>

      {/* List (drag to reorder) */}
      <Reorder.Group as="div" axis="y" values={cats} onReorder={handleReorder} className="flex flex-col gap-2">
        {cats.map((c) => (
          <CategoryRowItem
            key={c.id}
            c={c}
            onToggle={() => toggleActive(c)}
            onEdit={() => startEdit(c)}
            onRemove={() => remove(c.id)}
          />
        ))}
      </Reorder.Group>
      {cats.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Ангилал алга байна.</p>
      )}

      {/* Editor dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{isNew ? "Шинэ ангилал" : "Ангилал засах"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField label="ID (латин, өвөрмөц)" value={editing.id} onChange={(v) => patch({ id: v })} disabled={!isNew} placeholder="cat-family" mono />
                <TextField label="Icon (эможи, зураггүй үед)" value={editing.icon} onChange={(v) => patch({ icon: v })} placeholder="👨‍👩‍👧‍👦" />
                <div className="sm:col-span-2">
                  <ImageField label="Зураг (icon-ийг орлоно)" value={editing.image_url ?? ""} onChange={(v) => patch({ image_url: v || null })} />
                </div>
                <TextField label="Нэр (MN)" value={editing.name_mn} onChange={(v) => patch({ name_mn: v })} />
                <TextField label="Нэр (EN)" value={editing.name_en} onChange={(v) => patch({ name_en: v })} />
                <TextareaField label="Тайлбар (MN)" value={editing.description_mn} onChange={(v) => patch({ description_mn: v })} rows={2} />
                <TextareaField label="Тайлбар (EN)" value={editing.description_en} onChange={(v) => patch({ description_en: v })} rows={2} />
                <NumberField label="Эрэмбэ" value={editing.sort_order} onChange={(v) => patch({ sort_order: v })} />
                <div className="flex items-end">
                  <CheckboxField label="Идэвхтэй" checked={editing.is_active} onChange={(v) => patch({ is_active: v })} />
                </div>
              </div>
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

function CategoryRowItem({
  c, onToggle, onEdit, onRemove,
}: {
  c: CategoryRow;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item as="div" value={c} dragListener={false} dragControls={controls} whileDrag={{ scale: 1.01 }}>
      <Card>
        <CardContent className="flex items-center gap-1 p-3">
          <button
            type="button"
            onPointerDown={(e) => controls.start(e)}
            className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label="Чирж эрэмбэлэх"
          >
            <GripVertical size={16} />
          </button>
          {c.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.image_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center text-2xl">{c.icon}</span>
          )}
          <div className="min-w-0 flex-1 ml-2">
            <p className="truncate font-semibold mb-2">
              {c.name_mn}
              {!c.is_active && <Badge variant="secondary" className="ml-2 text-xs">Идэвхгүй</Badge>}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">{c.id}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onToggle} aria-label="Идэвх солих">
            {c.is_active ? <Eye size={15} /> : <EyeOff size={15} className="text-muted-foreground" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Засах">
            <Pencil size={15} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Устгах">
            <Trash2 size={15} className="text-destructive" />
          </Button>
        </CardContent>
      </Card>
    </Reorder.Item>
  );
}
