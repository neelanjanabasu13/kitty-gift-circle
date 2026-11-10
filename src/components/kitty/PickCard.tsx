import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/kitty";

export type Pick = { id: string; title: string; image_url?: string | null; retailer?: string | null; category?: string | null; price?: number | null; currency?: string | null; reason?: string | null; rank?: number | null; votes?: number };

export function PickCard({ pick, currency }: { pick: Pick; currency: string }) {
  return (
    <motion.article layout transition={{ type: "spring", stiffness: 380, damping: 34 }} className="overflow-hidden rounded-[14px] border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="relative aspect-[4/3] bg-muted">
        {pick.image_url ? <img src={pick.image_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="h-full w-full shimmer" />}
        {pick.rank != null && <span className="absolute top-3 left-3 grid size-7 place-items-center rounded-full bg-card font-mono text-[12px] tabular">{pick.rank}</span>}
      </div>
      <div className="space-y-1.5 p-4">
        <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{[pick.retailer, pick.category].filter(Boolean).join(" · ")}</p>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-sans text-[15px] leading-snug font-medium tracking-normal">{pick.title}</h3>
          {pick.price != null && <span className="text-[15px] font-medium tabular">{formatMoney(Number(pick.price), pick.currency ?? currency)}</span>}
        </div>
        {pick.reason && (
          <p className="flex gap-1.5 font-display text-[17px] leading-snug italic">
            <Sparkles className="mt-1 size-3.5 shrink-0 text-ember-2" aria-hidden="true" />
            {pick.reason}
          </p>
        )}
        {pick.votes != null && <p className="text-[13px] text-muted-foreground tabular">{pick.votes} {pick.votes === 1 ? "vote" : "votes"}</p>}
      </div>
    </motion.article>
  );
}

export function PickSkeleton() {
  return (
    <div className="overflow-hidden rounded-[14px] border bg-card">
      <div className="aspect-[4/3] shimmer" />
      <div className="space-y-2 p-4">
        <div className="h-2.5 w-1/3 rounded-full shimmer" />
        <div className="h-3.5 w-4/5 rounded-full shimmer" />
        <div className="h-3.5 w-3/5 rounded-full shimmer" />
      </div>
    </div>
  );
}

export function CommissionNote() {
  return <p className="text-[12px] text-muted-foreground">We may earn a commission when you buy through links on this page.</p>;
}
