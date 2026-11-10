import { AnimatePresence, motion } from "motion/react";
import { formatDistanceToNowStrict, format } from "date-fns";
import type { PotView } from "@/lib/kitty.functions";
import { formatMoney, initials, stillToChipIn } from "@/lib/kitty";
import { PotMeter } from "./PotMeter";
import { AgentFeed } from "./AgentFeed";
import { MoneyPill } from "./Money";
import { CommissionNote, PickCard, PickSkeleton } from "./PickCard";
import { LayoutGroup } from "motion/react";
import { nextUnlock } from "@/lib/scoring";

export function Deadline({ at }: { at: string }) {
  const d = new Date(at);
  const past = d.getTime() < Date.now();
  return (
    <span className="tabular" suppressHydrationWarning>
      {past ? "Closed" : `Closes in ${formatDistanceToNowStrict(d)}`} · {format(d, "EEE d MMM, HH:mm")}
    </span>
  );
}

/** Builds the agent's current status and the honest 'up next' list from what we know today. */
export function agentNarration(view: PotView) {
  const { pot, raised, candidates } = view;
  if (pot.status === "cancelled") return { working: undefined, upNext: [] as string[] };
  const topic = pot.likes[0] ?? "thoughtful";
  const ranked = candidates.some((c) => c.rank != null);
  let working: string | undefined;
  if (pot.agent_working) working = pot.agent_working;
  else if (pot.agent_busy) working = "Thinking...";
  else if (view.people === 0) working = "Waiting for the first chip-in...";
  else working = ranked ? `Watching the pot at ${formatMoney(raised, pot.currency)}. Ready to re-rank.` : `Watching the pot at ${formatMoney(raised, pot.currency)}. Lining up ${topic} gifts...`;
  const upNext = ranked
    ? [pot.vote_window === "off" ? "Choose the best fit and start the veto countdown" : "Open the final vote"]
    : [`Search shops for ${topic} gifts under ${formatMoney(Math.max(raised, 30), pot.currency)}`, "Rank picks against what the group voted for", pot.vote_window === "off" ? "Choose the best fit and start the veto countdown" : "Open the final vote"];
  return { working, upNext };
}

export function topPicks(view: PotView) {
  return view.candidates.filter((c) => c.rank != null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).slice(0, 3);
}

export function PicksGrid({ view, compact = false }: { view: PotView; compact?: boolean }) {
  const picks = topPicks(view);
  const note = view.events.find((e) => e.kind === "reranked");
  if (!picks.length) {
    return (
      <>
        <p className="mb-4 text-[15px] text-muted-foreground">Kitty starts picking gifts as the pot grows.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <PickSkeleton />
          <PickSkeleton />
          <div className="hidden sm:block"><PickSkeleton /></div>
        </div>
      </>
    );
  }
  return (
    <>
      {note && <p className="mb-4 font-mono text-[12.5px] text-muted-foreground">{note.message}</p>}
      <LayoutGroup>
        <div className={compact ? "grid grid-cols-1 gap-3 sm:grid-cols-3" : "grid gap-4 sm:grid-cols-3"}>
          {picks.map((c) => (
            <PickCard key={c.id} currency={view.pot.currency} pick={c} />
          ))}
        </div>
      </LayoutGroup>
    </>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3 border-b pb-3">
      <h2 className="text-[26px]">{children}</h2>
      {aside}
    </div>
  );
}

export function PotLive({ view, showMeter = true }: { view: PotView; showMeter?: boolean }) {
  const { pot, raised, people, contributors, signatures, events, candidates } = view;
  const still = stillToChipIn(pot.expected_count, people);
  const { working, upNext } = agentNarration(view);
  const unlock = nextUnlock(candidates, raised);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <AgentFeed lines={events} working={working} upNext={upNext} />
      </div>

      <div className="space-y-10">
        {showMeter && (
          <div className="space-y-4">
            <PotMeter raised={raised} target={pot.target_amount} currency={pot.currency} people={people} footer={<Deadline at={pot.deadline_at} />} />
            <p className="text-[14px] text-muted-foreground">
              {unlock
                ? `At ${formatMoney(Number(unlock.price), pot.currency)} the ${unlock.title} comes into reach.`
                : "Kitty will flag the next gift that comes into reach as the pot grows."}
            </p>
          </div>
        )}

        <section>
          <SectionTitle aside={still > 0 && pot.status === "collecting" ? <span className="text-[13px] text-muted-foreground tabular">{still} still to chip in</span> : null}>Who's in</SectionTitle>
          {contributors.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">Nobody yet. Faces appear the moment someone chips in.</p>
          ) : (
            <ul className="divide-y">
              <AnimatePresence initial={false}>
                {contributors.map((c, i) => (
                  <motion.li key={c.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="flex min-h-14 items-center gap-3">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full border text-[12px] font-medium ${c.name ? "bg-card" : "bg-muted text-muted-foreground"}`}>{c.name ? initials(c.name) : "?"}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px]">{c.name ?? "Anonymous"}</span>
                    <span className="text-[15px] tabular">{c.amount != null ? formatMoney(c.amount, pot.currency) : <span className="text-[13px] text-muted-foreground">amount hidden</span>}</span>
                    <MoneyPill state={c.status === "captured" ? "paid" : "held"} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>

        <section>
          <SectionTitle>Gift picks</SectionTitle>
          <PicksGrid view={view} />
          <div className="mt-3"><CommissionNote /></div>
        </section>

        <section>
          <SectionTitle>The card</SectionTitle>
          {signatures.length === 0 ? (
            <p className="text-[15px] text-muted-foreground">No messages yet. They land here as people chip in.</p>
          ) : (
            <ul className="divide-y">
              {signatures.map((s) => (
                <li key={s.id} className="py-4">
                  <p className="font-display text-[22px] leading-snug italic">"{s.message}"</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">{s.name}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
