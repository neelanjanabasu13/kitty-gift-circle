import { cn } from "@/lib/utils";

export type MoneyState = "held" | "paid" | "released";

const styles: Record<MoneyState, string> = {
  held: "bg-held-soft text-held",
  paid: "bg-paid-soft text-paid",
  released: "bg-released-soft text-released",
};

export function MoneyPill({ state, className }: { state: MoneyState; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-semibold tracking-wide uppercase", styles[state], className)}>
      {state}
    </span>
  );
}

export function statusToMoney(status: string): MoneyState {
  if (status === "captured") return "paid";
  if (status === "voided" || status === "failed") return "released";
  return "held";
}
