import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Chip({ selected, onClick, children, tone = "primary", className }: { selected?: boolean; onClick?: () => void; children: ReactNode; tone?: "primary" | "muted"; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full border px-4 text-sm font-medium transition-all active:scale-95",
        selected
          ? tone === "primary"
            ? "border-primary bg-primary text-primary-foreground shadow-soft"
            : "border-foreground/70 bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-primary/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string | undefined; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
