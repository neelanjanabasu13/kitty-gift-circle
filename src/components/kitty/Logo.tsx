import { Link } from "@tanstack/react-router";
import { Lock, FastForward } from "lucide-react";

export function KittyMark({ className = "size-7", live = false }: { className?: string; live?: boolean }) {
  // Static mark: Kitty's head peeking over a kraft box with a red ribbon.
  return (
    <span className="relative inline-flex">
      <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
        <path d="M11 17 L12.5 5 L19 12 Z M29 17 L27.5 5 L21 12 Z" fill="var(--color-card)" stroke="var(--color-foreground)" strokeWidth="1.8" strokeLinejoin="round" />
        <ellipse cx="20" cy="18" rx="10" ry="8.5" fill="var(--color-card)" stroke="var(--color-foreground)" strokeWidth="1.8" />
        <ellipse cx="16" cy="18" rx="2" ry="2.4" fill="var(--color-foreground)" />
        <ellipse cx="24" cy="18" rx="2" ry="2.4" fill="var(--color-foreground)" />
        <rect x="5" y="22" width="30" height="15" rx="2.5" fill="var(--color-kraft)" stroke="var(--color-foreground)" strokeWidth="1.8" />
        <rect x="18" y="22" width="4" height="15" fill="var(--color-ribbon)" />
      </svg>
      {live && (
        <span className="absolute -right-0.5 -bottom-0.5 size-2">
          <span className="absolute inset-0 rounded-full bg-ribbon breathe" />
          <span className="absolute inset-0 rounded-full bg-ribbon" />
        </span>
      )}
    </span>
  );
}

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
