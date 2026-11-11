import { AlertTriangle } from "lucide-react";

/** Kinds that mean the money plan changed after a capture problem. */
const KINDS: Record<string, string> = {
  capture_resplit: "One hold couldn't be taken, so Kitty took a little more from the others to cover the gift. Nobody paid more than they held.",
  capture_swap: "Some holds couldn't be taken, so Kitty switched to a cheaper pick the money covers and refunded the difference to everyone.",
  pot_cancelled: "Kitty's off. Every payment was refunded and every hold released.",
  capture_failed: "A hold couldn't be taken. Kitty is re-totalling what was paid.",
};

/** Organiser banner explaining what happened when a capture failed. Reads the latest money event. */
export function MoneyBanner({ events }: { events: { kind: string; message: string; at: string }[]; currency?: string }) {
  const failed = events.some((e) => e.kind === "capture_failed");
  if (!failed) return null;
  const latest = events.find((e) => e.kind in KINDS);
  if (!latest) return null;
  return (
    <div role="status" className="flex gap-3 rounded-[14px] border border-kraft bg-kraft-soft p-4 text-[15px]">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-kraft-deep" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">{KINDS[latest.kind]}</p>
        <p className="text-[14px] text-muted-foreground">{latest.message}</p>
      </div>
    </div>
  );
}
