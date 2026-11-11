import { DemoTag } from "./Logo";
import { motion } from "motion/react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { KittyMascot } from "./KittyMascot";
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

export function VetoCountdown({ title, price, currency, at, why, secondsLeft, totalSeconds, organiser, contributorLine, busy = false, children }: {
  title: string; price: number; currency: string; at: string; why: string | null; secondsLeft: number; totalSeconds: number;
  organiser?: { onSwap: () => void; onVeto: () => void; onBuyNow: () => void; canSwap: boolean } | undefined;
  contributorLine?: string; busy?: boolean; children?: React.ReactNode;
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, secondsLeft / Math.max(1, totalSeconds)));
  return (
    <section className="space-y-8 text-center">
      <KittyMascot state="veto" size={160} className="mx-auto" />
      <h2 className="mx-auto max-w-xl text-[40px] md:text-[52px]">Buying the {title} for <span className="tabular">{formatMoney(price, currency)}</span> at {at} <em>unless you veto.</em></h2>
      <div className="relative mx-auto size-40" role="timer" aria-label={`${fmtLeft(secondsLeft)} left`}>
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="6" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--signal)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-display text-[40px] tabular">{fmtLeft(secondsLeft)}</span>
      </div>
      {why && <p className="mx-auto flex max-w-md justify-center gap-1.5 font-display text-[20px] italic"><Sparkles className="mt-1.5 size-4 shrink-0 text-signal" />{why}</p>}
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
      {children && <div className="mx-auto max-w-md text-left">{children}</div>}
    </section>
  );
}

export type SplitRow = { id: string; name: string | null; held: number | null; paid: number | null; released: number | null; demo?: boolean };

/** One clear line per person under the surplus rule. The viewer's own row is highlighted. */
export function SplitList({ rows, currency, mineId, mine, future = false }: { rows: SplitRow[]; currency: string; mineId?: string | null | undefined; mine?: { held: number; paid: number | null } | null | undefined; future?: boolean }) {
  const m = (n: number) => formatMoney(n, currency, { exact: !Number.isInteger(n) });
  return (
    <ul className="divide-y">
      {rows.map((r) => {
        const isMe = !!mineId && r.id === mineId;
        let held = r.held, paid = r.paid, released = r.released;
        if (isMe && held == null && mine) { held = mine.held; paid = mine.paid; released = mine.paid != null ? Math.round((mine.held - mine.paid) * 100) / 100 : null; }
        const who = isMe ? "You" : r.name ?? "Someone";
        return (
          <li key={r.id} className={`flex min-h-12 items-center gap-3 py-2.5 text-[15px] ${isMe ? "-mx-3 rounded-[12px] bg-kraft-soft px-3" : ""}`}>
            <span className="min-w-0 flex-1">
              {held == null || paid == null ? (
                <>{who} chipped in. {isMe ? "Your" : "Their"} share stays private.</>
              ) : (
                <>
                  {who} held <span className="tabular">{m(held)}</span>. {future ? "Pays" : "Paid"} <span className="font-medium tabular">{m(paid)}</span>.{" "}
                  {released! > 0 ? <><span className="tabular">{m(released!)}</span> released back{isMe ? " to you" : ""}.</> : "Nothing to release."}
                </>
              )}
            </span>
            {r.demo && <DemoTag />}
            <MoneyPill state={future ? "held" : (paid ?? 1) > 0 ? "paid" : "released"} />
          </li>
        );
      })}
    </ul>
  );
}

export const SHARE_LINE = "You're only charged your share of the final cost. The rest of your hold is released.";

export function HowWeSplit({ price, pot, currency }: { price: number; pot: number; currency: string }) {
  const same = Math.round(price * 100) >= Math.round(pot * 100);
  const pct = pot > 0 ? Math.round((price / pot) * 1000) / 10 : 100;
  return (
    <details className="group rounded-[12px] border bg-card px-4 py-3 text-[14px]">
      <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between font-medium">
        How we split it <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 space-y-2 text-muted-foreground">
        <p>{SHARE_LINE}</p>
        <p>For example, £200 was pledged and the final cost is £160, so everyone pays 80% of their pledge. A £25 pledge pays £20 and £5 is released.</p>
        {pot > 0 && (
          <p>
            {same
              ? `Here the pot reached ${formatMoney(pot, currency, { exact: true })}, exactly the final cost, so everyone pays what they pledged.`
              : `Here ${formatMoney(pot, currency, { exact: true })} was pledged and the final cost is ${formatMoney(price, currency, { exact: true })}, so everyone pays about ${pct}% of their pledge.`}
          </p>
        )}
      </div>
    </details>
  );
}

/**
 * "Here's exactly what Kitty will buy": the gift, the shop, delivery, the total and each person's
 * final charge and release. Channel3 returns no delivery or fee data, so those rows say so plainly.
 * Reused on the receipt with done=true.
 */
export function PurchasePreview({ title, image, retailer, price, currency, delivery, total, split, mineId, mine, done = false }: {
  title: string; image?: string | null | undefined; retailer: string | null; price: number; currency: string;
  delivery?: string | null | undefined; total?: number | null | undefined;
  split: SplitRow[]; mineId?: string | null | undefined; mine?: { held: number; paid: number | null } | null | undefined; done?: boolean;
}) {
  return (
    <section className="surface space-y-4 p-5 text-left" aria-labelledby="buy-preview">
      <h3 id="buy-preview" className="font-display text-[26px] leading-tight">{done ? "Here's exactly what Kitty bought" : "Here's exactly what Kitty will buy"}</h3>
      <div className="flex gap-4">
        {image ? <img src={image} alt="" width={88} height={88} loading="lazy" className="size-22 shrink-0 rounded-[12px] border bg-card object-cover" /> : null}
        <div className="min-w-0 space-y-1">
          <p className="text-[16px] font-medium leading-snug">{title}</p>
          {retailer && <p className="text-[12px] tracking-wide text-muted-foreground uppercase">{retailer}</p>}
        </div>
      </div>
      <dl className="divide-y border-y text-[14px]">
        <div className="flex justify-between gap-3 py-2.5"><dt className="text-muted-foreground">Gift</dt><dd className="tabular">{formatMoney(price, currency, { exact: true })}</dd></div>
        <div className="flex justify-between gap-3 py-2.5"><dt className="text-muted-foreground">Delivery</dt><dd>{delivery ?? "See retailer"}</dd></div>
        <div className="flex justify-between gap-3 py-2.5"><dt className="text-muted-foreground">Total</dt><dd className="font-medium tabular">{total != null ? formatMoney(total, currency, { exact: true }) : "Price at retailer"}</dd></div>
      </dl>
      {split.length > 0 && (
        <div>
          <p className="mb-1 text-[13px] text-muted-foreground">{done ? "Who paid what" : "What each person will be charged"}</p>
          <SplitList rows={split} currency={currency} mineId={mineId} mine={mine} future={!done} />
        </div>
      )}
      <p className="text-[13px] text-muted-foreground">{SHARE_LINE}</p>
    </section>
  );
}

/** Expandable PayPal references. The only place mono type is used. */
export function PayPalDetails({ rows }: { rows: { label: string; value: string | null | undefined }[] }) {
  const shown = rows.filter((r) => r.value);
  if (!shown.length) return null;
  return (
    <details className="group w-full rounded-[12px] border bg-card px-4 py-3 text-left text-[13px]">
      <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between font-medium">
        Details <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <dl className="mt-2 space-y-1.5">
        {shown.map((r) => (
          <div key={r.label + r.value} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="truncate font-mono text-[12px]">{r.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export function Receipt({ recipient, item, image, retailer, currency, price, held, released, split, mineId, mine, details, payoutLine, buyUrl, notes }: {
  recipient: string; item: string; image?: string | null | undefined; retailer: string | null; currency: string; price: number; held: number; released: number;
  split: SplitRow[]; mineId?: string | null | undefined; mine?: { held: number; paid: number | null } | null | undefined;
  details: { label: string; value: string | null | undefined }[]; payoutLine?: string | null | undefined; buyUrl?: string | null | undefined; notes: { key: string; name: string; message: string }[];
}) {
  return (
    <section className="space-y-8">
      <div className="surface mx-auto max-w-md space-y-5 p-6">
        <div className="flex items-center justify-between border-b pb-4">
          <span className="font-display text-[26px]">Receipt</span>
          <MoneyPill state="paid" />
        </div>
        <dl className="divide-y text-[14px]">
          <Row k="Gift" v={item} />
          {retailer && <Row k="Shop" v={retailer} />}
          <Row k="For" v={recipient} />
          <Row k="Pot total" v={<span className="flex items-center gap-2 tabular">{formatMoney(held, currency, { exact: true })}<MoneyPill state="held" /></span>} />
          <Row k="Gift price" v={<span className="flex items-center gap-2 text-[16px] font-semibold tabular">{formatMoney(price, currency, { exact: true })}<MoneyPill state="paid" /></span>} />
          <Row k="Released back" v={<span className="flex items-center gap-2 tabular">{formatMoney(released, currency, { exact: !Number.isInteger(released) })}<MoneyPill state="released" /></span>} />
        </dl>
        <PurchasePreview done title={item} image={image} retailer={retailer} price={price} currency={currency} split={split} mineId={mineId} mine={mine} />
        <HowWeSplit price={price} pot={held} currency={currency} />
        {payoutLine && <p className="text-[13px] text-muted-foreground">{payoutLine}</p>}
        <PayPalDetails rows={details} />
        {buyUrl && (
          <Button asChild variant="quiet" size="xl" className="w-full">
            <a href={buyUrl} target="_blank" rel="noreferrer sponsored">View the gift{retailer ? ` at ${retailer}` : ""}</a>
          </Button>
        )}
        <p className="text-[13px] text-muted-foreground">{buyLine(retailer)}</p>
      </div>
      {notes.length > 0 && <CardNotes notes={notes} />}
    </section>
  );
}

/** Honest buy-step copy: Channel3 gives an offer link, not a checkout, so the organiser finishes the order. */
export const buyLine = (retailer: string | null | undefined) => `Kitty pays you the exact amount and hands you the buy link. Tap to finish the order at ${retailer ?? "the shop"}.`;

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
      <KittyMascot state="cancelled" size={200} className="mx-auto" />
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
