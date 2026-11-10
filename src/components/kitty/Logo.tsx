import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

export function KittyMark({ className = "size-7", live = false }: { className?: string; live?: boolean }) {
  // Coin jar with cat ears, drawn in currentColor
  return (
    <span className="relative inline-flex">
      <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
        <path d="M9 13 L12 4 L18 10 Z M31 13 L28 4 L22 10 Z" fill="currentColor" />
        <rect x="7" y="10" width="26" height="26" rx="9" fill="currentColor" />
        <rect x="15" y="15.5" width="10" height="2.4" rx="1.2" fill="var(--color-background)" />
        <circle cx="20" cy="26" r="3.2" fill="var(--color-background)" />
      </svg>
      {live && (
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5">
          <span className="absolute inset-0 rounded-full bg-ember breathe" />
          <span className="absolute inset-0 rounded-full bg-ember" />
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

export function TopBar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 md:px-8">
      <Logo />
      {right}
    </header>
  );
}
