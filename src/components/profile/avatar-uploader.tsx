"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImageIcon, Trash2, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/contexts/LanguageContext";
import { uploadAvatar, setAvatarFromGallery, removeAvatar } from "@/app/actions/profile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GalleryPicker } from "@/components/profile/gallery-picker";

// Profile-picture control: shows the current avatar (or a placeholder) with
// three actions — upload from device, choose from the user's gallery, remove.
export function AvatarUploader({
  initialUrl,
  onChange,
}: {
  initialUrl: string | null;
  onChange?: (url: string | null) => void;
}) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const apply = (next: string | null) => {
    setUrl(next);
    onChange?.(next);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const newUrl = await uploadAvatar(fd);
      apply(newUrl || null);
      toast.success(t("avatarUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  };

  const handlePick = async (storagePath: string) => {
    setBusy(true);
    try {
      const newUrl = await setAvatarFromGallery(storagePath);
      apply(newUrl || null);
      setPickerOpen(false);
      toast.success(t("avatarUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await removeAvatar();
      apply(null);
      toast.success(t("avatarRemoved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar / placeholder — the camera badge opens an actions menu */}
      <div className="relative h-28 w-28 shrink-0">
        <div className="h-28 w-28 overflow-hidden rounded-full bg-linear-to-br from-primary/30 to-primary/5 ring-2 ring-border">
          {url ? (
            <Image
              src={url}
              alt={t("profilePicture")}
              width={112}
              height={112}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <User size={44} />
            </div>
          )}
        </div>
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <Loader2 size={24} className="animate-spin text-white" />
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy}
            aria-label={t("changePhoto")}
            className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-(--shadow-card) transition hover:brightness-110 active:scale-95 disabled:opacity-60"
          >
            <Camera size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-xl p-1.5">
            <DropdownMenuItem
              onClick={() => fileRef.current?.click()}
              className="gap-2 rounded-lg px-2 py-2"
            >
              <Camera size={16} /> {t("uploadFromDevice")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setPickerOpen(true)}
              className="gap-2 rounded-lg px-2 py-2"
            >
              <ImageIcon size={16} /> {t("chooseFromGallery")}
            </DropdownMenuItem>
            {url && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleRemove}
                  className="gap-2 rounded-lg px-2 py-2"
                >
                  <Trash2 size={16} /> {t("removePhoto")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={handleFile}
      />

      <GalleryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePick}
        busy={busy}
      />
    </div>
  );
}
