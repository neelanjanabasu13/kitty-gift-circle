import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip, Field } from "@/components/kitty/Chip";
import { Logo, PayPalTrust } from "@/components/kitty/Logo";
import { PotMeter } from "@/components/kitty/PotMeter";
import { Deadline, PotLive } from "@/components/kitty/PotLive";
import { PayPalHold } from "@/components/kitty/PayPalHold";
import { potQuery, useLivePot } from "@/components/kitty/usePot";
import { INTERESTS } from "@/lib/config";
import { amountChips, formatMoney, occasionNoun, suggestedAmount } from "@/lib/kitty";
import { authorizeContribution, createContributionOrder, withdrawContribution } from "@/lib/kitty.functions";
import { Missing } from "@/components/kitty/Missing";

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
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ContributorPage,
});

type Mine = { contributionId: string; orderId: string; amount: number; withdrawn?: boolean };
const VIS = [
  { value: "named", label: "Named" },
  { value: "anonymous", label: "Anonymous" },
  { value: "amount_hidden", label: "Name shown, amount hidden" },
] as const;

function ContributorPage() {
  const { slug } = Route.useParams();
  const { data } = useLivePot(slug);
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
  const name = pot.recipient_name;
  const closed = pot.status !== "collecting";
  const noun = occasionNoun(pot.occasion);

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="mx-auto flex max-w-xl items-center justify-between px-5 py-5">
        <Logo />
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="size-3.5" /> Hold only</span>
      </header>
      <main className="mx-auto max-w-xl space-y-4 px-5 pb-16">
        {pot.status === "cancelled" ? (
          <section className="kitty-card space-y-2 p-6 text-center">
            <h1 className="font-display text-3xl font-semibold">Kitty's off.</h1>
            <p className="text-muted-foreground">Every hold has been released and nobody was charged.</p>
          </section>
        ) : mine && !mine.withdrawn ? (
          <Success mine={mine} currency={pot.currency} canWithdraw={pot.status === "collecting"} onWithdrawn={() => saveMine({ ...mine, withdrawn: true })} name={name} />
        ) : (
          <>
            <div>
              <p className="text-sm font-semibold text-primary">{pot.organiser_name} is collecting for {noun ? `${name}'s ${noun} gift` : `${name}'s gift`}</p>
              <h1 className="mt-1 font-display text-[34px] leading-tight font-semibold">Chip in for {name}. You're only charged if the gift happens.</h1>
            </div>
            <section className="kitty-card p-5">
              <PotMeter raised={data.raised} target={pot.target_amount} currency={pot.currency} people={data.people} />
              <div className="mt-3"><Deadline at={pot.deadline_at} /></div>
            </section>
            {closed ? (
              <p className="kitty-card p-5 text-sm text-muted-foreground">This kitty has stopped taking contributions.</p>
            ) : (
              <ChipInForm slug={slug} name={name} currency={pot.currency} target={pot.target_amount} expected={pot.expected_count} likes={pot.likes} onDone={(m) => saveMine(m)} />
            )}
          </>
        )}

        {(mine || closed) && (
          <div className="pt-2">
            <h2 className="mb-3 font-display text-2xl font-semibold">The pot so far</h2>
            <PotLive view={data} />
          </div>
        )}
      </main>
    </div>
  );
}

function ChipInForm({ slug, name, currency, target, expected, likes, onDone }: { slug: string; name: string; currency: string; target: number; expected: number; likes: string[]; onDone: (m: Mine) => void }) {
  const chips = amountChips(target, expected);
  const suggested = suggestedAmount(target, expected);
  const [amount, setAmount] = useState<number>(suggested);
  const [custom, setCustom] = useState("");
  const [visibility, setVisibility] = useState<(typeof VIS)[number]["value"]>("named");
  const [displayName, setDisplayName] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const voteOptions = Array.from(new Set([...likes, ...INTERESTS])).slice(0, 10);

  const value = custom ? Number(custom) : amount;
  const valid = value >= 1 && value <= 1000 && (visibility === "anonymous" || displayName.trim().length > 0);
  const label = formatMoney(value || 0, currency);

  return (
    <div className="space-y-4">
      <section className="kitty-card space-y-6 p-5">
        <Field label="How much?">
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <Chip key={c} selected={!custom && amount === c} onClick={() => { setAmount(c); setCustom(""); }}>
                {formatMoney(c, currency)}{c === suggested ? " · suggested" : ""}
              </Chip>
            ))}
            <Input value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Other" inputMode="decimal" className="h-10 w-24 rounded-full text-center" aria-label="Custom amount" />
          </div>
        </Field>
        <Field label="Your name">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={visibility === "anonymous" ? "Optional" : "So everyone knows it's you"} className="h-12 rounded-xl" autoComplete="given-name" maxLength={60} />
          <div className="flex flex-wrap gap-2">
            {VIS.map((v) => <Chip key={v.value} tone="muted" selected={visibility === v.value} onClick={() => setVisibility(v.value)}>{v.label}</Chip>)}
          </div>
        </Field>
      </section>

      <section className="kitty-card space-y-6 p-5">
        <Field label={`What's ${name} into?`} hint="Skip if you're not sure.">
          <div className="flex flex-wrap gap-2">
            {voteOptions.map((c) => <Chip key={c} selected={cats.includes(c)} onClick={() => setCats((x) => x.includes(c) ? x.filter((y) => y !== c) : x.length < 5 ? [...x, c] : x)}>{c}</Chip>)}
          </div>
        </Field>
        <Field label="Sign the card" hint="Optional. Goes with the gift.">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 280))} placeholder={`A few words for ${name}`} className="min-h-24 rounded-xl" />
          <p className="text-right text-xs text-muted-foreground">{message.length}/280</p>
        </Field>
      </section>

      <section className="kitty-card space-y-4 p-5">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold">Hold {label} with PayPal</p>
          <p className="text-sm text-muted-foreground">A hold, not a charge. It only becomes a payment if the gift happens.</p>
        </div>
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</motion.p>
          )}
        </AnimatePresence>
        {!valid && <p className="text-center text-xs text-muted-foreground">{value < 1 ? "Pick an amount to continue." : "Add your name, or choose Anonymous."}</p>}
        {finishing ? (
          <div className="flex h-24 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" /> Placing your hold…</div>
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
                onDone({ contributionId: r.contributionId, orderId, amount: r.amount });
                window.scrollTo({ top: 0, behavior: "smooth" });
              } catch (e) {
                setFinishing(false);
                throw e;
              }
            }}
          />
        )}
        <PayPalTrust />
      </section>
    </div>
  );
}

function Success({ mine, currency, canWithdraw, onWithdrawn, name }: { mine: Mine; currency: string; canWithdraw: boolean; onWithdrawn: () => void; name: string }) {
  const [busy, setBusy] = useState(false);
  const amt = formatMoney(mine.amount, currency);
  return (
    <motion.section initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="kitty-card space-y-4 p-6 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}>
        <CheckCircle2 className="mx-auto size-14 text-success" />
      </motion.div>
      <div>
        <span className="rounded-full bg-held-soft px-3 py-1 text-xs font-semibold text-held">held</span>
        <h1 className="mt-3 font-display text-3xl font-semibold">{amt} held, not charged.</h1>
        <p className="mt-2 text-muted-foreground">If the gift falls through, the hold drops off. Thanks for chipping in for {name}.</p>
      </div>
      {canWithdraw && (
        <Button
          variant="ghost"
          className="text-muted-foreground"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await withdrawContribution({ data: { contributionId: mine.contributionId, orderId: mine.orderId } });
              toast.success(`Your ${amt} hold has been released. Nothing was charged.`);
              onWithdrawn();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Couldn't withdraw just now. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Loader2 className="animate-spin" />} Withdraw my {amt}
        </Button>
      )}
    </motion.section>
  );
}
