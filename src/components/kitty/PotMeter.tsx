import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { formatMoney, meterPercent } from "@/lib/kitty";
import { MoneyPill } from "./Money";

export function CountUp({ value, currency }: { value: number; currency: string }) {
  const reduce = useReducedMotion();
  const spring = useSpring(reduce ? value : 0, { stiffness: 70, damping: 20 });
  const text = useTransform(spring, (v) => formatMoney(Math.round(v), currency));
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  return <motion.span className="tabular">{text}</motion.span>;
}

export function PotMeter({ raised, target, currency, people, size = "lg", footer }: { raised: number; target: number; currency: string; people: number; size?: "lg" | "sm"; footer?: React.ReactNode }) {
  const pct = meterPercent(raised, target);
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <span className={size === "lg" ? "font-display text-[56px] leading-[0.9] tracking-[-0.03em]" : "font-display text-[40px] leading-[0.9] tracking-[-0.03em]"}>
            <CountUp value={raised} currency={currency} />
          </span>
          <span className="text-[15px] text-muted-foreground tabular">of {formatMoney(target, currency)}</span>
        </p>
        <MoneyPill state="held" className="mb-1" />
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Pot progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <motion.div className="h-full rounded-full bg-ember" initial={{ width: 0 }} animate={{ width: `${Math.max(pct, raised > 0 ? 3 : 0)}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
        <span className="tabular">{people === 0 ? "Nobody's chipped in yet" : `from ${people} ${people === 1 ? "person" : "people"}`}</span>
        {footer}
      </div>
    </div>
  );
}
