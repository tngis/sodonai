"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, Plus, Pencil, Trash2, Star, Loader2 } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { listAddresses, deleteAddress, setDefaultAddress } from "@/app/actions/addresses";
import { formatAddress } from "@/lib/address";
import { AddressForm } from "@/components/print/address-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];

export function AddressManager() {
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAddresses(await listAddresses());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteAddress(id);
      await load();
      toast.success(t("deleteBtn") + " ✓");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDefault = async (id: string) => {
    setBusyId(id);
    try {
      await setDefaultAddress(id);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Skeleton className="h-20 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-2">
      {addresses.map((a) =>
        editingId === a.id ? (
          <AddressForm
            key={a.id}
            initial={a}
            onSaved={async () => { setEditingId(null); await load(); }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={a.id} className="flex items-start gap-3 rounded-xl border border-border p-3">
            <MapPin size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {a.recipient}
                {a.label && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{a.label}</span>}
                {a.is_default && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">{t("addrDefault")}</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{a.phone} · {formatAddress(a)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!a.is_default && (
                <button
                  onClick={() => handleDefault(a.id)}
                  disabled={busyId === a.id}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t("addrSetDefault")}
                >
                  <Star size={15} />
                </button>
              )}
              <button
                onClick={() => setEditingId(a.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t("editBtn")}
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => handleDelete(a.id)}
                disabled={busyId === a.id}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={t("deleteBtn")}
              >
                {busyId === a.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              </button>
            </div>
          </div>
        )
      )}

      {adding ? (
        <AddressForm
          onSaved={async () => { setAdding(false); await load(); }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button
          variant="outline"
          className={cn("rounded-xl", addresses.length === 0 && "border-dashed")}
          onClick={() => setAdding(true)}
        >
          <Plus size={16} className="mr-2" /> {t("addAddressBtn")}
        </Button>
      )}
    </div>
  );
}
