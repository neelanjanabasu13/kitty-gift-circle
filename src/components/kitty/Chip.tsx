import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Chip({ selected, onClick, children, className, tag }: { selected?: boolean; onClick?: () => void; children: ReactNode; className?: string | undefined; tag?: string | undefined; tone?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[15px] transition-all duration-200 active:scale-[0.97]",
        selected ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:border-foreground/30",
        className,
      )}
    >
      {children}
      {tag && <span className={cn("text-[11px] font-medium tracking-wide uppercase", selected ? "text-background/70" : "text-muted-foreground")}>{tag}</span>}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string | undefined; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[15px] font-medium text-foreground">{label}</p>
        {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, id }: { value: T; onChange: (v: T) => void; options: readonly { value: T; label: string }[]; id: string }) {
  return (
    <div role="radiogroup" className="grid gap-1 rounded-[12px] border bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className="relative min-h-11 rounded-[9px] px-2 text-[13px] leading-tight font-medium">
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-[9px] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.08)]" />}
          <span className={cn("relative", value === o.value ? "text-foreground" : "text-muted-foreground")}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
