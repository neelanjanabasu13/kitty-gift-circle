import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/kitty/Logo";
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
    <li className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
      <span className="text-sm">{label}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive"}`}>{ok ? "OK" : "Not OK"}{detail ? ` · ${detail}` : ""}</span>
    </li>
  );
}

function HealthPage() {
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="min-h-screen bg-gradient-warm">
      <main className="mx-auto max-w-lg space-y-5 px-5 py-8">
        <Logo />
        <h1 className="font-display text-3xl font-semibold">System check</h1>
        <p className="text-sm text-muted-foreground">Confirms the keys are set (never shown), gets a PayPal sandbox token and creates one 1.00 test hold order.</p>
        <Button variant="hero" size="xl" className="w-full" disabled={busy} onClick={async () => {
          setBusy(true); setErr(null);
          try { setRes(await healthCheck()); } catch (e) { setErr(e instanceof Error ? e.message : "Check failed"); } finally { setBusy(false); }
        }}>{busy ? <Loader2 className="animate-spin" /> : null} Run check</Button>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {res && (
          <ul className="kitty-card px-5">
            {Object.entries(res.secrets).map(([k, v]) => <Row key={k} label={`${k} set`} ok={v} />)}
            <Row label="Database" ok={res.database.ok} detail={res.database.error} />
            <Row label="PayPal sandbox token" ok={res.token.ok} detail={res.token.error} />
            <Row label={`Test AUTHORIZE order (1.00 ${res.currency})`} ok={res.order.ok} detail={res.order.id ? `${res.order.id} · ${res.order.status}` : res.order.error} />
          </ul>
        )}
      </main>
    </div>
  );
}
