import { motion } from "motion/react";
import { Check, HeartHandshake, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/kitty";
import { MoneyPill } from "./Money";

// Styles for later phases. They take plain props so phase 2/3 can wire real data in.

export type VotePick = { id: string; title: string; price: number; votes: number; retailer?: string | null };

export function FinalVote({ name, picks, currency, closesLine, myVote, canVote = false, busy = false, onVote }: {
  name: string; picks: VotePick[]; currency: string; closesLine: string; myVote?: string | null; canVote?: boolean; busy?: boolean; onVote?: (id: string | null) => void;
}) {
  const total = Math.max(1, picks.reduce((s, p) => s + p.votes, 0));
  return (
    <section className="space-y-5">
      <h2 className="text-[36px]">Pick one for {name}.</h2>
      <ul className="space-y-2">
        {picks.map((p) => {
          const pct = Math.round((p.votes / total) * 100);
          const mine = myVote === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={!canVote || busy}
                aria-pressed={mine}
                onClick={() => onVote?.(p.id)}
                className={`relative w-full overflow-hidden rounded-[12px] border bg-card px-4 py-4 text-left transition-colors enabled:hover:border-foreground/30 disabled:cursor-default ${mine ? "border-foreground" : ""}`}
              >
                <motion.span className="absolute inset-y-0 left-0 bg-muted" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                <span className="relative flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[15px] font-medium">{mine && <Check className="size-4 shrink-0" />}<span className="truncate">{p.title}</span></span>
                    {p.retailer && <span className="mt-0.5 block text-[11px] tracking-wide text-muted-foreground uppercase">{p.retailer}</span>}
                  </span>
                  <span className="shrink-0 text-[13px] text-muted-foreground tabular">{formatMoney(p.price, currency)} · {p.votes} {p.votes === 1 ? "vote" : "votes"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] text-muted-foreground">{closesLine}</p>
      {canVote && (
        <button type="button" disabled={busy} onClick={() => onVote?.(null)} className="min-h-11 text-[13px] text-muted-foreground underline-offset-4 hover:underline">
          I'm happy with whatever Kitty picks
        </button>
      )}
    </section>
  );
}

function fmtLeft(s: number) {
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${m}:${ss}` : `${m}:${ss}`;
}

export function VetoCountdown({ title, price, currency, at, why, secondsLeft, totalSeconds, organiser, contributorLine, busy = false }: {
  title: string; price: number; currency: string; at: string; why: string | null; secondsLeft: number; totalSeconds: number;
  organiser?: { onSwap: () => void; onVeto: () => void; onBuyNow: () => void; canSwap: boolean } | undefined;
  contributorLine?: string; busy?: boolean;
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, secondsLeft / Math.max(1, totalSeconds)));
  return (
    <section className="space-y-8 text-center">
      <h2 className="mx-auto max-w-xl text-[40px] md:text-[52px]">Buying the {title} for <span className="tabular">{formatMoney(price, currency)}</span> at {at} <em>unless you veto.</em></h2>
      <div className="relative mx-auto size-40" role="timer" aria-label={`${fmtLeft(secondsLeft)} left`}>
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
          <defs>
            <linearGradient id="ember-ring" x1="0" x2="1">
              <stop offset="0%" stopColor="var(--ember-1)" />
              <stop offset="50%" stopColor="var(--ember-2)" />
              <stop offset="100%" stopColor="var(--ember-3)" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="6" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="url(#ember-ring)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-mono text-[28px] tabular">{fmtLeft(secondsLeft)}</span>
      </div>
      {why && <p className="mx-auto flex max-w-md justify-center gap-1.5 font-display text-[20px] italic"><Sparkles className="mt-1.5 size-4 shrink-0 text-ember-2" />{why}</p>}
      {organiser ? (
        <>
          <div className="mx-auto grid max-w-sm grid-cols-2 gap-2">
            <Button variant="quiet" size="xl" disabled={busy || !organiser.canSwap} onClick={organiser.onSwap}>Swap</Button>
            <Button variant="ink" size="xl" disabled={busy} onClick={organiser.onVeto}>Veto</Button>
          </div>
          <button type="button" disabled={busy} onClick={organiser.onBuyNow} className="min-h-11 text-[13px] text-muted-foreground underline-offset-4 hover:underline">Buy now</button>
        </>
      ) : (
        contributorLine && <p className="flex items-center justify-center gap-2 text-[15px] text-muted-foreground"><MoneyPill state="held" />{contributorLine}</p>
      )}
    </section>
  );
}

export type ReceiptPayment = { key: string; name: string | null; amount: number | null; captureId: string | null };

export function Receipt({ recipient, item, retailer, currency, price, held, released, payments, payoutId, payoutLine, buyUrl, notes }: {
  recipient: string; item: string; retailer: string | null; currency: string; price: number; held: number; released: number;
  payments: ReceiptPayment[]; payoutId: string | null; payoutLine?: string | null; buyUrl?: string | null; notes: { key: string; name: string; message: string }[];
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
          {retailer && <Row k="Shop" v={retailer} />}
          <Row k="For" v={recipient} />
          <Row k="Price" v={<span className="tabular">{formatMoney(price, currency, { exact: true })}</span>} />
          <Row k="Pot total" v={<span className="tabular">{formatMoney(held, currency, { exact: true })}</span>} />
          {payments.map((c) => (
            <Row
              key={c.key}
              k={c.name ?? "Anonymous"}
              v={
                <span className="flex flex-col items-end gap-1">
                  <span className="flex items-center gap-2 tabular">{c.amount != null ? formatMoney(c.amount, currency, { exact: true }) : <span className="text-muted-foreground">amount hidden</span>}<MoneyPill state="paid" /></span>
                  {c.captureId && <span className="font-mono text-[11px] text-muted-foreground">{c.captureId}</span>}
                </span>
              }
            />
          ))}
          <Row k="Released" v={<span className="flex items-center gap-2 tabular">{formatMoney(released, currency, { exact: !Number.isInteger(released) })}<MoneyPill state="released" /></span>} />
          <Row k="Total paid" v={<span className="text-[16px] font-semibold tabular">{formatMoney(price, currency, { exact: true })}</span>} />
          <Row k="Payout" v={payoutId ? <span className="font-mono text-[12px]">{payoutId}</span> : <span className="text-muted-foreground">Held by Kitty</span>} />
        </dl>
        {payoutLine && <p className="mt-4 border-t pt-4 text-[13px] text-muted-foreground">{payoutLine}</p>}
        {buyUrl && (
          <Button asChild variant="quiet" size="xl" className="mt-4 w-full">
            <a href={buyUrl} target="_blank" rel="noreferrer sponsored">View the gift{retailer ? ` at ${retailer}` : ""}</a>
          </Button>
        )}
      </div>
      {notes.length > 0 && <CardNotes notes={notes} />}
    </section>
  );
}

export function CardNotes({ notes }: { notes: { key: string; name: string; message: string }[] }) {
  return (
    <div className="mx-auto max-w-md space-y-3">
      {notes.map((n, i) => (
        <motion.div key={n.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="surface p-5" style={{ rotate: `${i % 2 ? 0.8 : -0.8}deg` }}>
          <p className="font-display text-[22px] leading-snug italic">"{n.message}"</p>
          <p className="mt-2 text-[13px] text-muted-foreground">{n.name}</p>
        </motion.div>
      ))}
    </div>
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
