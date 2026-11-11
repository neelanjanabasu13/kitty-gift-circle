import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PayPalWordmark, TopBar } from "@/components/kitty/Logo";
import { AgentFeed, type AgentLine } from "@/components/kitty/AgentFeed";
import { KittyMascot, type MascotState } from "@/components/kitty/KittyMascot";
import { PotMeter } from "@/components/kitty/PotMeter";
import { PickCard } from "@/components/kitty/PickCard";
import { seedDemoPot } from "@/lib/kitty.functions";
import casserole from "@/assets/pick-casserole.jpg";
import pourover from "@/assets/pick-pourover.jpg";
import pasta from "@/assets/pick-pasta.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kitty: the group gift that buys itself" },
      { name: "description", content: "Everyone chips in with a PayPal hold. Kitty finds the gift, and nobody pays unless it happens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Kitty: the group gift that buys itself" },
      { property: "og:description", content: "Everyone chips in with a PayPal hold. Kitty finds the gift, and nobody pays unless it happens." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const step = useDemoStep();
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/start", search: { name: name.trim() || undefined } });
  };

  return (
    <div className="min-h-screen">
      <TopBar right={<Button asChild variant="ink" size="tap"><Link to="/start" search={{ name: undefined }}>Start a kitty</Link></Button>} />

      <main>
        <section className="mx-auto max-w-3xl px-5 pt-8 pb-14 text-center md:pt-14">
          <KittyMascot state={SCRIPT[step]!.mascot} fill={SCRIPT[step]!.raised / 120} size={240} className="mx-auto mb-4 block" />
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-[44px] md:text-[72px]">
            The group gift that <em>buys itself</em>.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="mt-4 font-display text-[26px] italic md:text-[32px]">Chip in. Gift sorted.</motion.p>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
            Everyone chips in with a PayPal hold. Kitty finds the gift, and nobody pays unless it happens.
          </motion.p>
          <motion.form onSubmit={go} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mx-auto mt-10 flex h-14 max-w-lg items-center gap-2 rounded-full border bg-card pr-1.5 pl-6 shadow-bar focus-within:border-foreground/30">
            <label htmlFor="who" className="sr-only">Who's the gift for?</label>
            <input id="who" value={name} onChange={(e) => setName(e.target.value)} placeholder="Who's the gift for?" maxLength={60} autoComplete="off" className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground" />
            <button type="submit" aria-label="Start" className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background transition-transform hover:-translate-y-px">
              <ArrowUp className="size-5" />
            </button>
          </motion.form>
          <LiveDemoButton />
        </section>

        <LiveDemo step={step} />

        <section className="mx-auto max-w-5xl px-5 py-20">
          <ol className="grid gap-8 border-t pt-10 md:grid-cols-3">
            {[
              ["Set it up once.", "Tell Kitty who it's for and what they love. A minute of tapping."],
              ["Everyone chips in.", "One link, no accounts. Each person places a PayPal hold, not a charge."],
              ["Kitty buys it.", "It finds real gifts that fit the person and the pot, then buys the best one."],
            ].map(([t, b], i) => (
              <li key={t}>
                <p className="text-[13px] font-medium text-kraft-deep tabular">0{i + 1}</p>
                <p className="mt-2 font-display text-[28px] leading-tight">{t}</p>
                <p className="mt-2 text-[15px] text-muted-foreground">{b}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-5 py-6 text-center md:flex-row md:text-left">
            <p className="text-[15px]">Holds through PayPal. Released automatically if the gift falls through.</p>
            <PayPalWordmark className="text-[20px]" />
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-5 py-8 text-[13px] text-muted-foreground md:px-8">
        <span>Kitty</span>
        <span>Made for group gifts</span>
      </footer>
    </div>
  );
}

// ---------- Looping demo: chip-ins arrive, meter fills, picks re-rank, Kitty narrates ----------
const PICKS = [
  { id: "a", title: "Le Creuset round casserole, 22cm", retailer: "John Lewis", category: "Cooking", price: 118, image_url: casserole, reason: "She cooks every Sunday and loves a good pot." },
  { id: "b", title: "Hand-thrown pour-over coffee set", retailer: "Etsy", category: "Ceramics", price: 64, image_url: pourover, reason: "Coffee and pottery, both on her list." },
  { id: "c", title: "Pasta-making class for two", retailer: "Obby", category: "Experiences", price: 95, image_url: pasta, reason: "An evening out that still feels like cooking." },
];
const SCRIPT: { raised: number; people: number; line: string; kind: string; order: string[]; working: string; mascot: MascotState }[] = [
  { raised: 72, people: 6, kind: "pot_created", mascot: "idle", line: "Sam set up a kitty for Priya. Noted: she loves cooking, ceramics and coffee.", order: ["b", "c", "a"], working: "Settling in" },
  { raised: 87, people: 7, kind: "contribution_held", mascot: "chipIn", line: "Jo just chipped in £15. That gets us to £87.", order: ["b", "c", "a"], working: "Counting it in" },
  { raised: 97, people: 8, kind: "searched", mascot: "searching", line: "I looked through 5 shops for cooking gifts under £97.", order: ["c", "b", "a"], working: "Looking through shops for cooking gifts" },
  { raised: 112, people: 9, kind: "reranked", mascot: "ranking", line: "Ravi chipped in, so I reshuffled. The casserole is nearly in reach.", order: ["c", "a", "b"], working: "Weighing up 9 gifts for Priya" },
  { raised: 120, people: 10, kind: "captured", mascot: "buying", line: "We hit £120! Buying the Le Creuset casserole now.", order: ["a", "c", "b"], working: "Wrapping it up" },
  { raised: 120, people: 10, kind: "paid_out", mascot: "done", line: "All done. Priya's gift is paid for, and nobody fronted a penny.", order: ["a", "c", "b"], working: "" },
];

// Each step lasts long enough for Kitty to finish his routine (searching browses four gifts in 12s).
const STEP_MS: Partial<Record<MascotState, number>> = { idle: 8000, chipIn: 4800, searching: 12000, ranking: 7200, buying: 6000, done: 5600 };

function useDemoStep() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % SCRIPT.length), STEP_MS[SCRIPT[step]!.mascot] ?? 4000);
    return () => clearTimeout(t);
  }, [reduce, step]);
  return step;
}

function LiveDemo({ step }: { step: number }) {
  const cur = SCRIPT[step]!;
  const now = Date.now();
  const lines: AgentLine[] = SCRIPT.slice(0, step + 1).reverse().map((s, i) => ({ id: s.line, kind: s.kind, at: new Date(now - (i * 47 + 3) * 1000).toISOString(), message: s.line }));
  const picks = cur.order.map((id, i) => ({ ...PICKS.find((p) => p.id === id)!, rank: i + 1 }));

  return (
    <section aria-label="Kitty in action" className="mx-auto grid max-w-6xl gap-6 px-5 md:px-8 lg:grid-cols-2 lg:gap-10">
      <AgentFeed lines={lines.slice(0, 5)} working={cur.working || undefined} mascot={cur.mascot} fill={cur.raised / 120} className="lg:order-1" />
      <div className="surface space-y-6 p-5 md:p-6 lg:order-2">
        <div>
          <p className="text-[13px] text-muted-foreground">Chipping in for</p>
          <p className="font-display text-[28px] leading-tight">Priya's leaving do</p>
        </div>
        <PotMeter raised={cur.raised} target={120} currency="GBP" people={cur.people} size="sm" footer={<div className="flex -space-x-1.5">{["AM", "JP", "RK", "SL"].map((f) => <span key={f} className="grid size-7 place-items-center rounded-full border-2 border-card bg-muted text-[10px] font-medium">{f}</span>)}</div>} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {picks.map((p, i) => (
            <div key={p.id} className={i > 0 ? "hidden sm:block" : ""}>
              <PickCard currency="GBP" pick={{ ...p, reason: i === 0 ? p.reason : null }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LiveDemoButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const start = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await seedDemoPot({ data: {} });
      try {
        const store = JSON.parse(localStorage.getItem("kitty:admin") || "{}");
        store[r.slug] = r.adminToken;
        localStorage.setItem("kitty:admin", JSON.stringify(store));
      } catch { /* ignore */ }
      navigate({ to: "/k/$slug/manage", params: { slug: r.slug }, search: { t: r.adminToken } });
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't open the live demo."); setBusy(false); }
  };
  return (
    <div className="mt-5">
      <Button variant="outline" size="tap" onClick={start} disabled={busy}>{busy ? "Kitty is shopping for Priya, about 30 seconds..." : "Watch Kitty live with a demo pot"}</Button>
      <p className="mt-2 text-[13px] text-muted-foreground">A ready-made pot for Priya with demo chip-ins and a sped-up clock. No real money moves.</p>
      {err && <p role="alert" className="mt-2 text-[14px]">{err}</p>}
    </div>
  );
}
