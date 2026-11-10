import { KittyMascot } from "./KittyMascot";
import { DemoTag } from "./Logo";
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
import { mascotStateFor } from "./KittyMascot";

export function Deadline({ at }: { at: string }) {
  const d = new Date(at);
  const past = d.getTime() < Date.now();
  return (
    <span className="tabular" suppressHydrationWarning>
      {past ? "Closed" : `Closes in ${formatDistanceToNowStrict(d)}`} · {format(d, "EEE d MMM, HH:mm")}
    </span>
  );
}

/** Kitty's in-flight line (only while something is actually happening) and the honest 'next up' list. */
export function agentNarration(view: PotView) {
  const { pot, raised, candidates } = view;
  const working = pot.agent_working ?? (pot.agent_busy ? "Having a think" : undefined);
  if (pot.status === "cancelled" || pot.status === "done") return { working: undefined, upNext: [] as string[] };
  if (pot.status === "voting") return { working, upNext: ["Once the vote closes, I'll start a short countdown before buying"] };
  if (pot.status === "veto") return { working, upNext: ["Check the price and every hold one last time", "Take each person's share and release the rest"] };
  if (pot.status === "buying") return { working: working ?? "Buying the gift", upNext: ["Send everyone the receipt"] };
  const topic = pot.likes[0] ?? "thoughtful";
  const ranked = candidates.some((c) => c.rank != null);
  const vote = pot.vote_window === "off" ? "Pick the best fit and start a short countdown" : "Open the final vote";
  const upNext = view.people === 0
    ? ["Wait for the first chip-in", `Look for ${topic} gifts as the pot grows`]
    : ranked
      ? [`Keep an eye on the pot at ${formatMoney(raised, pot.currency)}`, vote]
      : [`Look for ${topic} gifts under ${formatMoney(Math.max(raised, 30), pot.currency)}`, "Weigh them up against the group's votes", vote];
  return { working, upNext };
}

export function potMascot(view: PotView) {
  const latest = view.events[0];
  return mascotStateFor({ status: view.pot.status, working: view.pot.agent_working, busy: view.pot.agent_busy, latestKind: latest?.kind ?? null, latestAt: latest?.at ?? null });
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
        <p className="mb-4 flex items-center gap-3 text-[15px] text-muted-foreground">
          <KittyMascot state="idle" size={56} />
          {!view.config.shop
            ? "Gift search switches on once the shop key is added."
            : view.raised < 30
              ? `No picks yet. I start looking once the pot reaches ${formatMoney(30, view.pot.currency)}.`
              : "I'm looking for gifts now. Picks land here in a moment."}
        </p>
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
      {note && <p className="mb-4 text-[14px] text-muted-foreground">{note.message}</p>}
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
        <AgentFeed lines={events} working={working} upNext={upNext} mascot={potMascot(view)} fill={pot.target_amount ? raised / pot.target_amount : 0} />
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
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5"><span className="truncate text-[15px]">{c.name ?? "Anonymous"}</span>{c.seeded && <DemoTag />}</span>
                      {c.demoHold && <span className="block text-[12px] text-muted-foreground">demo hold, not a real PayPal hold</span>}
                    </span>
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
