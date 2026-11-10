import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/kitty/Logo";
import { healthCheck } from "@/lib/kitty.functions";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "System check · Kitty" },
      { name: "description", content: "Checks Kitty's PayPal sandbox connection." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "System check · Kitty" },
      { property: "og:description", content: "Checks Kitty's PayPal sandbox connection." },
    ],
  }),
  component: HealthPage,
});

type Result = Awaited<ReturnType<typeof healthCheck>>;

function Row({ label, ok, detail }: { label: string; ok: boolean; detail?: string | undefined }) {
  return (
    <li className="flex min-h-14 items-center gap-3 py-3">
      <span className={`size-2 shrink-0 rounded-full ${ok ? "bg-paid" : "bg-destructive"}`} aria-hidden="true" />
      <span className="flex-1 text-[15px]">{label}</span>
      <span className="max-w-[55%] truncate text-right text-[13px] text-muted-foreground">{ok ? "ok" : "not ok"}{detail ? ` · ${detail}` : ""}</span>
    </li>
  );
}

function HealthPage() {
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-lg space-y-8 px-5 pt-10 pb-20">
        <div className="space-y-3">
          <h1 className="text-[44px]">System check</h1>
          <p className="text-[15px] text-muted-foreground">Confirms the keys are set (never shown), gets a PayPal sandbox token and creates one 1.00 test hold order.</p>
        </div>
        <Button variant="ink" size="xl" className="w-full" disabled={busy} onClick={async () => {
          setBusy(true); setErr(null);
          try { setRes(await healthCheck()); } catch (e) { setErr(e instanceof Error ? e.message : "Check failed"); } finally { setBusy(false); }
        }}>{busy ? "Checking..." : "Run check"}</Button>
        {err && <p className="text-[14px] text-destructive">{err}</p>}
        {busy && !res && <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-[12px] shimmer" />)}</div>}
        {res && (
          <ul className="divide-y border-y">
            {Object.entries(res.secrets).map(([k, v]) => <Row key={k} label={`${k} set`} ok={v} />)}
            <Row label="Database" ok={res.database.ok} detail={res.database.error} />
            <Row label="PayPal sandbox token" ok={res.token.ok} detail={res.token.error} />
            <Row label={`Test hold order (1.00 ${res.currency})`} ok={res.order.ok} detail={res.order.id ? `${res.order.id} · ${res.order.status}` : res.order.error} />
          </ul>
        )}
      </main>
    </div>
  );
}
