"use client";

import { CheckIcon, Share2Icon } from "lucide-react";
import { useState } from "react";
import type { Policy } from "@/lib/types";
import { shortUrl } from "@/lib/share";
import { WhatsAppIcon } from "@/components/icons/whatsapp";

/** Share a law: native share sheet on phones, copy the link elsewhere, plus a direct WhatsApp link. */
export function ShareButtons({ p }: { p: Pick<Policy, "id" | "title" | "summary" | "shareUrl"> }) {
  const url = p.shareUrl ?? shortUrl(p.id);
  const text = `${p.title}: ${p.summary}`;
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: p.title, text, url });
        return;
      } catch (e) {
        // The person closed the share sheet: nothing to do.
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button onClick={share} className="bg-secondary flex items-center justify-center gap-2 rounded-2xl p-3 text-[15px] font-bold" aria-live="polite">
        {copied ? <CheckIcon className="size-4" /> : <Share2Icon className="size-4" />}
        {copied ? "Link copiado" : "Compartilhar"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-secondary flex items-center justify-center gap-2 rounded-2xl p-3 text-[15px] font-bold"
      >
        <WhatsAppIcon className="size-4 text-[#25d366]" /> WhatsApp
      </a>
    </div>
  );
}
