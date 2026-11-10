import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, Copy, Lock, Mail, MessageCircle, Hash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TopBar } from "@/components/kitty/Logo";
import { Missing } from "@/components/kitty/Missing";
import { AgentTicker } from "@/components/kitty/AgentFeed";
import { potQuery, useLivePot } from "@/components/kitty/usePot";
import { formatMoney, shareMessage } from "@/lib/kitty";
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

function SharePage() {
  const { slug } = Route.useParams();
  const { t } = Route.useSearch();
  const { data } = useLivePot(slug, t);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [reminders, setRem] = useState(data?.pot.reminders_enabled ?? true);
  useEffect(() => setOrigin(window.location.origin), []);

  if (!data) return <Missing />;
  if (!data.isAdmin) return <Missing text="This manage link isn't valid. Check you copied all of it." />;

  const link = `${origin}/k/${slug}`;
  const manage = `${origin}/k/${slug}/manage?t=${t}`;
  const msg = shareMessage(data.pot.recipient_name, data.pot.occasion, link);
  const copy = async (v: string, label = "Copied") => {
    await navigator.clipboard.writeText(v);
    toast.success(label);
  };
  const ticker = data.people === 0 ? "Waiting for the first chip-in." : `${data.people} in so far. ${formatMoney(data.raised, data.pot.currency)} held.`;

  return (
    <div className="min-h-screen">
      <TopBar demo={!!data?.pot.demo_speed} demoFactor={data?.pot.demo_factor} />
      <main className="mx-auto max-w-2xl space-y-10 px-5 pt-10 pb-20">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <h1 className="text-[44px] md:text-[64px]">One link. <em>Kitty</em> handles the rest.</h1>
          <AgentTicker text={ticker} className="max-w-md" />
        </motion.div>

        <section className="space-y-3">
          <div className="flex items-center gap-2 rounded-[14px] border bg-card p-2 pl-5 shadow-bar">
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium md:text-[17px]">{link.replace(/^https?:\/\//, "")}</span>
            <Button variant="ink" size="xl" onClick={async () => { await copy(link, "Link copied"); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button asChild variant="quiet" size="tap"><a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button>
            <Button variant="quiet" size="tap" onClick={() => copy(msg, "Message copied for Slack")}><Hash /> Slack</Button>
            <Button asChild variant="quiet" size="tap"><a href={`mailto:?subject=${encodeURIComponent(`Gift for ${data.pot.recipient_name}`)}&body=${encodeURIComponent(msg)}`}><Mail /> Email</a></Button>
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-[13px] text-muted-foreground">Ready to send</p>
          <div className="flex justify-end">
            <button type="button" onClick={() => copy(msg, "Message copied")} className="max-w-[85%] rounded-[18px] rounded-br-[6px] bg-foreground px-4 py-3 text-left text-[15px] leading-relaxed text-background">
              {msg}
            </button>
          </div>
        </section>

        <section className="divide-y border-y">
          <div className="flex min-h-16 items-center gap-3 py-3">
            <Lock className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px]">Your private manage link</p>
              <p className="text-[13px] text-muted-foreground">Saved on this device. Keep it to yourself.</p>
            </div>
            <Button variant="quiet" size="tap" onClick={() => copy(manage, "Manage link copied")}><Copy /> Copy</Button>
          </div>
          <label className="flex min-h-16 cursor-pointer items-center gap-3 py-3">
            <span className="flex-1 text-[15px]">Draft a nudge 24 hours before the deadline for anyone who hasn't chipped in.</span>
            <Switch
              checked={reminders}
              onCheckedChange={async (v) => {
                setRem(v);
                try { await setReminders({ data: { slug, adminToken: t, enabled: v } }); } catch { setRem(!v); toast.error("Couldn't save that. Try again."); }
              }}
              aria-label="Reminders"
            />
          </label>
        </section>

        <Link to="/k/$slug/manage" params={{ slug }} search={{ t }} className="inline-flex min-h-11 items-center text-[15px] underline underline-offset-4">
          Watch the pot fill up
        </Link>
      </main>
    </div>
  );
}
