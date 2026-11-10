import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TopBar } from "@/components/kitty/Logo";
import { Missing } from "@/components/kitty/Missing";
import { PotLive } from "@/components/kitty/PotLive";
import { Cancelled } from "@/components/kitty/Stages";
import { potQuery, useLivePot } from "@/components/kitty/usePot";
import { cancelPot, runKittyNow } from "@/lib/kitty.functions";
import { EditProfile } from "@/components/kitty/EditProfile";
import { ClosingStage, useTick } from "@/components/kitty/Closing";
import { formatMoney } from "@/lib/kitty";

export const Route = createFileRoute("/k/$slug_/manage")({
  validateSearch: (s: Record<string, unknown>) => ({ t: typeof s["t"] === "string" ? (s["t"] as string) : "" }),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: ({ context, params, deps }) => context.queryClient.ensureQueryData(potQuery(params.slug, deps.t)),
  head: () => ({
    meta: [
      { title: "Manage your kitty · Kitty" },
      { name: "description", content: "Watch the pot fill, read the card and see what Kitty is doing." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Manage your kitty" },
      { property: "og:description", content: "Watch the pot fill and see what Kitty is doing." },
    ],
  }),
  component: ManagePage,
});

function ManagePage() {
  const { slug } = Route.useParams();
  const { t } = Route.useSearch();
  const { data, refetch } = useLivePot(slug, t);
  useTick(data);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!data?.isAdmin) return;
    try {
      const store = JSON.parse(localStorage.getItem("kitty:admin") || "{}");
      store[slug] = t;
      localStorage.setItem("kitty:admin", JSON.stringify(store));
    } catch { /* ignore */ }
  }, [data?.isAdmin, slug, t]);

  if (!data) return <Missing />;
  if (!data.isAdmin) return <Missing text="This manage link isn't valid. Check you copied all of it." />;
  const { pot } = data;
  const cancelled = pot.status === "cancelled";
  const canCancel = ["collecting", "voting", "veto"].includes(pot.status);
  const canRun = pot.status === "collecting";

  return (
    <div className="min-h-screen">
      <TopBar
        right={
          <div className="flex items-center gap-2">
            {!cancelled && <Button asChild variant="ink" size="tap"><Link to="/k/$slug/share" params={{ slug }} search={{ t }}>Share</Link></Button>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="quiet" size="icon" className="size-11" aria-label="Kitty options"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-[12px]">
                <DropdownMenuItem disabled={!canCancel} onSelect={() => setEditing(true)}>Edit likes and wishlist</DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/k/$slug" params={{ slug }}>View as a contributor</Link></DropdownMenuItem>
                {canCancel && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}>Cancel kitty</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
      <main className="mx-auto max-w-6xl space-y-10 px-5 pt-8 pb-20 md:px-8">
        <div>
          <p className="text-[13px] text-muted-foreground">{pot.organiser_name}'s kitty</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="mt-1 text-[44px] md:text-[64px]">For <em>{pot.recipient_name}</em></h1>
            {canRun && (
              <Button
                variant="quiet"
                size="tap"
                disabled={running || pot.agent_busy}
                onClick={async () => {
                  setRunning(true);
                  try { await runKittyNow({ data: { slug, adminToken: t } }); } catch (e) { toast.error(e instanceof Error ? e.message : "Kitty couldn't run just now."); } finally { setRunning(false); }
                }}
              >
                {running || pot.agent_busy ? "Kitty's working..." : "Run Kitty now"}
              </Button>
            )}
          </div>
        </div>

        {cancelled && <Cancelled />}
        {pot.status === "done" && data.receipt?.gift && (
          <section className="mx-auto max-w-xl space-y-4 text-center">
            <h2 className="text-[40px]">{data.receipt.payout?.status === "fallback" ? <>Paid for. <em>Ready to buy.</em></> : <><span className="tabular">{formatMoney(data.receipt.gift.price, pot.currency, { exact: true })}</span> is in <em>your PayPal.</em></>}</h2>
            <p className="text-[15px] text-muted-foreground">
              {data.receipt.payout?.status === "fallback"
                ? `Would pay out to ${pot.organiser_name} in production. Captured funds are held in Kitty's PayPal account.`
                : `Tap to buy it at ${data.receipt.gift.retailer ?? "the shop"}.`}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {data.receipt.gift.offer_url && <Button asChild variant="ink" size="xl"><a href={data.receipt.gift.offer_url} target="_blank" rel="noreferrer sponsored">Buy it at {data.receipt.gift.retailer ?? "the shop"}</a></Button>}
              <Button asChild variant="quiet" size="xl"><Link to="/k/$slug/receipt" params={{ slug }}>Receipt</Link></Button>
              <Button asChild variant="quiet" size="xl"><Link to="/k/$slug/card" params={{ slug }}>The card</Link></Button>
            </div>
          </section>
        )}
        {pot.status !== "done" && <ClosingStage view={data} adminToken={t} />}
        <PotLive view={data} />

        {pot.likes.length > 0 && (
          <section className="border-t pt-6 text-[14px] text-muted-foreground">
            <p>Kitty knows {pot.recipient_name} likes {pot.likes.join(", ")}{pot.dislikes.length ? ` and will avoid ${pot.dislikes.join(", ")}.` : "."}</p>
            {Object.keys(data.voteTally).length > 0 && (
              <p className="mt-1">Group votes: {Object.entries(data.voteTally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(", ")}</p>
            )}
          </section>
        )}
      </main>

      {editing && <EditProfile open={editing} onOpenChange={setEditing} slug={slug} adminToken={t} name={pot.recipient_name} likes={pot.likes} dislikes={pot.dislikes} wishlist={pot.wishlist_url} />}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-[14px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-[28px] font-normal">Call off the kitty?</AlertDialogTitle>
            <AlertDialogDescription>Kitty will release every hold straight away. Nobody gets charged, and this can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-[12px]">Keep it going</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-[12px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await cancelPot({ data: { slug, adminToken: t } });
                  if (r.failed) toast.warning(`${r.failed} hold${r.failed === 1 ? "" : "s"} didn't release first time. They'll drop off on their own.`);
                  await refetch();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Couldn't cancel. Try again.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Releasing..." : "Cancel and release holds"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
