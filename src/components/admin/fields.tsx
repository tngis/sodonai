"use client";

import { useState } from "react";
import { toast } from "sonner";
import { uploadExampleImage } from "@/app/actions/admin";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Upload, X, Plus, Images, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function TextField({
  label, value, onChange, placeholder, disabled, mono,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={mono ? "font-mono text-xs" : ""}
      />
    </div>
  );
}

export function NumberField({
  label, value, onChange,
}: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </div>
  );
}

export function TextareaField({
  label, value, onChange, placeholder, rows = 3, mono, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; mono?: boolean; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cn(mono && "font-mono text-xs")}
      />
    </div>
  );
}

export function CheckboxField({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-2">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span className="text-sm font-semibold">{label}</span>
    </label>
  );
}

// Min/max numeric range (e.g. required image count).
export function MinMaxField({
  label, hint, min, max, onMinChange, onMaxChange,
}: {
  label: string; hint?: string; min: number; max: number;
  onMinChange: (v: number) => void; onMaxChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-end gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Хамгийн бага</span>
          <Input
            type="number"
            min={1}
            value={Number.isFinite(min) ? min : 1}
            onChange={(e) => onMinChange(e.target.value === "" ? 1 : Number(e.target.value))}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Хамгийн их</span>
          <Input
            type="number"
            min={1}
            value={Number.isFinite(max) ? max : 9}
            onChange={(e) => onMaxChange(e.target.value === "" ? 1 : Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}

// Tag/chip input: type a value (Enter / "Нэмэх") to add it as a chip. Below the
// input, quick-select options add a value in one click. Custom entries are added
// to the quick-select pool so they can be re-selected after removal.
export function ChipListField({
  label, value, onChange, placeholder, hint, suggestions = [], onPersist, onUnpersist,
}: {
  label: string; value: string[]; onChange: (v: string[]) => void;
  placeholder?: string; hint?: string; suggestions?: string[];
  // Called when a brand-new value is added — persist it to the quick-select pool.
  onPersist?: (value: string) => void;
  // Called to remove a value from the saved quick-select pool. Enables a delete ×.
  onUnpersist?: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  // Quick-select pool — seeded from suggestions + current values; grows with custom entries.
  const [pool, setPool] = useState<string[]>(() => [...new Set([...suggestions, ...value])]);

  const addValue = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    if (!pool.includes(t)) {
      setPool((p) => [...p, t]);
      onPersist?.(t);
    }
  };

  const removeFromPool = (s: string) => {
    setPool((p) => p.filter((x) => x !== s));
    onUnpersist?.(s);
  };

  const add = () => { addValue(draft); setDraft(""); };

  const available = pool.filter((s) => !value.includes(s));

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pr-1.5 pl-2.5 text-xs font-medium ring-1 ring-foreground/10">
              {chip}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label="Устгах"
                className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" onClick={add} className="shrink-0">
          <Plus size={14} className="mr-1" /> Нэмэх
        </Button>
      </div>

      {available.length > 0 && (
        <div className="mt-1 flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Хурдан сонголт:</p>
          <div className="flex flex-wrap gap-1.5">
            {available.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border py-1 pr-1.5 pl-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50"
              >
                <button type="button" onClick={() => addValue(s)} className="inline-flex items-center gap-1 hover:text-foreground">
                  <Plus size={11} /> {s}
                </button>
                {onUnpersist && (
                  <button
                    type="button"
                    onClick={() => removeFromPool(s)}
                    aria-label="Сонголтоос устгах"
                    className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Single example image: upload to the public bucket and store its URL.
export function ImageField({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File | undefined | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const url = await uploadExampleImage(fd);
      onChange(url);
      toast.success("Зураг орууллаа.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Алдаа гарлаа.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <Upload size={16} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="URL эсвэл зураг оруулна уу" className="font-mono text-xs" />
          <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-input px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-muted">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { handleUpload(e.target.files?.[0]); e.target.value = ""; }} />
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Зураг оруулах
          </label>
        </div>
      </div>
    </div>
  );
}

// List of example images (URLs). Upload appends + saves to a reusable library;
// "Сонгох" opens a dialog of saved images with multi-select.
export function ImageListField({
  label, value, onChange, library = [], onPersist, onUnpersist,
}: {
  label: string; value: string[]; onChange: (v: string[]) => void;
  library?: string[];
  onPersist?: (url: string) => void;
  onUnpersist?: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  // Saved-image pool, seeded from the library + current values.
  const [pool, setPool] = useState<string[]>(() => [...new Set([...library, ...value])]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const handleUpload = async (file: File | undefined | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const url = await uploadExampleImage(fd);
      onChange([...value, url]);
      if (!pool.includes(url)) {
        setPool((p) => [...p, url]);
        onPersist?.(url);
      }
      toast.success("Зураг нэмлээ.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Алдаа гарлаа.");
    } finally {
      setUploading(false);
    }
  };

  const removeFromLibrary = (url: string) => {
    setPool((p) => p.filter((x) => x !== url));
    onUnpersist?.(url);
  };

  const togglePick = (url: string) =>
    setPicked((p) => (p.includes(url) ? p.filter((x) => x !== url) : [...p, url]));

  const confirmPick = () => {
    const additions = picked.filter((u) => !value.includes(u));
    if (additions.length) onChange([...value, ...additions]);
    setPicked([]);
    setPickerOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="flex flex-col gap-3">
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {value.map((url, i) => (
              <div key={i} className="group relative h-24 w-24 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  aria-label="Устгах"
                  className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-input px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-muted">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { handleUpload(e.target.files?.[0]); e.target.value = ""; }} />
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Зураг оруулах
          </label>
          {pool.length > 0 && (
            <button
              type="button"
              onClick={() => { setPicked([]); setPickerOpen(true); }}
              className="flex w-fit items-center gap-1.5 rounded-lg border border-input px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-muted"
            >
              <Images size={12} /> Сонгох ({pool.length})
            </button>
          )}
        </div>
      </div>

      {/* Saved-image multi-select dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Хадгалсан зургууд</DialogTitle>
          </DialogHeader>
          <div className="grid p-2 max-h-[55vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {pool.map((url) => {
              const added = value.includes(url);
              const sel = picked.includes(url);
              return (
                <div
                  key={url}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10",
                    sel && "ring-2 ring-primary"
                  )}
                >
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => togglePick(url)}
                    className="h-full w-full disabled:cursor-default"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {added && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-semibold text-white">
                        Нэмсэн
                      </span>
                    )}
                    {sel && !added && (
                      <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check size={12} />
                      </span>
                    )}
                  </button>
                  {onUnpersist && !added && (
                    <button
                      type="button"
                      onClick={() => removeFromLibrary(url)}
                      aria-label="Сангаас устгах"
                      className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPickerOpen(false)} className="rounded-full">Болих</Button>
            <Button type="button" onClick={confirmPick} disabled={picked.length === 0} className="rounded-full font-bold">
              Нэмэх ({picked.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
