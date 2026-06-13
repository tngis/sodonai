"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Loader2, ImageOff } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { getOutputUrls } from "@/app/actions/storage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface PickerItem {
  path: string;
  url: string;
}

// Modal that lists the user's saved gallery images so one can be picked as the
// profile picture. Mirrors the gallery/print asset-loading flow (paths → signed
// URLs via getOutputUrls). Loads lazily the first time it's opened.
export function GalleryPicker({
  open,
  onOpenChange,
  onSelect,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (storagePath: string) => void;
  busy?: boolean;
}) {
  const { t } = useLang();
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [selecting, setSelecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    // Local session read (no network); the assets query is RLS-scoped.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setLoading(false); setLoaded(true); return; }

    const { data: assets } = await supabase
      .from("assets")
      .select("storage_path, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (assets?.length) {
      const paths = assets.map((a) => a.storage_path);
      const signed = await getOutputUrls(paths);
      setItems(paths.map((path, i) => ({ path, url: signed[i] ?? "" })));
    }
    setLoading(false);
    setLoaded(true);
  }, []);

  // Load once, the first time the dialog opens.
  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded, load]);

  const handlePick = (path: string) => {
    setSelecting(path);
    onSelect(path);
  };

  // Reset the per-item spinner when the parent finishes (dialog stays open on error).
  useEffect(() => { if (!busy) setSelecting(null); }, [busy]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("chooseFromGallery")}</DialogTitle>
          <DialogDescription>{t("pickFromGallery")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <ImageOff size={36} className="text-muted-foreground/50" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">{t("noImages")}</p>
            <Button render={<Link href="/generate" />} size="sm" className="rounded-full">
              {t("startGenerating")}
            </Button>
          </div>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
            {items.map((item) => (
              <button
                key={item.path}
                type="button"
                disabled={!!selecting}
                onClick={() => handlePick(item.path)}
                className="group relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10 transition hover:ring-2 hover:ring-primary disabled:opacity-60"
              >
                {item.url ? (
                  <Image
                    src={item.url}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 33vw, 160px"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <AlertTriangle size={18} className="text-muted-foreground" />
                  </div>
                )}
                {selecting === item.path && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 size={20} className="animate-spin text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
