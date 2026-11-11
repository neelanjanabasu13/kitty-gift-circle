import { Link } from "@tanstack/react-router";
import { Lock, FastForward } from "lucide-react";
import { useId } from "react";

export function KittyMark({ className = "size-7", live = false }: { className?: string; live?: boolean }) {
  // Static mark: the butler's black silhouette head with almond eyes, over a kraft box with a PayPal blue ribbon.
  const g = `mk-${useId().replace(/:/g, "")}`;
  return (
    <span className="relative inline-flex">
      <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
        <defs>
          <linearGradient id={g} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#003087" /><stop offset="55%" stopColor="#0070E0" /><stop offset="100%" stopColor="#009CDE" /></linearGradient>
        </defs>
        <path d={MARK_HEAD} fill="var(--color-foreground)" />
        <path d={MARK_EYES} fill="var(--color-card)" />
        <rect x="5" y="22" width="30" height="15" rx="2.5" fill="var(--color-kraft)" stroke="var(--color-foreground)" strokeWidth="1.8" />
        <rect x="18" y="22" width="4" height="15" fill={`url(#${g})`} />
      </svg>
      {live && (
        <span className="absolute -right-0.5 -bottom-0.5 size-2">
          <span className="absolute inset-0 rounded-full bg-signal breathe" />
          <span className="absolute inset-0 rounded-full bg-signal" />
        </span>
      )}
    </span>
  );
}

export const MARK_HEAD = "M10 21 C9 16 10 11 12 8 L12.5 2 L17 7 C19 6.6 21 6.6 23 7 L27.5 2 L28 8 C30 11 31 16 30 21 C29 25 25 27 20 27 C15 27 11 25 10 21 Z";
export const MARK_EYES = "M13.2 16.3 C14.8 14.4 17 14.4 18.6 16 C17 17.2 14.8 17.3 13.2 16.3 Z M21.4 16 C23 14.4 25.2 14.4 26.8 16.3 C25.2 17.3 23 17.2 21.4 16 Z";

export function Logo() {
  return (
    <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-foreground" aria-label="Kitty home">
      <KittyMark className="size-6" />
      <span className="font-display text-[26px] leading-none tracking-[-0.03em]">Kitty</span>
    </Link>
  );
}

export function PayPalWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-sans font-bold italic tracking-tight ${className}`} aria-label="PayPal">
      <span className="text-foreground">Pay</span><span className="text-held">Pal</span>
    </span>
  );
}

export function PayPalTrust({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-center justify-center gap-1.5 text-[13px] text-muted-foreground ${className}`}>
      <Lock className="size-3.5" aria-hidden="true" />
      Held, not charged. Released if it falls through.
    </p>
  );
}

/** Small tan pill shown on every pot screen while the demo clock is running. */
export function DemoBadge({ factor }: { factor?: number | null | undefined }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-kraft-soft px-2 text-[12px] font-medium text-kraft-deep" title={`Time runs ${factor ?? 60}x faster on this kitty`}>
      <FastForward className="size-3" aria-hidden="true" /> Demo speed
    </span>
  );
}

/** Marks rows added by the demo seed. */
export function DemoTag() {
  return <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-kraft/50 px-1.5 text-[11px] font-medium uppercase tracking-wide text-kraft-deep">demo</span>;
}

export function TopBar({ right, demo, demoFactor }: { right?: React.ReactNode; demo?: boolean | undefined; demoFactor?: number | null | undefined }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-3 md:px-8">
      <div className="flex items-center gap-2">
        <Logo />
        {demo && <DemoBadge factor={demoFactor} />}
      </div>
      {right}
    </header>
  );
}
