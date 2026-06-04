"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { addAddress, updateAddress } from "@/app/actions/addresses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/types";

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];

export function AddressForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: AddressRow;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const { t } = useLang();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: initial?.label ?? "",
    recipient: initial?.recipient ?? "",
    phone: initial?.phone ?? "",
    city: initial?.city ?? "",
    district: initial?.district ?? "",
    khoroo: initial?.khoroo ?? "",
    detail: initial?.detail ?? "",
    note: initial?.note ?? "",
    is_default: initial?.is_default ?? false,
  });

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      const id = initial
        ? (await updateAddress(initial.id, payload), initial.id)
        : await addAddress(payload);
      toast.success(t("saveAddress") + " ✓");
      onSaved(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("addrLabelName")}>
          <Input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Гэр" />
        </Field>
        <Field label={t("addrRecipient")} required>
          <Input value={form.recipient} onChange={(e) => set("recipient", e.target.value)} />
        </Field>
      </div>

      <Field label={t("addrPhone")} required>
        <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" placeholder="99112233" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("addrCity")} required>
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Улаанбаатар" />
        </Field>
        <Field label={t("addrDistrict")}>
          <Input value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="Сүхбаатар" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("addrKhoroo")}>
          <Input value={form.khoroo} onChange={(e) => set("khoroo", e.target.value)} placeholder="1-р хороо" />
        </Field>
        <Field label={t("addrDetail")} required>
          <Input value={form.detail} onChange={(e) => set("detail", e.target.value)} placeholder="12-р байр, 3 тоот" />
        </Field>
      </div>

      <Field label={t("addrNote")}>
        <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} rows={2} />
      </Field>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={form.is_default} onCheckedChange={(v) => set("is_default", !!v)} />
        {t("addrSetDefault")}
      </label>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="flex-1 rounded-full font-bold">
          {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
          {t("saveAddress")}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>
            {t("cancelBtn")}
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
