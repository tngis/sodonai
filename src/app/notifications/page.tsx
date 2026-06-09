"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useUserGenerations } from "@/lib/use-generations";
import { getLastSeen, markSeenNow } from "@/lib/notif-seen";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";

export default function NotificationsPage() {
  const { t } = useLang();
  const { finished, loading } = useUserGenerations();
  // Capture lastSeen before marking, so items new on this visit still highlight.
  const [lastSeen] = useState(() => getLastSeen());

  useEffect(() => { markSeenNow(); }, []);

  return (
    <div className="px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-black tracking-tight md:text-3xl">{t("notifications")}</h1>
        <NotificationsPanel items={finished} loading={loading} lastSeen={lastSeen} />
      </div>
    </div>
  );
}
