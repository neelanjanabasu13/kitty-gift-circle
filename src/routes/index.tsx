import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, Settings2, HandCoins, PackageCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, PayPalTrust } from "@/components/kitty/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kitty: the group gift that buys itself" },
      { name: "description", content: "Set it up once. Kitty collects, chooses and buys. Nobody's charged unless the gift happens." },
      { property: "og:title", content: "Kitty: the group gift that buys itself" },
      { property: "og:description", content: "One link for everyone to chip in. Kitty finds a gift that fits, and nobody's charged unless it happens." },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: Settings2, title: "Set it up", body: "Tell Kitty who it's for and what they love. Tap a few chips, done in a minute." },
  { icon: HandCoins, title: "Everyone chips in", body: "One link, no accounts. Each person places a PayPal hold, never a charge." },
  { icon: PackageCheck, title: "Kitty buys it", body: "It finds real gifts that fit the person and the pot, lets you vote, then buys." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <Button asChild variant="soft" size="sm" className="h-9 px-4">
          <Link to="/start">Start a kitty</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        <section className="grid items-center gap-10 pt-6 md:grid-cols-2 md:pt-16">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-accent-foreground">
              <ShieldCheck className="size-3.5" /> Holds, not charges
            </p>
            <h1 className="font-display text-[44px] leading-[1.02] font-semibold md:text-6xl">The group gift that buys itself.</h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">Set it up once. Kitty collects, chooses and buys. Nobody's charged unless the gift happens.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild variant="hero" size="xl">
                <Link to="/start">
                  Start a kitty <ArrowRight className="size-5" />
                </Link>
              </Button>
              <PayPalTrust className="sm:justify-start" />
            </div>
          </motion.div>

          <HeroCard />
        </section>

        <section className="mt-20">
          <h2 className="font-display text-3xl font-semibold">A whip-round link collects. Kitty finishes the job.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div key={s.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="kitty-card p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-gradient-plum text-primary-foreground"><s.icon className="size-5" /></span>
                  <span className="font-display text-sm text-muted-foreground">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-[2rem] bg-gradient-plum p-8 text-primary-foreground md:p-12">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">If the gift falls through, every hold just drops off.</h2>
          <p className="mt-3 max-w-xl opacity-85">Every contribution is a PayPal authorisation. Money only moves when Kitty actually buys the gift, so nobody's left chasing refunds.</p>
          <Button asChild variant="secondary" size="xl" className="mt-6 rounded-full">
            <Link to="/start">Start a kitty</Link>
          </Button>
        </section>
      </main>
      <footer className="pb-10"><PayPalTrust /></footer>
    </div>
  );
}

function HeroCard() {
  const faces = ["AM", "JP", "RK", "SL", "?"];
  return (
    <motion.div initial={{ opacity: 0, y: 24, rotate: 1 }} animate={{ opacity: 1, y: 0, rotate: -1.5 }} transition={{ duration: 0.6, delay: 0.1 }} className="kitty-card mx-auto w-full max-w-sm p-6 shadow-lift">
      <p className="text-sm text-muted-foreground">Chipping in for</p>
      <p className="font-display text-2xl font-semibold">Priya's leaving do</p>
      <div className="mt-5 flex items-baseline justify-between">
        <p className="font-display text-3xl font-semibold">£112 <span className="font-sans text-sm font-normal text-muted-foreground">of £120</span></p>
        <span className="rounded-full bg-held-soft px-2.5 py-1 text-xs font-semibold text-held">held</span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
        <motion.div className="h-full rounded-full bg-gradient-meter" initial={{ width: 0 }} animate={{ width: "93%" }} transition={{ delay: 0.5, duration: 1.4, ease: "easeOut" }} />
      </div>
      <div className="mt-5 flex -space-x-2">
        {faces.map((f) => (
          <span key={f} className="grid size-9 place-items-center rounded-full border-2 border-card bg-primary-soft text-xs font-semibold text-accent-foreground">{f}</span>
        ))}
        <span className="grid size-9 place-items-center rounded-full border-2 border-card bg-muted text-xs text-muted-foreground">+4</span>
      </div>
      <div className="mt-5 rounded-2xl bg-secondary p-4">
        <p className="text-xs font-semibold text-accent-foreground">Kitty's top pick</p>
        <p className="mt-1 text-sm">Hand-thrown ceramic pour-over set, because Priya loves coffee and pottery.</p>
      </div>
    </motion.div>
  );
}
