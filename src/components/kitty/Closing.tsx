import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PotView } from "@/lib/kitty.functions";
import { castFinalVote, extendDeadline, getMySplit, getMyVote, organiserDecide, tickPot } from "@/lib/kitty.functions";
import { formatMoney } from "@/lib/kitty";
import { clockTime } from "@/lib/closing";
import { AgentTicker } from "./AgentFeed";
import { FinalVote, HowWeSplit, PurchasePreview, VetoCountdown } from "./Stages";
import { KittyMascot } from "./KittyMascot";
import { Chip } from "./Chip";

const ACTIVE = ["collecting", "voting", "veto", "buying"];

/** Ticks the pot on page load, every 30s while open, and right when a vote or countdown is due. */
export function useTick(view: PotView | null | undefined) {
  const qc = useQueryClient();
  const slug = view?.pot.slug;
  const status = view?.pot.status;
  const dueAt = view?.decision?.buy_at ?? view?.vote?.closesAt ?? (status === "collecting" ? view?.pot.deadline_at : null);
  const running = useRef(false);
  useEffect(() => {
    if (!slug || !status || !ACTIVE.includes(status)) return;
    const run = async () => {
      if (running.current) return;
      running.current = true;
      try {
        await tickPot({ data: { slug } });
        qc.invalidateQueries({ queryKey: ["pot", slug] });
      } catch { /* the next tick will retry */ } finally {
        running.current = false;
      }
    };
    void run();
    const every = setInterval(run, 30_000);
    let due: ReturnType<typeof setTimeout> | undefined;
    if (dueAt) {
      const ms = new Date(dueAt).getTime() - Date.now() + 1500;
      if (ms > 0 && ms < 2 ** 31 - 1) due = setTimeout(run, ms);
    }
    return () => {
      clearInterval(every);
      if (due) clearTimeout(due);
    };
  }, [slug, status, dueAt, qc]);
}

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function useSecondsLeft(at: string | null | undefined, fallback: number) {
  const calc = () => (at ? Math.max(0, Math.round((new Date(at).getTime() - Date.now()) / 1000)) : 0);
  const [s, setS] = useState(fallback);
  useEffect(() => {
    setS(calc());
    const t = setInterval(() => setS(calc()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);
  return s;
}

export type Mine = { contributionId: string; orderId: string; amount: number };

/** The contributor's own hold from this device, plus their own numbers under the surplus rule. */
export function useMine(slug: string) {
  const [mine, setMine] = useState<Mine | null>(null);
  const [mySplit, setMySplit] = useState<{ held: number; paid: number | null } | null>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(`kitty:mine:${slug}`) || "null");
      if (v && !v.withdrawn) setMine(v);
    } catch { /* ignore */ }
  }, [slug]);
  useEffect(() => {
    if (!mine) return;
    getMySplit({ data: { contributionId: mine.contributionId, orderId: mine.orderId } }).then((r) => setMySplit({ held: r.held, paid: r.paid })).catch(() => {});
  }, [mine]);
  return { mine, mySplit };
}

/** The closing stages (vote, veto countdown, buying, done) for both contributors and the organiser. */
export function ClosingStage({ view, mine, adminToken }: { view: PotView; mine?: Mine | null | undefined; adminToken?: string | undefined }) {
  const { pot } = view;
  const admin = !!adminToken && view.isAdmin;
  const short = view.raised < pot.target_amount;
  const canExtend = admin && short && ["collecting", "voting", "veto"].includes(pot.status) && (pot.status !== "collecting" || new Date(pot.deadline_at).getTime() < Date.now());

  if (pot.status === "voting" && view.vote) return <><VoteStage view={view} mine={mine} />{canExtend && <Extend view={view} token={adminToken!} />}</>;
  if (pot.status === "veto" && view.decision?.pick) return <><VetoStage view={view} mine={mine} adminToken={admin ? adminToken : undefined} />{canExtend && <Extend view={view} token={adminToken!} />}</>;
  if (pot.status === "buying") {
    return (
      <section className="mx-auto max-w-lg space-y-4 py-6 text-center">
        <KittyMascot state="buying" size={200} className="mx-auto block" />
        <h2 className="text-[40px]">Buying it <em>now.</em></h2>
        <AgentTicker text={pot.agent_working ?? "Checking the shop and every hold with PayPal..."} className="mx-auto max-w-sm" />
      </section>
    );
  }
  if (pot.status === "done") {
    return (
      <section className="mx-auto max-w-lg space-y-4 py-6 text-center">
        <KittyMascot state="done" size={200} className="mx-auto block" />
        <h2 className="text-[40px]">Done. <em>It's paid for.</em></h2>
        <Button asChild variant="ink" size="xl"><Link to="/k/$slug/receipt" params={{ slug: pot.slug }}>See the receipt</Link></Button>
      </section>
    );
  }
  if (canExtend) return <Extend view={view} token={adminToken!} />;
  return null;
}

function VoteStage({ view, mine }: { view: PotView; mine?: Mine | null | undefined }) {
  const qc = useQueryClient();
  const v = view.vote!;
  const [myVote, setMyVote] = useState<string | null>(null);
  const [canVote, setCanVote] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!mine) return;
    getMyVote({ data: { contributionId: mine.contributionId, orderId: mine.orderId } })
      .then((r) => { setMyVote(r.optedOut ? "none" : r.candidateId); setCanVote(["authorized", "reauthorized"].includes(r.status)); })
      .catch(() => setCanVote(false));
  }, [mine]);
  const mounted = useMounted();
  const closes = v.closesAt && mounted ? clockTime(new Date(v.closesAt)) : null;
  const line = `${closes ? `Closes at ${closes}` : "Closes"} or when everyone who wants to vote has voted. ${v.voted} of ${v.eligible} in so far.`;
  return (
    <div className="space-y-3">
      <FinalVote
        name={view.pot.recipient_name}
        currency={view.pot.currency}
        picks={v.picks}
        closesLine={line}
        myVote={myVote}
        canVote={canVote}
        busy={busy}
        onVote={async (id) => {
          if (!mine) return;
          setBusy(true);
          try {
            await castFinalVote({ data: { contributionId: mine.contributionId, orderId: mine.orderId, candidateId: id } });
            setMyVote(id ?? "none");
            toast.success(id ? "Vote in. You can change it until it closes." : "Got it. Kitty will choose for you.");
            qc.invalidateQueries({ queryKey: ["pot", view.pot.slug] });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Your vote didn't go through.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {myVote === "none" && <p className="text-[13px] text-muted-foreground">You've left it to Kitty.</p>}
      {!mine && !view.isAdmin && <p className="text-[13px] text-muted-foreground">Only people who chipped in can vote.</p>}
    </div>
  );
}

function VetoStage({ view, mine, adminToken }: { view: PotView; mine?: Mine | null | undefined; adminToken?: string | undefined }) {
  const qc = useQueryClient();
  const d = view.decision!;
  const pick = d.pick!;
  const mounted = useMounted();
  const left = useSecondsLeft(d.buy_at, d.total_seconds ?? 7200);
  const at = d.buy_at && mounted ? clockTime(new Date(d.buy_at)) : "the set time";
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<null | "swap" | "veto">(null);
  const total = d.total_seconds ?? 7200;
  const alternatives = view.candidates.filter((c) => c.rank != null && c.id !== pick.id && c.price != null && c.price <= view.raised).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).slice(0, 4);
  const act = async (action: "swap" | "buy_now" | "cancel", candidateId?: string) => {
    setBusy(true);
    try {
      await organiserDecide({ data: { slug: view.pot.slug, adminToken: adminToken!, action, candidateId } });
      setDialog(null);
      qc.invalidateQueries({ queryKey: ["pot", view.pot.slug] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <VetoCountdown
        title={pick.title}
        price={pick.price}
        currency={view.pot.currency}
        at={at}
        why={d.why}
        secondsLeft={left}
        totalSeconds={total}
        busy={busy}
        contributorLine={mine ? `Kitty buys at ${at}. Your ${formatMoney(mine.amount, view.pot.currency)} is still only held.` : `Kitty buys at ${at}. Every contribution is still only held.`}
        organiser={adminToken ? { canSwap: alternatives.length > 0, onSwap: () => setDialog("swap"), onVeto: () => setDialog("veto"), onBuyNow: () => act("buy_now") } : undefined}
      >
        <div className="space-y-3">
          <PurchasePreview title={pick.title} image={pick.image_url} retailer={pick.retailer} price={pick.price} currency={view.pot.currency} split={view.split?.lines ?? []} mineId={mine?.contributionId} mine={mine ? { held: mine.amount, paid: null } : null} />
          {view.split && <HowWeSplit price={view.split.price} pot={view.split.pot} currency={view.pot.currency} />}
        </div>
      </VetoCountdown>
      {adminToken && (
        <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="rounded-[14px]">
            <DialogHeader>
              <DialogTitle className="font-display text-[28px] font-normal">{dialog === "veto" ? "Not this one?" : "Swap the gift"}</DialogTitle>
              <DialogDescription>{dialog === "veto" ? "Swap to another pick, or call the whole kitty off and release every hold." : "The countdown restarts with the gift you choose."}</DialogDescription>
            </DialogHeader>
            <ul className="divide-y">
              {alternatives.map((c) => (
                <li key={c.id}>
                  <button type="button" disabled={busy} onClick={() => act("swap", c.id)} className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left hover:opacity-80">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{c.title}</span>
                      {c.retailer && <span className="text-[11px] tracking-wide text-muted-foreground uppercase">{c.retailer}</span>}
                    </span>
                    <span className="shrink-0 text-[14px] tabular">{formatMoney(c.price!, view.pot.currency)}</span>
                  </button>
                </li>
              ))}
              {!alternatives.length && <li className="py-3 text-[14px] text-muted-foreground">No other pick fits the pot right now.</li>}
            </ul>
            {dialog === "veto" && (
              <Button variant="quiet" size="xl" disabled={busy} className="text-destructive" onClick={() => act("cancel")}>Cancel the kitty and release every hold</Button>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function Extend({ view, token }: { view: PotView; token: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { pot } = view;
  return (
    <section className="mx-auto max-w-xl space-y-3 border-t pt-6">
      <p className="text-[15px]">
        The pot's at <span className="tabular">{formatMoney(view.raised, pot.currency)}</span> of <span className="tabular">{formatMoney(pot.target_amount, pot.currency)}</span>. Give people a bit longer, or top it up yourself.
      </p>
      <div className="flex flex-wrap gap-2">
        {([1, 3] as const).map((days) => (
          <Chip
            key={days}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await extendDeadline({ data: { slug: pot.slug, adminToken: token, days } });
                toast.success("Deadline extended. Kitty's collecting again.");
                qc.invalidateQueries({ queryKey: ["pot", pot.slug] });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Couldn't extend the deadline.");
              } finally {
                setBusy(false);
              }
            }}
          >
            +{days} day{days === 1 ? "" : "s"}
          </Chip>
        ))}
        <Button asChild variant="quiet" size="tap"><Link to="/k/$slug" params={{ slug: pot.slug }}>Top up as a contributor</Link></Button>
      </div>
    </section>
  );
}
