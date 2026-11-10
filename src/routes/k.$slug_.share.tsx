import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, Copy, KeyRound, MessageCircle, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Logo } from "@/components/kitty/Logo";
import { Missing } from "@/components/kitty/Missing";
import { potQuery, useLivePot } from "@/components/kitty/usePot";
import { shareMessage } from "@/lib/kitty";
import { setReminders } from "@/lib/kitty.functions";

export const Route = createFileRoute("/k/$slug_/share")({
  validateSearch: (s: Record<string, unknown>) => ({ t: typeof s["t"] === "string" ? (s["t"] as string) : "" }),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: ({ context, params, deps }) => context.queryClient.ensureQueryData(potQuery(params.slug, deps.t)),
  head: () => ({
    meta: [
      { title: "Share your kitty · Kitty" },
      { name: "description", content: "One link. Kitty handles the rest." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Share your kitty" },
      { property: "og:description", content: "One link. Kitty handles the rest." },
    ],
  }),
  component: SharePage,
});

function CopyRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold">{icon}{label}</p>
      <div className="flex items-center gap-2 rounded-2xl border bg-secondary p-1.5 pl-4">
        <span className="min-w-0 flex-1 truncate text-sm">{value}</span>
        <Button
          variant="hero"
          size="sm"
          className="h-10 px-4"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success("Copied");
            setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function SharePage() {
  const { slug } = Route.useParams();
  const { t } = Route.useSearch();
  const { data } = useLivePot(slug, t);
  const [origin, setOrigin] = useState("");
  const [reminders, setRem] = useState(data?.pot.reminders_enabled ?? true);
  useEffect(() => setOrigin(window.location.origin), []);

  if (!data) return <Missing />;
  if (!data.isAdmin) return <Missing text="This manage link isn't valid. Check you copied all of it." />;

  const link = `${origin}/k/${slug}`;
  const manage = `${origin}/k/${slug}/manage?t=${t}`;
  const msg = shareMessage(data.pot.recipient_name, data.pot.occasion, link);

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="mx-auto max-w-xl px-5 py-5"><Logo /></header>
      <main className="mx-auto max-w-xl space-y-5 px-5 pb-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-semibold text-primary">Kitty's live for {data.pot.recipient_name}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold">One link. Kitty handles the rest.</h1>
        </motion.div>

        <section className="kitty-card space-y-5 p-5">
          <CopyRow label="Share link" value={link} icon={null} />
          <div className="rounded-2xl bg-primary-soft p-4 text-sm leading-relaxed text-accent-foreground">{msg}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="hero" size="xl" className="px-4">
              <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
            </Button>
            <Button variant="outline" size="xl" className="rounded-full px-4" onClick={async () => { await navigator.clipboard.writeText(msg); toast.success("Message copied"); }}>
              <Copy /> Copy message
            </Button>
          </div>
        </section>

        <section className="kitty-card flex items-start gap-4 p-5">
          <BellRing className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Reminders</p>
            <p className="text-sm text-muted-foreground">Kitty will draft a nudge for anyone who hasn't chipped in 24 hours before the deadline.</p>
          </div>
          <Switch
            checked={reminders}
            onCheckedChange={async (v) => {
              setRem(v);
              try { await setReminders({ data: { slug, adminToken: t, enabled: v } }); } catch { setRem(!v); toast.error("Couldn't save that. Try again."); }
            }}
            aria-label="Reminders"
          />
        </section>

        <section className="kitty-card space-y-3 p-5">
          <CopyRow label="Your private manage link" value={manage} icon={<KeyRound className="size-4 text-primary" />} />
          <p className="text-xs text-muted-foreground">Keep this one to yourself. It lets you see everything and cancel the kitty. We've also saved it on this device.</p>
        </section>

        <Button asChild variant="soft" size="xl" className="w-full">
          <Link to="/k/$slug/manage" params={{ slug }} search={{ t }}>Watch the pot fill up</Link>
        </Button>
      </main>
    </div>
  );
}

