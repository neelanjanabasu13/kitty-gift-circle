import { motion } from "motion/react";
import { Check, HeartHandshake, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/kitty";
import { MoneyPill } from "./Money";

// Styles for later phases. They take plain props so phase 2/3 can wire real data in.

export function FinalVote({ picks, currency, closesLine }: { picks: { id: string; title: string; price: number; votes: number }[]; currency: string; closesLine: string }) {
  const total = Math.max(1, picks.reduce((s, p) => s + p.votes, 0));
  return (
    <section className="space-y-5">
      <h2 className="text-[36px]">Pick one for Priya.</h2>
      <ul className="space-y-2">
        {picks.map((p) => {
          const pct = Math.round((p.votes / total) * 100);
          return (
            <li key={p.id}>
              <button type="button" className="relative w-full overflow-hidden rounded-[12px] border bg-card px-4 py-4 text-left transition-colors hover:border-foreground/30">
                <motion.span className="absolute inset-y-0 left-0 bg-muted" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
                <span className="relative flex items-center justify-between gap-3">
                  <span className="text-[15px] font-medium">{p.title}</span>
                  <span className="text-[13px] text-muted-foreground tabular">{formatMoney(p.price, currency)} · {pct}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] text-muted-foreground">{closesLine}</p>
    </section>
  );
}

export function VetoCountdown({ title, price, currency, at, why, secondsLeft, totalSeconds }: { title: string; price: number; currency: string; at: string; why: string; secondsLeft: number; totalSeconds: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  return (
    <section className="space-y-8 text-center">
      <h2 className="mx-auto max-w-xl text-[40px] md:text-[52px]">Buying the {title} for {formatMoney(price, currency)} at {at} <em>unless you veto.</em></h2>
      <div className="relative mx-auto size-40">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
          <defs>
            <linearGradient id="ember-ring" x1="0" x2="1">
              <stop offset="0%" stopColor="var(--ember-1)" />
              <stop offset="50%" stopColor="var(--ember-2)" />
              <stop offset="100%" stopColor="var(--ember-3)" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="6" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="url(#ember-ring)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-mono text-[30px] tabular">{mm}:{ss}</span>
      </div>
      <p className="mx-auto flex max-w-md justify-center gap-1.5 font-display text-[20px] italic"><Sparkles className="mt-1.5 size-4 shrink-0 text-ember-2" />{why}</p>
      <div className="mx-auto grid max-w-sm grid-cols-2 gap-2">
        <Button variant="quiet" size="xl">Swap</Button>
        <Button variant="ink" size="xl">Veto</Button>
      </div>
      <button type="button" className="min-h-11 text-[13px] text-muted-foreground underline-offset-4 hover:underline">Buy now</button>
    </section>
  );
}

export function Receipt({ recipient, item, retailer, currency, total, released, captureId, payoutId, contributions, notes }: {
  recipient: string; item: string; retailer: string; currency: string; total: number; released: number; captureId: string; payoutId: string;
  contributions: { name: string; amount: number }[]; notes: { name: string; message: string }[];
}) {
  return (
    <section className="space-y-8">
      <div className="surface mx-auto max-w-md p-6">
        <div className="flex items-center justify-between border-b pb-4">
          <span className="font-display text-[26px]">Receipt</span>
          <MoneyPill state="paid" />
        </div>
        <dl className="divide-y text-[14px]">
          <Row k="Gift" v={item} />
          <Row k="Shop" v={retailer} />
          <Row k="For" v={recipient} />
          {contributions.map((c) => <Row key={c.name} k={c.name} v={<span className="flex items-center gap-2 tabular">{formatMoney(c.amount, currency, { exact: true })}<MoneyPill state="paid" /></span>} />)}
          <Row k="Released" v={<span className="flex items-center gap-2 tabular">{formatMoney(released, currency)}<MoneyPill state="released" /></span>} />
          <Row k="Total paid" v={<span className="text-[16px] font-semibold tabular">{formatMoney(total, currency, { exact: true })}</span>} />
          <Row k="Capture ID" v={<span className="font-mono text-[12px]">{captureId}</span>} />
          <Row k="Payout ID" v={<span className="font-mono text-[12px]">{payoutId}</span>} />
        </dl>
      </div>
      <div className="mx-auto max-w-md space-y-3">
        <p className="text-[13px] text-muted-foreground">The card</p>
        {notes.map((n, i) => (
          <div key={n.name} className="surface p-5" style={{ transform: `rotate(${i % 2 ? 0.8 : -0.8}deg)` }}>
            <p className="font-display text-[22px] leading-snug italic">"{n.message}"</p>
            <p className="mt-2 text-[13px] text-muted-foreground">{n.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

export function Cancelled() {
  return (
    <section className="mx-auto max-w-lg space-y-4 py-10 text-center">
      <HeartHandshake className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-[44px] md:text-[56px]">Kitty's off.</h1>
      <p className="text-[16px] text-muted-foreground">Every hold was released and nobody was charged.</p>
      <MoneyPill state="released" />
    </section>
  );
}

export function SuccessTick() {
  return (
    <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="mx-auto grid size-20 place-items-center rounded-full bg-foreground text-background">
      <Check className="size-10" strokeWidth={2.5} />
    </motion.div>
  );
}
