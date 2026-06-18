"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { useUserGenerations } from "@/lib/use-generations";
import { getLastSeen, markSeenNow } from "@/lib/notif-seen";
import { getNotificationThumbs } from "@/app/actions/storage";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";

export default function NotificationsPage() {
  const { t } = useLang();
  const router = useRouter();
  const { finished, loading } = useUserGenerations();
  const [lastSeen] = useState(() => getLastSeen());
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [thumbsLoading, setThumbsLoading] = useState(false);

  useEffect(() => {
    markSeenNow();
  }, []);

  useEffect(() => {
    if (!finished.length) return;
    const doneIds = finished
      .filter((g) => g.status === "done")
      .map((g) => g.id);
    if (!doneIds.length) return;
    setThumbsLoading(true);
    getNotificationThumbs(doneIds).then((result) => {
      setThumbs(result);
      setThumbsLoading(false);
    });
  }, [finished]);

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => router.back()}
            aria-label="Буцах"
            className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 md:hidden"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">
            {t("notifications")}
          </h1>
        </div>
        <NotificationsPanel
          items={finished}
          loading={loading}
          lastSeen={lastSeen}
          thumbs={thumbs}
          thumbsLoading={thumbsLoading}
        />
      </div>
    </div>
  );
}
