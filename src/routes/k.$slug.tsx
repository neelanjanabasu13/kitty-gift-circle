import { NotFoundPage, PotErrorPage, PotSkeleton } from "@/components/kitty/States";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Chip, Segmented } from "@/components/kitty/Chip";
import { TopBar } from "@/components/kitty/Logo";
import { Missing } from "@/components/kitty/Missing";
import { PotMeter } from "@/components/kitty/PotMeter";
import { Deadline, PicksGrid, PotLive, topPicks } from "@/components/kitty/PotLive";
import { CommissionNote } from "@/components/kitty/PickCard";
import { PayPalHold, warmPaypal } from "@/components/kitty/PayPalHold";
import { AgentTicker } from "@/components/kitty/AgentFeed";
import { MoneyPill } from "@/components/kitty/Money";
import { Cancelled, PayPalDetails } from "@/components/kitty/Stages";
import { KittyMascot } from "@/components/kitty/KittyMascot";
import { ClosingStage, useTick } from "@/components/kitty/Closing";
import { Link } from "@tanstack/react-router";
import { potQuery, useLivePot, markPotActed } from "@/components/kitty/usePot";
import { INTERESTS } from "@/lib/config";
import { amountChips, formatMoney, suggestedAmount } from "@/lib/kitty";
import { authorizeContribution, createContributionOrder, triggerAgent, withdrawContribution } from "@/lib/kitty.functions";

export const Route = createFileRoute("/k/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(potQuery(params.slug)),
  head: ({ loaderData }) => {
    const name = loaderData?.pot.recipient_name;
    const title = name ? `Chip in for ${name} · Kitty` : "Chip in · Kitty";
    const desc = "It's a hold, so nobody's charged unless the gift happens.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ContributorPage,
  pendingComponent: PotSkeleton,
  errorComponent: PotErrorPage,
  notFoundComponent: () => <NotFoundPage />,
});

type Mine = { contributionId: string; orderId: string; authorizationId?: string | null; amount: number; withdrawn?: boolean; voted?: boolean };
const VIS = [
  { value: "named", label: "Named" },
  { value: "anonymous", label: "Anonymous" },
  { value: "amount_hidden", label: "Hide amount" },
] as const;

function ContributorPage() {
  const { slug } = Route.useParams();
  const { data } = useLivePot(slug);
  useTick(data);
  const [mine, setMine] = useState<Mine | null>(null);
  const key = `kitty:mine:${slug}`;

  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v) setMine(JSON.parse(v));
    } catch { /* ignore */ }
  }, [key]);
  const saveMine = (m: Mine | null) => {
    setMine(m);
    try { m ? localStorage.setItem(key, JSON.stringify(m)) : localStorage.removeItem(key); } catch { /* ignore */ }
  };

  if (!data) return <Missing />;
  const { pot } = data;
  const closed = pot.status !== "collecting";

  return (
    <div className="min-h-screen">
      <TopBar demo={!!data?.pot.demo_speed} demoFactor={data?.pot.demo_factor} right={<span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground"><Lock className="size-3.5" /> Hold only</span>} />
      <main className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
        {pot.status === "cancelled" ? (
          <Cancelled />
        ) : pot.status !== "collecting" ? (
          <div className="pt-10">
            <ClosingStage view={data} mine={mine && !mine.withdrawn ? mine : null} />
            {pot.status === "done" && <p className="mt-2 text-center"><Link to="/k/$slug/card" params={{ slug }} className="min-h-11 text-[14px] text-muted-foreground underline underline-offset-4">Open the card for {pot.recipient_name}</Link></p>}
          </div>
        ) : mine && !mine.withdrawn ? (
          <Success mine={mine} currency={pot.currency} canWithdraw={pot.status === "collecting"} onWithdrawn={() => { saveMine({ ...mine, withdrawn: true }); markPotActed(slug); }} name={pot.recipient_name} />
        ) : (
          <div className="mx-auto max-w-xl space-y-8 pt-8">
            <div className="space-y-3">
              <h1 className="text-[44px] md:text-[56px]">Chip in for <em>{pot.recipient_name}</em>.</h1>
              <p className="text-[16px] text-muted-foreground">You're only charged if the gift happens. {pot.organiser_name} is organising.</p>
            </div>
            <div className="flex items-center gap-4">
              <PotKitty people={data.people} />
              <div className="min-w-0 flex-1"><PotMeter raised={data.raised} target={pot.target_amount} currency={pot.currency} people={data.people} footer={<Deadline at={pot.deadline_at} />} /></div>
            </div>
            {topPicks(data).length > 0 && (
              <section className="space-y-3">
                <p className="text-[15px] font-medium">Kitty's picks so far</p>
                <PicksGrid view={data} compact />
                <CommissionNote />
              </section>
            )}
            {closed ? (
              <p className="border-t pt-6 text-[15px] text-muted-foreground">This kitty has stopped taking contributions.</p>
            ) : (
              <ChipInForm slug={slug} name={pot.recipient_name} currency={pot.currency} target={pot.target_amount} expected={pot.expected_count} likes={pot.likes} paypalReady={data.config.paypal} onDone={(m) => { saveMine(m); markPotActed(slug); }} />
            )}
          </div>
        )}

        {(mine || closed) && (
          <div className="mt-16 border-t pt-10">
            <h2 className="mb-8 text-[36px]">The pot so far</h2>
            <PotLive view={data} />
          </div>
        )}
      </main>
    </div>
  );
}

function ChipInForm({ slug, name, currency, target, expected, likes, paypalReady, onDone }: { slug: string; name: string; currency: string; target: number; expected: number; likes: string[]; paypalReady: boolean; onDone: (m: Mine) => void }) {
  const chips = amountChips(target, expected);
  const suggested = suggestedAmount(target, expected);
  const [amount, setAmount] = useState<number>(suggested);
  // PayPal's script loads only after someone taps an amount or the Chip in button (warm-up on pointerdown/focus).
  const [paypalWanted, setPaypalWanted] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const warm = () => { void warmPaypal(currency).then(() => setSdkReady(true), () => setSdkReady(true)); };
  const want = () => { warm(); setPaypalWanted(true); };
  const [custom, setCustom] = useState("");
  const [visibility, setVisibility] = useState<(typeof VIS)[number]["value"]>("named");
  const [displayName, setDisplayName] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const voteOptions = Array.from(new Set([...likes, ...INTERESTS])).slice(0, 6);

  const value = custom ? Number(custom) : amount;
  const valid = value >= 1 && value <= 1000 && (visibility === "anonymous" || displayName.trim().length > 0);
  const label = formatMoney(value || 0, currency);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-[15px] font-medium">How much?</p>
        <div className="flex flex-wrap gap-2" onPointerDownCapture={warm} onFocusCapture={warm}>
          {chips.map((c) => (
            <Chip key={c} selected={!custom && amount === c} onClick={() => { setAmount(c); setCustom(""); want(); }} tag={c === suggested ? "suggested" : undefined}>
              <span className="tabular">{formatMoney(c, currency)}</span>
            </Chip>
          ))}
          <Input value={custom} onChange={(e) => { setCustom(e.target.value.replace(/[^0-9.]/g, "")); want(); }} placeholder="Other" inputMode="decimal" className="h-11 w-24 rounded-full text-center tabular" aria-label="Custom amount" />
        </div>
      </section>

      <section className="space-y-3">
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={visibility === "anonymous" ? "Your name (optional)" : "Your name"} className="h-12 rounded-[12px] text-[16px]" autoComplete="given-name" maxLength={60} aria-label="Your name" />
        <Segmented id="vis" value={visibility} onChange={setVisibility} options={VIS} />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-medium">What's {name} into?</p>
          {cats.length > 0 ? <button type="button" onClick={() => setCats([])} className="min-h-11 text-[13px] text-muted-foreground">Clear</button> : <span className="text-[13px] text-muted-foreground">Optional, skip if unsure</span>}
        </div>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {voteOptions.map((c) => <Chip key={c} className="shrink-0" selected={cats.includes(c)} onClick={() => setCats((x) => x.includes(c) ? x.filter((y) => y !== c) : x.length < 5 ? [...x, c] : x)}>{c}</Chip>)}
        </div>
      </section>

      <section>
        <label className="sr-only" htmlFor="card">Sign the card</label>
        <textarea
          id="card"
          rows={1}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 280))}
          placeholder={`Sign the card for ${name} (optional)`}
          className="min-h-12 w-full resize-none rounded-[12px] border bg-card px-4 py-3 text-[16px] outline-none [field-sizing:content] placeholder:text-muted-foreground focus:border-foreground/30"
        />
        {message && <p className="mt-1 text-right text-[12px] text-muted-foreground tabular">{message.length}/280</p>}
      </section>

      {!paypalReady ? (
      <section className="border-t pt-8">
        <div className="flex items-center gap-4 rounded-[14px] bg-kraft-soft p-5" role="status">
          <KittyMascot state="idle" size={64} />
          <div>
            <h2 className="text-[24px]">Payments switch on soon.</h2>
            <p className="mt-1 text-[15px] text-muted-foreground">Nothing can be charged yet. Come back to this link a little later to chip in.</p>
          </div>
        </div>
      </section>
      ) : (
      <section className="space-y-4 border-t pt-8">
        <div>
          <p className="flex items-center gap-2 text-[22px] font-medium"><span className="tabular">Hold {label} with PayPal</span></p>
          <p className="mt-1 flex items-center gap-1.5 text-[14px] text-muted-foreground"><Lock className="size-3.5" /> Held, not charged. Released if it falls through.</p>
        </div>
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="rounded-[12px] border border-destructive/30 bg-card p-3 flex items-start gap-2 text-[14px] text-destructive" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}</motion.p>
          )}
        </AnimatePresence>
        {!valid && <p className="text-[13px] text-muted-foreground">{value < 1 ? "Pick an amount to continue." : "Add your name, or choose Anonymous."}</p>}
        {finishing ? (
          <div className="space-y-2" aria-label="Placing your hold">
            <div className="h-12 rounded-[12px] shimmer" />
            <p className="text-center text-[14px] text-muted-foreground">Placing your hold with PayPal...</p>
          </div>
        ) : !paypalWanted || !sdkReady ? (
          <button type="button" onPointerDown={warm} onFocus={warm} onClick={want} disabled={paypalWanted} aria-busy={paypalWanted} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[16px] font-medium text-primary-foreground disabled:opacity-80">
            {paypalWanted && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {paypalWanted ? "Loading PayPal..." : `Chip in ${label}`}
          </button>
        ) : (
          <PayPalHold
            currency={currency}
            disabled={!valid}
            onError={setError}
            createOrder={async () => {
              setError(null);
              const r = await createContributionOrder({
                data: {
                  slug,
                  amount: value,
                  display_name: displayName.trim(),
                  visibility,
                  categories: cats,
                  signature: message.trim() ? { name: displayName.trim() || "Anonymous", message: message.trim() } : undefined,
                },
              });
              sessionStorage.setItem(`kitty:pending:${r.orderId}`, r.contributionId);
              return r.orderId;
            }}
            onApproved={async (orderId) => {
              setFinishing(true);
              try {
                const r = await authorizeContribution({ data: { orderId } });
                onDone({ contributionId: r.contributionId, orderId, authorizationId: r.authorizationId ?? null, amount: r.amount, voted: cats.length > 0 });
                void triggerAgent({ data: { contributionId: r.contributionId } }).catch(() => {});
                window.scrollTo({ top: 0, behavior: "smooth" });
              } catch (e) {
                setFinishing(false);
                throw e;
              }
            }}
          />
        )}
      </section>
      )}
    </div>
  );
}

function Success({ mine, currency, canWithdraw, onWithdrawn, name }: { mine: Mine; currency: string; canWithdraw: boolean; onWithdrawn: () => void; name: string }) {
  const [busy, setBusy] = useState(false);
  const [winked, setWinked] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setWinked(true), 2400);
    return () => clearTimeout(t);
  }, []);
  const amt = formatMoney(mine.amount, currency);
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 text-center">
      <KittyMascot state={winked ? "idle" : "chipIn"} wink={winked} fill={0.6} size={220} label="Kitty caught your coin" />
      <div className="space-y-3">
        <MoneyPill state="held" />
        <h1 className="text-[44px] md:text-[56px]"><span className="tabular">{amt}</span> held, <em>not charged.</em></h1>
        <p className="text-[16px] text-muted-foreground">If the gift for {name} falls through, the hold drops off.</p>
      </div>
      <AgentTicker mascot="ranking" text={mine.voted ? "Thanks! I'm reshuffling the picks with your vote." : "You're in. I'm keeping an eye out for gifts."} className="max-w-sm" />
      <div className="w-full max-w-sm"><PayPalDetails rows={[{ label: "PayPal order", value: mine.orderId }, { label: "Authorisation", value: mine.authorizationId }]} /></div>
      {canWithdraw && (
        <button
          type="button"
          disabled={busy}
          className="min-h-11 text-[14px] text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          onClick={async () => {
            setBusy(true);
            try {
              await withdrawContribution({ data: { contributionId: mine.contributionId, orderId: mine.orderId } });
              toast.success(`Your ${amt} hold has been released. Nothing was charged.`);
              void triggerAgent({ data: { contributionId: mine.contributionId } }).catch(() => {});
              onWithdrawn();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't withdraw just now. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Releasing..." : `Withdraw my ${amt} before it closes`}
        </button>
      )}
    </motion.section>
  );
}

/** Kitty beside the pot meter: idles, and catches a coin once each time a new chip-in lands. */
function PotKitty({ people }: { people: number }) {
  const seen = useRef(people);
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (people > seen.current) {
      setBeat((b) => b + 1);
      const id = setTimeout(() => setBeat(0), 1800);
      seen.current = people;
      return () => clearTimeout(id);
    }
    seen.current = people;
    return undefined;
  }, [people]);
  return <KittyMascot state={beat ? "chipIn" : "idle"} beat={beat} size={160} className="shrink-0 !size-[120px] sm:!size-[160px] [&_svg]:!size-full" label={beat ? "Kitty caught a new chip-in" : "Kitty minding the pot"} />;
}
