import { NotFoundPage, PotErrorPage, PotSkeleton } from "@/components/kitty/States";
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
import { PUBLIC_SITE_URL } from "@/lib/config";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Share2 } from "lucide-react";

export const Route = createFileRoute("/k/$slug_/share")({
  validateSearch: (s: Record<string, unknown>) => ({ t: typeof s["t"] === "string" ? (s["t"] as string) : "" }),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: ({ context, params, deps }) => context.queryClient.ensureQueryData(potQuery(params.slug, deps.t)),
  head: () => ({
    meta: [
      { title: "Share your kitty · Kitty" },
      { name: "description", content: "One link. Kitty handles the rest." },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Share your kitty" },
      { property: "og:description", content: "One link. Kitty handles the rest." },
    ],
  }),
  component: SharePage,
  pendingComponent: PotSkeleton,
  errorComponent: PotErrorPage,
  notFoundComponent: () => <NotFoundPage />,
});

function SharePage() {
  const { slug } = Route.useParams();
  const { t } = Route.useSearch();
  const { data } = useLivePot(slug, t);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [reminders, setRem] = useState(data?.pot.reminders_enabled ?? true);
  const [canShare, setCanShare] = useState(false);
  const [fallback, setFallback] = useState<null | { kind: "copy" | "open"; value: string }>(null);
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    setOrigin((PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, ""));
    setCanShare(typeof navigator.share === "function");
  }, []);

  if (!data) return <Missing />;
  if (!data.isAdmin) return <Missing text="This manage link isn't valid. Check you copied all of it." />;

  const link = `${origin}/k/${slug}`;
  const manage = `${origin}/k/${slug}/manage?t=${t}`;
  const msg = shareMessage(data.pot.recipient_name, data.pot.occasion, link);
  const copyText = async (v: string): Promise<boolean> => {
    try { await navigator.clipboard.writeText(v); return true; } catch { /* fall through */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = v; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) return true;
    } catch { /* fall through */ }
    setFallback({ kind: "copy", value: v });
    return false;
  };
  const copy = async (v: string, label = "Copied") => { if (await copyText(v)) toast.success(label); };
  const openOut = (url: string) => {
    let w: Window | null = null;
    try { w = window.open(url, "_blank", "noopener"); } catch { w = null; }
    if (w) return;
    try { if (window.top) { window.top.location.href = url; return; } } catch { /* blocked */ }
    setFallback({ kind: "open", value: url });
  };
  const isPreview = /lovableproject\.com|id-preview--/.test(origin);
  const name = data.pot.recipient_name;
  const deadline = new Date(data.pot.deadline_at).getTime();
  const factor = data.pot.demo_speed ? Number(data.pot.demo_factor) || 60 : 1;
  const nudgeAt = new Date(deadline - (24 * 3600 * 1000) / factor).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
            <Button variant="quiet" size="tap" onClick={() => { toast("Opening WhatsApp"); openOut("https://wa.me/?text=" + encodeURIComponent(msg)); }}><MessageCircle /> WhatsApp</Button>
            <Button variant="quiet" size="tap" onClick={async () => {
              if (await copyText(msg)) toast.success("Copied. Paste it in Slack.");
              const t0 = Date.now();
              openOut("slack://open");
              setTimeout(() => { if (document.hasFocus() && Date.now() - t0 < 1500) openOut("https://app.slack.com/client"); }, 600);
            }}><Hash /> Slack</Button>
            <Button variant="quiet" size="tap" onClick={() => { toast("Opening your email app"); openOut("mailto:?subject=" + encodeURIComponent("Chip in for " + name + "'s gift") + "&body=" + encodeURIComponent(msg)); }}><Mail /> Email</Button>
          </div>
          {canShare && (
            <Button variant="quiet" size="tap" className="w-full" onClick={async () => {
              try { await navigator.share({ title: `Gift for ${name}`, text: msg, url: link }); toast.success("Shared"); }
              catch (e) { if ((e as Error)?.name === "AbortError") toast("Share cancelled"); else await copy(msg, "Couldn't open sharing, so I copied the message"); }
            }}><Share2 /> Share...</Button>
          )}
          {isPreview && <p className="text-[13px] text-muted-foreground">This is a preview link. Friends need the published link, which appears here once Kitty is published.</p>}
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
                try { await setReminders({ data: { slug, adminToken: t, enabled: v } }); toast.success("Saved"); } catch { setRem(!v); toast.error("Couldn't save that. Try again."); }
              }}
              aria-label="Reminders"
              className="relative before:absolute before:-inset-x-1 before:-inset-y-3 before:content-['']"
            />
          </label>
          <p className="pb-3 text-[13px] text-muted-foreground" aria-live="polite">
            {reminders ? `Kitty will draft a nudge on ${nudgeAt}. You approve it, then send it yourself.` : "No nudge. You can turn this on any time."}
          </p>
        </section>

        <Link to="/k/$slug/manage" params={{ slug }} search={{ t }} onClick={() => setPressed(true)} aria-busy={pressed} className={`inline-flex min-h-11 items-center text-[15px] underline underline-offset-4 transition-opacity active:opacity-60 ${pressed ? "opacity-60" : ""}`}>
          Watch the pot fill up
        </Link>
      </main>
      <Dialog open={!!fallback} onOpenChange={(o) => !o && setFallback(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[24px]">{fallback?.kind === "copy" ? "Copy failed. Select and copy it here." : "Your browser blocked the pop-up. Tap to open."}</DialogTitle>
          </DialogHeader>
          {fallback?.kind === "copy" ? (
            <textarea readOnly autoFocus value={fallback.value} onFocus={(e) => e.currentTarget.select()} rows={5} className="w-full rounded-[12px] border bg-card p-3 text-[15px]" />
          ) : fallback ? (
            <a href={fallback.value} target="_blank" rel="noopener noreferrer" className="block break-all rounded-[14px] border bg-card px-4 py-4 text-[17px] font-medium underline underline-offset-4">{fallback.value}</a>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
