import { AnimatePresence, motion } from "motion/react";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import { KittyMark } from "./Logo";

export type AgentLine = { id: string; at: string; message: string; kind?: string };

function ago(at: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  return formatDistanceToNowStrict(new Date(at)).replace(/ minutes?/, "m").replace(/ hours?/, "h").replace(/ days?/, "d").replace(/ seconds?/, "s");
}

/** Dark agent panel: Kitty narrating what it's doing, newest first. */
export function AgentFeed({ lines, working, upNext = [], title = "Kitty", className }: { lines: AgentLine[]; working?: string | undefined; upNext?: string[]; title?: string; className?: string }) {
  return (
    <section aria-label="Agent activity" className={cn("ember-glow", className)}>
      <div className="overflow-hidden rounded-[14px] border border-agent-border bg-agent text-agent-foreground">
        <header className="flex items-center justify-between border-b border-agent-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <KittyMark className="size-5" live />
            <span className="text-[14px] font-medium">{title}</span>
          </div>
          <span className="font-mono text-[11px] tracking-wider text-agent-muted uppercase">Agent · live</span>
        </header>
        <ol className="space-y-0 px-5 py-4 font-mono text-[13px] leading-relaxed" aria-live="polite">
          {working && (
            <li className="flex gap-3 py-1.5">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ember" />
              <span className="shimmer-text">{working}</span>
            </li>
          )}
          <AnimatePresence initial={false}>
            {lines.map((l) => (
              <motion.li key={l.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="flex gap-3 py-1.5">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-agent-muted/50" />
                <span className="min-w-0 flex-1">{l.message}</span>
                <span className="shrink-0 text-[11px] text-agent-muted tabular" suppressHydrationWarning>{ago(l.at)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
          {lines.length === 0 && !working && <li className="py-1.5 text-agent-muted">Kitty's warming up. Updates land here.</li>}
          {upNext.length > 0 && (
            <>
              <li className="pt-4 pb-1 text-[11px] tracking-wider text-agent-muted uppercase">Up next</li>
              {upNext.map((u) => (
                <li key={u} className="flex gap-3 py-1 text-agent-muted">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full border border-agent-muted/60" />
                  <span>{u}</span>
                </li>
              ))}
            </>
          )}
        </ol>
      </div>
    </section>
  );
}

/** One-line agent status for small spaces. */
export function AgentTicker({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex min-h-11 items-center gap-3 rounded-full border border-agent-border bg-agent px-4 py-2 text-agent-foreground", className)} role="status">
      <KittyMark className="size-4 shrink-0" live />
      <AnimatePresence mode="wait">
        <motion.span key={text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="shimmer-text truncate font-mono text-[12.5px]">
          {text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
