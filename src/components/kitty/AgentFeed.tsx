import { AnimatePresence, motion } from "motion/react";
import { formatDistanceToNowStrict } from "date-fns";
import { Ban, Check, Clock, Coins, Gift, Heart, RotateCcw, Search, Sparkles, Vote, Wand2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { KittyMascot, type MascotState } from "./KittyMascot";

export type AgentLine = { id: string; at: string; message: string; kind?: string };

function ago(at: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 1000));
  if (s < 45) return "just now";
  return `${formatDistanceToNowStrict(new Date(at)).replace(/ minutes?/, " min").replace(/ hours?/, " hr").replace(/ days?/, "d").replace(/ seconds?/, "s")} ago`;
}

const ICONS: Record<string, LucideIcon> = {
  contribution_held: Coins, target_reached: Coins, contribution_withdrawn: RotateCcw,
  planned: Wand2, searched: Search, band_crossed: Search, final_search: Search, votes_shift: Vote, dropped: Ban,
  reranked: Sparkles, vote_open: Vote, vote_closed: Vote, veto_started: Clock, swapped: Clock, buy_now: Gift,
  prebuy_ok: Gift, prebuy_price: Gift, prebuy_moved: Gift, capture_planned: Gift, captured: Gift, paid_out: Check, payout_fallback: Check,
  pot_cancelled: Heart, pot_created: Gift, profile_learned: Heart, profile_updated: Heart,
};
export function iconFor(kind?: string): LucideIcon {
  return (kind && ICONS[kind]) || Sparkles;
}

function Typing() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => <span key={i} className="typing-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 0.15}s` }} />)}
    </span>
  );
}

/** Warm light panel: Kitty texting updates, newest first. */
export function AgentFeed({ lines, working, upNext = [], title = "Kitty", mascot = "idle", fill = 0, className }: {
  lines: AgentLine[]; working?: string | undefined; upNext?: string[]; title?: string; mascot?: MascotState; fill?: number; className?: string;
}) {
  return (
    <section aria-label="What Kitty is doing" className={cn("overflow-hidden rounded-[14px] border bg-card shadow-soft", className)}>
      <header className="flex items-center gap-3 border-b bg-kraft-soft/60 px-5 py-3">
        <KittyMascot state={mascot} fill={fill} size={72} />
        <div className="min-w-0">
          <p className="font-display text-[26px] leading-none">{title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground"><span className="size-1.5 rounded-full bg-signal" />Keeping you posted</p>
        </div>
      </header>
      <ol className="px-5 py-3 text-[15px] leading-snug" aria-live="polite">
        {working && (
          <li className="flex items-start gap-3 py-2.5">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-kraft-soft"><Sparkles className="size-3.5 text-kraft-deep" /></span>
            <span className="min-w-0 flex-1">{working}</span>
            <span className="mt-2 shrink-0"><Typing /></span>
          </li>
        )}
        <AnimatePresence initial={false}>
          {lines.map((l) => {
            const Icon = iconFor(l.kind);
            return (
              <motion.li key={l.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="flex items-start gap-3 border-t border-border/60 py-2.5 first:border-t-0">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted"><Icon className="size-3.5 text-muted-foreground" /></span>
                <span className="min-w-0 flex-1">{l.message}</span>
                <span className="mt-0.5 shrink-0 text-[12px] text-muted-foreground tabular" suppressHydrationWarning>{ago(l.at)}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {lines.length === 0 && !working && <li className="py-2.5 text-muted-foreground">I'm settling in. Updates will land here.</li>}
        {upNext.length > 0 && (
          <li className="mt-2 border-t pt-3 pb-1">
            <p className="text-[13px] text-muted-foreground">Next up</p>
            <ul className="mt-1 space-y-1">
              {upNext.map((u) => <li key={u} className="text-[14px] text-muted-foreground">{u}</li>)}
            </ul>
          </li>
        )}
      </ol>
    </section>
  );
}

/** One-line Kitty status for small spaces. */
export function AgentTicker({ text, className, mascot = "idle" }: { text: string; className?: string; mascot?: MascotState }) {
  return (
    <div className={cn("flex min-h-11 items-center gap-2.5 rounded-full border bg-card px-3 py-1.5 shadow-hairline", className)} role="status">
      <KittyMascot state={mascot} size={28} />
      <AnimatePresence mode="wait">
        <motion.span key={text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="truncate text-[14px]">
          {text}
        </motion.span>
      </AnimatePresence>
      <span className="ml-auto pl-1"><Typing /></span>
    </div>
  );
}
