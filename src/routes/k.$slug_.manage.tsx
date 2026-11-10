import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Share2, HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Logo } from "@/components/kitty/Logo";
import { PotLive } from "@/components/kitty/PotLive";
import { potQuery, useLivePot } from "@/components/kitty/usePot";
import { cancelPot } from "@/lib/kitty.functions";
import { Missing } from "@/components/kitty/Missing";

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
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="mx-auto flex max-w-xl items-center justify-between px-5 py-5">
        <Logo />
        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-accent-foreground">Organiser view</span>
      </header>
      <main className="mx-auto max-w-xl space-y-4 px-5 pb-16">
        <div>
          <p className="text-sm text-muted-foreground">{pot.organiser_name}'s kitty</p>
          <h1 className="font-display text-4xl font-semibold">For {pot.recipient_name}</h1>
        </div>

        {cancelled ? (
          <section className="kitty-card space-y-2 p-6 text-center">
            <HeartHandshake className="mx-auto size-10 text-primary" />
            <h2 className="font-display text-2xl font-semibold">Kitty's off.</h2>
            <p className="text-muted-foreground">Every hold has been released and nobody was charged.</p>
          </section>
        ) : (
          <Button asChild variant="hero" size="xl" className="w-full">
            <Link to="/k/$slug/share" params={{ slug }} search={{ t }}><Share2 /> Share the link</Link>
          </Button>
        )}

        <PotLive view={data} />

        {pot.likes.length > 0 && (
          <section className="kitty-card p-5 text-sm">
            <p className="font-semibold">What Kitty knows about {pot.recipient_name}</p>
            <p className="mt-1 text-muted-foreground">Likes {pot.likes.join(", ")}{pot.dislikes.length ? `. Avoiding ${pot.dislikes.join(", ")}.` : "."}</p>
            {Object.keys(data.voteTally).length > 0 && (
              <p className="mt-1 text-muted-foreground">Group votes: {Object.entries(data.voteTally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(", ")}</p>
            )}
          </section>
        )}

        {!cancelled && ["collecting", "voting", "veto"].includes(pot.status) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full text-destructive hover:text-destructive">Cancel kitty</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Call off the kitty?</AlertDialogTitle>
                <AlertDialogDescription>Kitty will release every hold straight away. Nobody gets charged, and this can't be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">Keep it going</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
                  {busy ? <Loader2 className="animate-spin" /> : null} Yes, cancel and release holds
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </main>
    </div>
  );
}
