import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { formatMoney, meterPercent } from "@/lib/kitty";

function AnimatedMoney({ value, currency }: { value: number; currency: string }) {
  const spring = useSpring(0, { stiffness: 60, damping: 18 });
  const text = useTransform(spring, (v) => formatMoney(Math.round(v), currency));
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  return <motion.span>{text}</motion.span>;
}

export function PotMeter({ raised, target, currency, people, size = "lg" }: { raised: number; target: number; currency: string; people: number; size?: "lg" | "sm" }) {
  const pct = meterPercent(raised, target);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className={size === "lg" ? "font-display text-4xl font-semibold" : "font-display text-2xl font-semibold"}>
          <AnimatedMoney value={raised} currency={currency} />
          <span className="ml-1.5 font-sans text-base font-normal text-muted-foreground">of {formatMoney(target, currency)}</span>
        </p>
        <span className="rounded-full bg-held-soft px-2.5 py-1 text-xs font-semibold text-held">held</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className="h-full rounded-full bg-gradient-meter"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(pct, raised > 0 ? 4 : 0)}%` }}
          transition={{ type: "spring", stiffness: 50, damping: 16 }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {people === 0 ? "Nobody's chipped in yet. Be the first." : `From ${people} ${people === 1 ? "person" : "people"} · ${pct}% there`}
      </p>
    </div>
  );
}
