import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getSharePageData } from "@/lib/share-server";
import { Button } from "@/components/ui/button";

// Public landing for a shared generation. No auth (it's not a PROTECTED_ROUTE),
// so a Facebook/Messenger visitor lands straight here. generateMetadata supplies
// the branded og:image + a "make one too" hook; the body funnels into the app.

type Params = { params: Promise<{ token: string }> };

const DESCRIPTION = "AI-аар бүтээсэн зураг. Чи ч бас секундын дотор ийм зургаа хий.";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const data = await getSharePageData(token);
  if (!data) return { title: "aistudio.mn" };

  const title = data.presetName ? `${data.presetName} — aistudio.mn` : "aistudio.mn — AI зураг";
  return {
    title,
    description: DESCRIPTION,
    openGraph: {
      title,
      description: DESCRIPTION,
      type: "website",
      url: `/s/${token}`,
      images: [{ url: data.cardUrl, width: 1200, height: 1200 }],
    },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION, images: [data.cardUrl] },
  };
}

export default async function SharePage({ params }: Params) {
  const { token } = await params;
  const data = await getSharePageData(token);
  if (!data) notFound();

  // Logged-out visitors hitting a /generate/<presetId> link get funneled through
  // /auth (the proxy redirects + remembers ?next) — exactly the signup we want.
  const cta = data.presetId ? `/generate/${data.presetId}` : "/generate";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-8 text-center">
      <div className="w-full overflow-hidden rounded-2xl shadow-(--shadow-card)">
        {/* Plain <img>: the branded card has an unknown aspect ratio, so next/image
            with fixed width/height would distort it. The host is allow-listed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.cardUrl} alt={data.presetName ?? "AI зураг"} className="h-auto w-full" />
      </div>

      <h1 className="mt-6 font-display text-2xl font-black tracking-tight text-embossed">
        {data.presetName ?? "AI-аар бүтээсэн зураг"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{DESCRIPTION}</p>

      <Button
        render={<Link href={cta} />}
        variant="shadow"
        className="mt-6 w-full justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground"
      >
        <Sparkles size={18} /> Чи ч бас ийм зураг хий
      </Button>
    </div>
  );
}
