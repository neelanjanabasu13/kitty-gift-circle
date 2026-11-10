import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/kitty/Logo";
import { healthCheck, seedDemoPot } from "@/lib/kitty.functions";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "System check · Kitty" },
      { name: "description", content: "Checks Kitty's PayPal sandbox connection." },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "System check · Kitty" },
      { property: "og:description", content: "Checks Kitty's PayPal sandbox connection." },
    ],
  }),
  component: HealthPage,
});

type Result = Awaited<ReturnType<typeof healthCheck>>;

function Row({ label, ok, detail, plain = false }: { label: string; ok: boolean; detail?: string | undefined; plain?: boolean }) {
  return (
    <li className="flex min-h-14 items-center gap-3 py-3">
      <span className={`size-2 shrink-0 rounded-full ${ok ? "bg-paid" : "bg-destructive"}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words text-[15px]">{label}</span>
      <span className="max-w-[55%] text-right text-[13px] text-muted-foreground">{plain ? detail : <>{ok ? "ok" : "not ok"}{detail ? ` · ${detail}` : ""}</>}</span>
    </li>
  );
}

function HealthPage() {
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const navigate = useNavigate();
  const startDemo = async () => {
    setSeeding(true); setErr(null);
    try {
      const r = await seedDemoPot({ data: {} });
      try {
        const store = JSON.parse(localStorage.getItem("kitty:admin") || "{}");
        store[r.slug] = r.adminToken;
        localStorage.setItem("kitty:admin", JSON.stringify(store));
      } catch { /* ignore */ }
      navigate({ to: "/k/$slug/manage", params: { slug: r.slug }, search: { t: r.adminToken } });
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't start the demo pot."); setSeeding(false); }
  };
  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-lg space-y-8 px-5 pt-10 pb-20">
        <div className="space-y-3">
          <h1 className="text-[44px]">System check</h1>
          <p className="text-[15px] text-muted-foreground">Shows which keys are connected (never their values), gets a PayPal sandbox token, creates one 1.00 test hold order, runs a UK shop search and checks Lovable AI.</p>
        </div>
        <Button variant="ink" size="xl" className="w-full" disabled={busy} onClick={async () => {
          setBusy(true); setErr(null);
          try { setRes(await healthCheck()); } catch (e) { setErr(e instanceof Error ? e.message : "Check failed"); } finally { setBusy(false); }
        }}>{busy ? "Checking..." : "Run check"}</Button>
        {err && <p className="text-[14px] text-destructive">{err}</p>}
        {busy && !res && <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-[12px] shimmer" />)}</div>}
        {res && (
          <ul className="divide-y border-y">
            {Object.entries(res.secrets).map(([k, v]) => <Row key={k} label={k} ok={v} detail={v ? "connected" : "missing"} plain />)}
            <Row label="Database" ok={res.database.ok} detail={res.database.error} />
            <Row label="PayPal sandbox token" ok={res.token.ok} detail={res.token.error} />
            <Row label="Channel3 test search (GB)" ok={res.shop.ok} detail={res.shop.ok ? `${res.shop.offers} in-stock GBP offers from UK shops across ${res.shop.products} products` : res.shop.error} />
            <Row label="Lovable AI" ok={res.ai.ok} detail={res.ai.error} />
            <Row label={`Test hold order (1.00 ${res.currency})`} ok={res.order.ok} detail={res.order.id ? `${res.order.id} · ${res.order.status}` : res.order.error} />
          </ul>
        )}
        <p className="border-t pt-6 text-[14px] text-muted-foreground">
          Want to see it all move?{" "}
          <button type="button" onClick={startDemo} disabled={seeding} className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4">
            {seeding ? "Setting up Priya's pot..." : "Start the demo pot"}
          </button>
          . It has 9 demo chip-ins that are never sent to PayPal, and runs at demo speed.
        </p>
      </main>
    </div>
  );
}
