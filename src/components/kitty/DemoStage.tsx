import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from "motion/react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, SkipForward, ChevronDown, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { KittyMascot, type MascotState } from "./KittyMascot";
import { PayPalWordmark } from "./Logo";
import { CountUp } from "./PotMeter";
import { formatMoney } from "@/lib/kitty";
import { DEMO_CAST, DEMO_TARGET, DEMO_TOTAL, type DemoPerson } from "@/lib/demoScript";
import type { DemoPick } from "@/lib/demoPicks";
import {
  CHIP_GAP_MS, CHIP_LEAD_MS, DEMO_ACTS, DEMO_TOTAL_MS, POT_AT_100, POT_AT_50, RUNNING, SCENES, type SceneId,
  DEMO_BOW_SNAP_MS, demoConfettiCue, demoSplit, finalOrder, nextUnlock, orderAt100, orderAt50, sceneAt, sceneStart, voteTally,
} from "@/lib/demoTimeline";

const GBP = "GBP";
const money = (n: number, exact = false) => formatMoney(n, GBP, { exact });
const EASE = [0.22, 1, 0.36, 1] as const;
const POP = { type: "spring" as const, stiffness: 420, damping: 30 };

const MASCOT: Record<SceneId, MascotState> = {
  chip: "chipIn", shop50: "searching", shop100: "ranking", vote: "vote", veto: "veto",
  bars: "counting", rows: "counting", ribbon: "buying", card: "done", receipt: "done",
};

/** Full-screen, client-side demo story. One clock drives every scene, so pause, next and restart are instant. */
export function DemoStage({ picks }: { picks: DemoPick[] }) {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const confettiFired = useRef(false);
  const [confettiStart, setConfettiStart] = useState<number | null>(null);
  const ended = elapsed >= DEMO_TOTAL_MS;

  useEffect(() => {
    if (elapsed < DEMO_BOW_SNAP_MS) {
      confettiFired.current = false;
      setConfettiStart(null);
      return;
    }
    const cue = demoConfettiCue(elapsed, confettiFired.current);
    if (cue !== null) {
      confettiFired.current = true;
      setConfettiStart(cue);
    }
  }, [elapsed]);

  useEffect(() => {
    if (!playing || ended) return;
    let last = performance.now();
    let id: number;
    const frame = (now: number) => {
      const delta = now - last;
      last = now;
      setElapsed((e) => Math.min(DEMO_TOTAL_MS, e + delta));
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [playing, ended]);

  const at = sceneAt(elapsed);
  const restart = () => { setElapsed(0); setPlaying(true); };
  const jump = (act: number) => { const i = SCENES.findIndex((x) => x.act === DEMO_ACTS[act]!.id); setElapsed(sceneStart(i)); setPlaying(true); };
  const next = () => setElapsed(at ? sceneStart(at.index + 1) : DEMO_TOTAL_MS);
  const actIdx = at ? DEMO_ACTS.findIndex((a) => a.id === at.scene.act) : DEMO_ACTS.length;
  const order = finalOrder(picks);
  const raised = at?.scene.id === "chip" ? chippedRaised(at.t) : at?.scene.id === "shop50" ? POT_AT_50 : at?.scene.id === "shop100" ? POT_AT_100 : DEMO_TOTAL;
  // Shop scenes share one stage so the cards can reshuffle in place.
  const stageKey = at ? (at.scene.act === "shop" ? "shop" : at.scene.id) : "end";

  return (
    <MotionConfig reducedMotion="user">
      <div ref={stageRef} className="relative flex min-h-[100dvh] flex-col overflow-x-hidden">
        <header className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 pt-4 md:px-8 md:pt-6">
          <Link to="/" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full pr-2 text-[14px] font-medium text-foreground hover:text-held"><ArrowLeft className="size-4" aria-hidden /> Back to Kitty</Link>
          <ActBar elapsed={elapsed} actIdx={actIdx} onJump={jump} />
        </header>

        <main className={at?.scene.id === "ribbon" ? "mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-4 px-5 py-4 md:px-8" : "mx-auto grid w-full max-w-6xl flex-1 items-center gap-4 px-5 py-4 md:grid-cols-[280px_minmax(0,1fr)] md:gap-10 md:px-8"}>
          {ended ? (
            <div className="md:col-span-2"><EndScreen onAgain={restart} /></div>
          ) : (
            <>
              <div ref={mascotRef} className={at?.scene.id === "ribbon" ? "flex justify-center" : "flex justify-center md:justify-start"}>
                <KittyMascot state={at ? MASCOT[at.scene.id] : "idle"} beat={at?.scene.id === "chip" ? chippedCount(at.t) : at?.scene.id === "vote" ? (at.t > 6800 ? 1 : 0) : at?.index ?? 0} fill={Math.min(1, raised / DEMO_TARGET)} size={260}
                  confettiMs={confettiStart === null ? false : elapsed - confettiStart}
                  externalRelease items={order.map((p) => p.image_url)} className="!size-[180px] sm:!size-[260px] [&_svg]:!size-full" />
              </div>
              <div className={at?.scene.id === "ribbon" ? "min-w-0 md:col-span-2" : "min-w-0"}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={stageKey} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18, ease: EASE }} className={at?.scene.id === "ribbon" ? "" : "min-h-[360px] md:min-h-[440px]"}>
                    <SceneView id={at!.scene.id} t={at!.t} picks={order} rowRefs={rowRefs} />
                  </motion.div>
                </AnimatePresence>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p key={at!.scene.caption} aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
                    className="mt-4 overflow-hidden text-center font-display text-[16px] whitespace-nowrap italic md:text-left md:text-[26px]">
                    {at!.scene.caption}
                  </motion.p>
                </AnimatePresence>
              </div>
            </>
          )}
        </main>
        {at?.scene.id === "rows" && <ReleasedCoins t={at.t} stageRef={stageRef} mascotRef={mascotRef} rowRefs={rowRefs} />}

        <footer className="mx-auto flex w-full max-w-6xl items-center justify-center gap-2 px-5 pb-6 md:justify-end md:px-8">
          <TooltipProvider delayDuration={300}>
            <Tip label={playing ? "Pause the story" : "Carry on playing"}>
              <Button variant="quiet" size="tap" onClick={() => setPlaying((p) => !p)} disabled={ended}>
                {playing ? <><Pause /> Pause</> : <><Play /> Play</>}
              </Button>
            </Tip>
            <Tip label="Start again from the first chip-in"><Button variant="quiet" size="tap" onClick={restart}><RotateCcw /> Restart</Button></Tip>
            <Tip label="Skip to the next scene"><Button variant="outline" size="tap" onClick={next} disabled={ended}><SkipForward /> Next scene</Button></Tip>
          </TooltipProvider>
        </footer>
      </div>
    </MotionConfig>
  );
}

function chippedCount(t: number) {
  return Math.max(0, Math.min(DEMO_CAST.length, Math.floor((t - CHIP_LEAD_MS) / CHIP_GAP_MS) + 1));
}
function chippedRaised(t: number) {
  const n = chippedCount(t);
  return n ? RUNNING[n - 1]! : 0;
}

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

function ActBar({ elapsed, actIdx, onJump }: { elapsed: number; actIdx: number; onJump: (i: number) => void }) {
  return (
    <div className="relative ml-2 min-w-0 flex-1 pb-5" aria-label={`Act ${Math.min(actIdx + 1, 5)} of 5`}>
      <div className="mx-6 h-[3px] overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-held transition-[width] duration-100 ease-linear" style={{ width: `${(elapsed / DEMO_TOTAL_MS) * 100}%` }} />
      </div>
      <ol className="absolute top-[-3px] right-6 left-6 flex justify-between">
        {DEMO_ACTS.map((a, i) => (
          <li key={a.id} className="flex justify-center" style={{ width: 0 }}>
            <button type="button" onClick={() => onJump(i)} aria-current={i === actIdx ? "step" : undefined} aria-label={`Jump to ${a.label}`}
              className="-mt-[14px] flex min-h-11 flex-col items-center justify-start gap-1 px-1 pt-[14px]">
              <span className={`rounded-full border-2 transition-all ${i === actIdx ? "size-[11px] border-held bg-held ring-4 ring-held/20" : i < actIdx ? "size-[9px] border-held bg-held" : "size-[9px] border-border bg-card"}`} />
              <span className={`whitespace-nowrap text-[10px] sm:text-[11px] ${i === actIdx ? "font-semibold text-held-ink" : "text-muted-foreground"}`}>{a.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SceneView({ id, t, picks, rowRefs }: { id: SceneId; t: number; picks: DemoPick[]; rowRefs: RefObject<(HTMLLIElement | null)[]> }) {
  switch (id) {
    case "chip": return <ChipScene t={t} picks={picks} />;
    case "shop50": case "shop100": return <ShopScene phase={id} t={t} picks={picks} />;
    case "vote": return <VoteScene t={t} picks={picks} />;
    case "veto": return <VetoScene t={t} pick={picks[0]!} />;
    case "bars": return <BarsScene t={t} price={picks[0]!.price} />;
    case "rows": return <RowsScene t={t} price={picks[0]!.price} rowRefs={rowRefs} />;
    case "ribbon": return <RibbonScene t={t} />;
    case "card": return <CardScene t={t} />;
    case "receipt": return <ReceiptScene pick={picks[0]!} />;
  }
}

// ---------- small parts ----------
const who = (p: DemoPerson) => (p.visibility === "anonymous" ? "Someone" : p.name);
function Avatar({ p, className = "size-9 text-[13px]" }: { p: DemoPerson; className?: string }) {
  return <span className={`grid shrink-0 place-items-center rounded-full bg-kraft-soft font-medium text-kraft-deep ${className}`} aria-hidden>{p.visibility === "anonymous" ? "?" : p.name[0]}</span>;
}
function Pill({ tone, children }: { tone: "held" | "paid" | "released"; children: ReactNode }) {
  const c = { held: "bg-held-soft text-held-ink", paid: "bg-paid-soft text-paid", released: "bg-released-soft text-released" }[tone];
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold tabular whitespace-nowrap ${c}`}>{children}</span>;
}
function Meter({ raised }: { raised: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-[36px] leading-none md:text-[48px]"><CountUp value={raised} currency={GBP} /></p>
        <p className="text-[13px] text-muted-foreground tabular">of {money(DEMO_TARGET)} held</p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
        <motion.div className="h-full rounded-full bg-kraft" animate={{ width: `${Math.min(100, (raised / DEMO_TARGET) * 100)}%` }} transition={{ duration: 0.8, ease: EASE }} />
      </div>
    </div>
  );
}
function Shop({ name }: { name: string }) {
  return <span className="inline-flex max-w-full items-center truncate rounded-full bg-card/95 px-2 py-0.5 text-[10px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.08)] md:text-[11px]">{name}</span>;
}
function Product({ pick, dim, note, children, lifted }: { pick: DemoPick; dim?: boolean; note?: string | undefined; children?: ReactNode; lifted?: boolean }) {
  return (
    <motion.article layout transition={POP} animate={{ y: lifted ? -10 : 0, opacity: dim ? 0.55 : 1 }}
      className={`overflow-hidden rounded-[14px] border bg-card ${lifted ? "shadow-bar ring-2 ring-held" : ""}`}>
      <div className="relative aspect-square bg-muted">
        <img src={pick.image_url} alt="" className="h-full w-full object-cover" width={300} height={300} referrerPolicy="no-referrer" />
        <div className="absolute top-1.5 left-1.5 right-1.5"><Shop name={pick.retailer} /></div>
      </div>
      <div className="space-y-0.5 p-2 md:p-3">
        <p className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase md:text-[11px]">{pick.category}</p>
        <h3 className="line-clamp-2 font-sans text-[12px] leading-snug font-medium tracking-normal md:text-[14px]">{pick.title}</h3>
        <p className="text-[13px] font-medium tabular md:text-[15px]">{money(pick.price)}</p>
        {note && <p className="text-[11px] text-muted-foreground md:text-[12px]">{note}</p>}
        {children}
      </div>
    </motion.article>
  );
}

// ---------- Act 1: chip in ----------
function ChipScene({ t, picks }: { t: number; picks: DemoPick[] }) {
  const n = chippedCount(t);
  const appear = (i: number) => CHIP_LEAD_MS + i * CHIP_GAP_MS;
  const flown = (i: number) => i < n && t - appear(i) > 900;
  const likes = Array.from(new Set(DEMO_CAST.map((p) => p.suggests).filter(Boolean))) as string[];
  return (
    <LayoutGroup>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Meter raised={n ? RUNNING[n - 1]! : 0} />
          <div className="rounded-[14px] border border-dashed bg-card/60 p-3">
            <p className="text-[12px] text-muted-foreground">What Priya's into</p>
            <div className="mt-1.5 flex min-h-7 flex-wrap gap-1.5">
              {likes.map((l) => {
                const by = DEMO_CAST.map((p, i) => (p.suggests === l && flown(i) ? i : -1)).filter((i) => i >= 0);
                if (!by.length) return null;
                return (
                  <motion.span key={l} layoutId={`like-${by.at(-1)}`} transition={POP} className="inline-flex h-7 items-center gap-1 rounded-full bg-foreground px-3 text-[12px] font-medium text-background">
                    {l}{by.length > 1 && <span className="text-background/70 tabular">x{by.length}</span>}
                  </motion.span>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-[14px] border bg-card p-2 md:gap-3">
          <p className="w-24 shrink-0 text-[12px] leading-tight text-muted-foreground md:w-32 md:text-[13px]">First ideas for the {money(DEMO_TARGET)} target</p>
          <div className="flex min-w-0 flex-1 gap-2">
            {picks.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...POP, delay: 0.08 * i }} className="flex min-w-0 flex-1 items-center gap-1.5">
                <img src={p.image_url} alt="" className="size-9 shrink-0 rounded-[8px] bg-background object-cover md:size-10" />
                <span className="hidden min-w-0 truncate text-[12px] md:block">{p.category}</span>
              </motion.div>
            ))}
          </div>
        </div>
        <ul className="grid grid-cols-3 gap-2 md:gap-3">
          <AnimatePresence>
            {DEMO_CAST.slice(0, n).map((p, i) => (
              <motion.li key={i} initial={{ opacity: 0, scale: 0.6, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={POP}
                className="flex min-h-[92px] flex-col items-start gap-1.5 rounded-[14px] border bg-card p-2 md:min-h-[104px] md:p-3">
                <div className="flex w-full items-center gap-2">
                  <Avatar p={p} className="size-7 text-[12px] md:size-9 md:text-[13px]" />
                  <span className="truncate text-[13px] font-medium md:text-[15px]">{who(p)}</span>
                </div>
                <Pill tone="held">{p.visibility === "amount_hidden" ? "held" : `${money(p.amount)} held`}</Pill>
                {p.suggests && !flown(i) && (
                  <motion.span layoutId={`like-${i}`} transition={POP} className="inline-flex h-6 items-center rounded-full bg-foreground px-2.5 text-[11px] font-medium text-background">{p.suggests}</motion.span>
                )}
                {!p.suggests && <span className="text-[11px] text-muted-foreground/70">skipped</span>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </LayoutGroup>
  );
}

// ---------- Act 2: Kitty shops ----------
function ShopScene({ phase, t, picks }: { phase: "shop50" | "shop100"; t: number; picks: DemoPick[] }) {
  const pot = phase === "shop50" ? POT_AT_50 : POT_AT_100;
  const shuffled = phase === "shop100" && t > 1200;
  const order = shuffled ? orderAt100(picks) : orderAt50(picks);
  const shown = phase === "shop100" ? 3 : [2200, 3800, 5400].filter((x) => t > x).length;
  const unlock = nextUnlock(picks);
  return (
    <div className="space-y-4">
      <Meter raised={pot} />
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {order.map((p) => {
          const i = orderAt50(picks).findIndex((x) => x.id === p.id);
          if (i >= shown) return <div key={p.id} className="aspect-[3/4] rounded-[14px] border border-dashed" />;
          return (
            <motion.div key={p.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={POP}>
              <Product pick={p} dim={p.price > pot} note={p.price > pot ? `Unlocks at ${money(p.price)}` : undefined} />
            </motion.div>
          );
        })}
      </div>
      <div className="min-h-6">
        {phase === "shop100" && t > 2600 && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-[14px] text-muted-foreground md:text-[15px]">
            {unlock ? <>Next unlock: <span className="font-medium text-foreground tabular">{money(unlock.more, true)}</span> more brings the {unlock.pick.title} into reach.</> : "Everything on the shortlist is in reach now."}
          </motion.p>
        )}
      </div>
    </div>
  );
}

// ---------- Act 3: vote and veto ----------
function VoteScene({ t, picks }: { t: number; picks: DemoPick[] }) {
  const voters = DEMO_CAST.map((p, i) => ({ p, i })).filter((x) => x.p.vote !== undefined);
  const landed = (k: number) => t > 800 + k * 850;
  const tally = voteTally();
  const counted = [0, 0, 0];
  voters.forEach((v, k) => { if (landed(k)) counted[v.p.vote!]! += 1; });
  const winner = t > 6800;
  const nonVoters = DEMO_CAST.filter((p) => p.vote === undefined);
  return (
    <LayoutGroup>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {picks.map((pick, c) => (
            <Product key={pick.id} pick={pick} lifted={winner && c === 0} dim={winner && c !== 0}>
              <div className="flex min-h-6 flex-wrap gap-0.5 pt-1">
                {voters.map((v, k) => landed(k) && v.p.vote === c && (
                  <motion.span key={v.i} layoutId={`vote-${v.i}`} transition={POP}><Avatar p={v.p} className="size-5 text-[10px]" /></motion.span>
                ))}
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full rounded-full bg-held" animate={{ width: `${(counted[c]! / voters.length) * 100}%` }} transition={{ duration: 0.5, ease: EASE }} />
              </div>
              <p className="pt-1 text-[11px] text-muted-foreground tabular">{counted[c]} of {voters.length} votes</p>
            </Product>
          ))}
        </div>
        <div className="flex min-h-9 flex-wrap items-center gap-2">
          <span className="text-[12px] text-muted-foreground">Voting</span>
          {voters.map((v, k) => !landed(k) && (
            <motion.span key={v.i} layoutId={`vote-${v.i}`} transition={POP}><Avatar p={v.p} className="size-7 text-[11px]" /></motion.span>
          ))}
        </div>
        <div className="min-h-9">
          {t > 6000 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              {nonVoters.map((p, i) => <span key={i} className="flex items-center gap-1.5 opacity-70"><Avatar p={p} className="size-6 text-[10px]" />{who(p)}</span>)}
              <span>didn't vote, still counts</span>
            </motion.div>
          )}
        </div>
        <p className="sr-only">{tally[0]} votes for {picks[0]?.title}, {tally[1]} for {picks[1]?.title}.</p>
      </div>
    </LayoutGroup>
  );
}

function VetoScene({ t, pick }: { t: number; pick: DemoPick }) {
  const left = Math.max(0, 5 - t / 1000);
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="grid items-center gap-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
      <div className="flex items-center gap-4 md:flex-col">
        <svg viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90 md:size-36" aria-hidden>
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--held)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - left / 5)} style={{ transition: "stroke-dashoffset 100ms linear" }} />
        </svg>
        <div className="md:text-center">
          <p className="font-display text-[40px] leading-none tabular md:-mt-24 md:mb-14">{left > 0 ? Math.ceil(left) : <Check className="inline size-8" />}</p>
          <div className="mt-2 flex gap-1.5 md:mt-6 md:justify-center" title="Inert in the demo">
            {["Swap", "Veto", "Buy now"].map((b) => <span key={b} aria-disabled className="inline-flex h-9 items-center rounded-full border bg-card px-3 text-[13px] text-muted-foreground">{b}</span>)}
          </div>
        </div>
      </div>
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease: EASE }} className="surface overflow-hidden">
        <p className="px-4 pt-4 font-display text-[22px] leading-tight md:text-[28px]">Here's exactly what Kitty will buy</p>
        <div className="flex gap-3 p-4">
          <img src={pick.image_url} alt="" className="size-24 shrink-0 rounded-[10px] object-cover md:size-32" referrerPolicy="no-referrer" />
          <div className="min-w-0 space-y-1 text-[14px]">
            <p className="font-medium leading-snug">{pick.title}</p>
            <p className="text-muted-foreground">{pick.retailer}</p>
            <p className="text-muted-foreground">Delivery: see retailer</p>
            <p className="font-medium tabular">Total {money(pick.price, true)}</p>
          </div>
        </div>
        <p className="border-t px-4 py-3 text-[13px] text-muted-foreground">{left > 0 ? "Swap, veto and buy now are switched off in the demo." : "Countdown's up. Kitty's buying it."}</p>
      </motion.section>
    </div>
  );
}

// ---------- Act 4: split ----------
function BarsScene({ t, price }: { t: number; price: number }) {
  const pct = (price / DEMO_TOTAL) * 100;
  return (
    <div className="space-y-6 pt-4">
      <div>
        <div className="flex justify-between text-[14px]"><span>Total held</span><span className="font-medium tabular">{money(DEMO_TOTAL, true)}</span></div>
        <div className="mt-2 h-8 rounded-[10px] bg-held-soft" />
      </div>
      <div>
        <div className="flex justify-between text-[14px]"><span>Gift price</span><span className="font-medium tabular">{money(price, true)}</span></div>
        <div className="mt-2 flex h-8 gap-1">
          <motion.div className="h-full rounded-[10px] bg-paid" initial={{ width: 0 }} animate={{ width: t > 500 ? `${pct}%` : 0 }} transition={{ duration: 1, ease: EASE }} />
          {t > 1800 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid flex-1 place-items-center rounded-[10px] border-2 border-dashed border-released/40" />
          )}
        </div>
        <div className="mt-2 flex justify-end">
          {t > 1800 && <motion.span initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}><Pill tone="released">{money(DEMO_TOTAL - price, true)} released</Pill></motion.span>}
        </div>
      </div>
    </div>
  );
}

function RowsScene({ t, price, rowRefs }: { t: number; price: number; rowRefs: RefObject<(HTMLLIElement | null)[]> }) {
  const lines = demoSplit(price);
  const paid = lines.reduce((s, l) => s + Math.round(l.paid * 100), 0) / 100;
  const rel = lines.reduce((s, l) => s + Math.round(l.released * 100), 0) / 100;
  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-[14px] border bg-card">
        {lines.map((l, i) => {
          const flipped = t > 500 + i * 550;
          const hide = l.person.visibility === "amount_hidden";
          return (
            <li key={i} ref={(el) => { rowRefs.current[i] = el; }} data-contributor-row={i} className="flex min-h-[38px] items-center gap-2 px-3 py-1 md:min-h-[42px]">
              <Avatar p={l.person} className="size-6 text-[11px]" />
              <span className="flex-1 truncate text-[13px] md:text-[14px]">{who(l.person)}</span>
              <span className="flex gap-1">
                <AnimatePresence mode="popLayout" initial={false}>
                  {flipped ? (
                    <motion.span key="after" className="flex gap-1" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={POP}>
                      <Pill tone="paid">{hide ? "paid" : `${money(l.paid, true)} paid`}</Pill>
                      <Pill tone="released">{hide ? "released" : `${money(l.released, true)} back`}</Pill>
                    </motion.span>
                  ) : (
                    <motion.span key="before" exit={{ opacity: 0, scale: 0.8 }}><Pill tone="held">{hide ? "held" : `${money(l.held, true)} held`}</Pill></motion.span>
                  )}
                </AnimatePresence>
              </span>
            </li>
          );
        })}
      </ul>
      <p className={`text-right text-[13px] tabular transition-opacity duration-500 ${t > 5600 ? "opacity-100" : "opacity-0"}`}>
        {money(paid, true)} paid, exactly the gift. {money(rel, true)} released.
      </p>
    </div>
  );
}

/** One stage-coordinate overlay crosses the column boundary and adapts to stacked phone rows. */
function ReleasedCoins({ t, stageRef, mascotRef, rowRefs }: { t: number; stageRef: RefObject<HTMLDivElement | null>; mascotRef: RefObject<HTMLDivElement | null>; rowRefs: RefObject<(HTMLLIElement | null)[]> }) {
  const reduce = useReducedMotion();
  const [points, setPoints] = useState<{ source: { x: number; y: number }; targets: { x: number; y: number }[] } | null>(null);
  useEffect(() => {
    const measure = () => {
      const stage = stageRef.current?.getBoundingClientRect();
      const cat = mascotRef.current?.querySelector("svg")?.getBoundingClientRect();
      const rows = rowRefs.current.slice(0, 4);
      if (!stage || !cat || rows.length < 4 || rows.some((r) => !r)) return;
      setPoints({ source: { x: cat.left - stage.left + cat.width * 109 / 200, y: cat.top - stage.top + cat.height * 124 / 200 }, targets: rows.flatMap((row) => {
        if (!row) return [];
        const r = row.getBoundingClientRect();
        return [{ x: r.left - stage.left + 28, y: r.top - stage.top + r.height / 2 }];
      }) });
    };
    // The outgoing scene crossfades before the contributor rows mount.
    const interval = setInterval(measure, 100);
    const observer = new ResizeObserver(measure);
    if (stageRef.current) observer.observe(stageRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    measure();
    return () => { clearInterval(interval); observer.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [stageRef, mascotRef, rowRefs]);
  if (reduce || !points) return null;
  return <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible" aria-hidden data-release-overlay>
    {points.targets.map((target, i) => {
      const local = t - 1050 - i * 150;
      if (local < 0 || local > 1080) return null;
      const u = Math.min(1, local / 900);
      const x = points.source.x + (target.x - points.source.x) * u;
      const y = points.source.y + (target.y - points.source.y) * u - Math.sin(Math.PI * u) * 35;
      return <g key={i} data-release-target={i} data-destination={`${target.x},${target.y}`} transform={`translate(${x} ${y})`} opacity={local <= 900 ? 1 : 1 - (local - 900) / 180}>
        <circle r={17} fill="var(--foreground)" stroke="var(--held)" strokeWidth={3} />
        <circle r={11} fill="var(--kraft)" />
        <path d="M0 -6 V6" stroke="var(--foreground)" strokeWidth={2.5} strokeLinecap="round" />
      </g>;
    })}
  </svg>;
}

// ---------- Act 5: wrapped ----------
function RibbonScene({ t }: { t: number }) {
  // The mascot ties its own box; do not duplicate the action on a separate prop.
  return <span className="sr-only">{t < 2000 ? "Kitty pulls the ribbon and bows" : "The gift is wrapped"}</span>;
}

function CardScene({ t }: { t: number }) {
  const notes = DEMO_CAST.filter((p) => p.message).slice(0, 4);
  const open = t > 900;
  return (
    <div className="grid place-items-center pt-2" style={{ perspective: 1200 }}>
      <div className="relative w-full max-w-[520px]">
        <div className="rounded-[14px] border bg-card p-4 shadow-bar md:p-6">
          <p className="font-display text-[26px] leading-tight md:text-[34px]">For <em>Priya</em>, with love</p>
          <ul className="mt-3 space-y-3">
            {notes.map((p, i) => (
              <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: open && t > 1500 + i * 900 ? 1 : 0, y: open && t > 1500 + i * 900 ? 0 : 8 }} transition={{ ease: EASE }}>
                <p className="font-display text-[17px] leading-snug italic md:text-[20px]">"{p.message}"</p>
                <p className="text-[12px] text-muted-foreground">{who(p)}</p>
              </motion.li>
            ))}
          </ul>
        </div>
        <motion.div className="absolute inset-0 grid place-items-center rounded-[14px] border bg-kraft" style={{ originX: 0, backfaceVisibility: "hidden" }}
          initial={{ rotateY: 0 }} animate={{ rotateY: open ? -170 : 0, opacity: open ? 0 : 1 }} transition={{ duration: 0.9, ease: EASE }}>
          <p className="font-display text-[34px] italic text-foreground">Thank you, Priya</p>
        </motion.div>
      </div>
    </div>
  );
}

function ReceiptScene({ pick }: { pick: DemoPick }) {
  const [details, setDetails] = useState(false);
  return (
    <div className="grid place-items-center pt-4">
      <motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={POP} className="surface w-full max-w-[480px] p-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-paid-soft px-3 py-1 text-[13px] font-semibold text-paid"><Check className="size-4" /> Paid by <PayPalWordmark className="text-[14px]" /></span>
        <div className="mt-4 flex gap-3">
          <img src={pick.image_url} alt="" className="size-16 shrink-0 rounded-[10px] object-cover" referrerPolicy="no-referrer" />
          <div className="min-w-0">
            <p className="text-[15px] font-medium leading-snug">{pick.title}</p>
            <p className="text-[13px] text-muted-foreground">{pick.retailer} · {money(pick.price, true)}</p>
          </div>
        </div>
        <button type="button" onClick={() => setDetails((d) => !d)} aria-expanded={details} className="mt-4 flex min-h-11 items-center gap-1 text-[14px] font-medium">
          Details <ChevronDown className={`size-4 transition-transform ${details ? "rotate-180" : ""}`} />
        </button>
        {details && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t pt-3 font-mono text-[12px]">
            <dt className="text-muted-foreground">gift</dt><dd className="text-right">{money(pick.price, true)}</dd>
            <dt className="text-muted-foreground">paid by</dt><dd className="text-right">{DEMO_CAST.length} people</dd>
            <dt className="text-muted-foreground">released</dt><dd className="text-right">{money(DEMO_TOTAL - pick.price, true)}</dd>
            <dt className="text-muted-foreground">payout</dt><dd className="text-right">demo, no real money</dd>
          </dl>
        )}
      </motion.section>
    </div>
  );
}

function EndScreen({ onAgain }: { onAgain: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-xl space-y-6 text-center">
      <KittyMascot state="done" confettiMs={false} fill={1} size={160} className="mx-auto block" />
      <h1 className="text-[40px] md:text-[56px]">Gift sorted. <em>Nobody fronted a penny.</em></h1>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="quiet" size="tap" onClick={onAgain}><RotateCcw /> Watch again</Button>
        <Button asChild variant="ink" size="tap"><Link to="/start" search={{ name: undefined }}>Try it for real</Link></Button>
      </div>
      <p className="text-[13px] text-muted-foreground">Demo uses real Channel3 gifts and the same split maths as live pots. Demo holds are not real PayPal holds.</p>
    </motion.div>
  );
}
