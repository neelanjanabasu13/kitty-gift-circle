import { Link } from "@tanstack/react-router";

export function KittyMark({ className = "size-8" }: { className?: string }) {
  // Coin jar with cat ears
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M9 12 L12 4 L17 10 Z M31 12 L28 4 L23 10 Z" className="fill-primary" />
      <rect x="7" y="10" width="26" height="26" rx="10" className="fill-primary" />
      <rect x="15" y="15" width="10" height="2.6" rx="1.3" className="fill-primary-foreground" opacity="0.9" />
      <circle cx="20" cy="26" r="5" className="fill-primary-foreground" opacity="0.18" />
      <circle cx="20" cy="26" r="3" className="fill-primary-foreground" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link to="/" className="inline-flex items-center gap-2" aria-label="Kitty home">
      <KittyMark className="size-8" />
      <span className="font-display text-2xl font-semibold tracking-tight text-foreground">Kitty</span>
    </Link>
  );
}

export function PayPalTrust({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-center justify-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1 14-4-4 1.4-1.4L11 13.2l4.6-4.6L17 10l-6 6Z" /></svg>
      Powered by PayPal. Holds, not charges.
    </p>
  );
}
