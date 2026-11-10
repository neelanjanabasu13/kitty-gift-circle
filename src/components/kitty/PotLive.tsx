import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { formatDistanceToNowStrict, format } from "date-fns";
import { Sparkles, Users, PenLine, Gift, Clock } from "lucide-react";
import type { PotView } from "@/lib/kitty.functions";
import { formatMoney, initials, stillToChipIn } from "@/lib/kitty";
import { PotMeter } from "./PotMeter";

export function Deadline({ at }: { at: string }) {
  const d = new Date(at);
  const past = d.getTime() < Date.now();
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground" suppressHydrationWarning>
      <Clock className="size-4" />
      {past ? "Deadline passed" : `Closes in ${formatDistanceToNowStrict(d)}`} · {format(d, "EEE d MMM, HH:mm")}
    </span>
  );
}

export function Section({ icon, title, children, aside }: { icon: React.ReactNode; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="kitty-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-accent-foreground">{icon}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function PotLive({ view }: { view: PotView }) {
  const { pot, raised, people, contributors, signatures, events } = view;
  const still = stillToChipIn(pot.expected_count, people);

  return (
    <div className="space-y-4">
      <section className="kitty-card p-5">
        <PotMeter raised={raised} target={pot.target_amount} currency={pot.currency} people={people} />
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Deadline at={pot.deadline_at} />
        </div>
      </section>

      <Section icon={<Users className="size-4" />} title="Who's in" aside={still > 0 && pot.status === "collecting" ? <span className="text-sm font-medium text-primary">{still} still to chip in</span> : null}>
        {contributors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody yet. Faces appear here the moment someone chips in.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            <AnimatePresence initial={false}>
              {contributors.map((c) => (
                <motion.li key={c.id} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="flex w-16 flex-col items-center gap-1 text-center">
                  <span className={`grid size-12 place-items-center rounded-full text-sm font-semibold ${c.name ? "bg-primary-soft text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                    {c.name ? initials(c.name) : "?"}
                  </span>
                  <span className="w-full truncate text-xs font-medium">{c.name ?? "Anonymous"}</span>
                  <span className="text-[11px] text-muted-foreground">{c.amount != null ? formatMoney(c.amount, pot.currency) : "amount hidden"}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Section>

      <Section icon={<Gift className="size-4" />} title="Gift picks">
        <p className="mb-4 text-sm text-muted-foreground">Kitty starts picking gifts as the pot grows.</p>
        <LayoutGroup>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <motion.div key={i} layout className="space-y-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <div className="aspect-square rounded-2xl shimmer" />
                <div className="h-3 w-4/5 rounded-full shimmer" />
                <div className="h-3 w-1/2 rounded-full shimmer" />
              </motion.div>
            ))}
          </div>
        </LayoutGroup>
      </Section>

      <Section icon={<PenLine className="size-4" />} title="The card">
        {signatures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Signatures land here as people chip in.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {signatures.map((s, i) => (
              <motion.li key={s.id} layout initial={{ opacity: 0, rotate: i % 2 ? 1.5 : -1.5 }} animate={{ opacity: 1, rotate: i % 2 ? 0.6 : -0.6 }} className="rounded-2xl bg-secondary p-4">
                <p className="font-display text-[15px] leading-snug italic">"{s.message}"</p>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">{s.name}</p>
              </motion.li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Sparkles className="size-4" />} title="Agent activity">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Kitty's watching the pot. Updates appear here.</p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-primary-soft pl-5">
            <AnimatePresence initial={false}>
              {events.map((e) => (
                <motion.li key={e.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="relative">
                  <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-card bg-primary" />
                  <p className="text-sm">{e.message}</p>
                  <p className="text-xs text-muted-foreground" suppressHydrationWarning>{formatDistanceToNowStrict(new Date(e.at))} ago</p>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </Section>
    </div>
  );
}
