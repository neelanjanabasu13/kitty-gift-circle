import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ImagePlus, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, Field } from "@/components/kitty/Chip";
import { Logo, PayPalTrust } from "@/components/kitty/Logo";
import { CLOSENESS, DEFAULT_CURRENCY, INTERESTS, OCCASIONS, VOTE_WINDOWS, type Closeness, type Occasion, type VoteWindow } from "@/lib/config";
import { formatMoney, suggestedAmount } from "@/lib/kitty";
import { createPot } from "@/lib/kitty.functions";

export const Route = createFileRoute("/start")({
  head: () => ({
    meta: [
      { title: "Start a kitty · Kitty" },
      { name: "description", content: "Set up a group gift in a minute. Tap a few chips and Kitty does the rest." },
      { property: "og:title", content: "Start a kitty" },
      { property: "og:description", content: "Set up a group gift in a minute. Nobody's charged unless the gift happens." },
    ],
  }),
  component: StartPage,
});

function defaultDeadline() {
  const d = new Date(Date.now() + 7 * 86400_000);
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TagPicker({ value, onChange, avoid, tone }: { value: string[]; onChange: (v: string[]) => void; avoid: string[]; tone: "primary" | "muted" }) {
  const [custom, setCustom] = useState("");
  const options = useMemo(() => Array.from(new Set([...INTERESTS, ...value])).filter((t) => !avoid.includes(t)), [value, avoid]);
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  const add = () => {
    const t = custom.trim().toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setCustom("");
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((t) => (
          <Chip key={t} tone={tone} selected={value.includes(t)} onClick={() => toggle(t)}>{t}</Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="Add your own" className="h-10 rounded-full" maxLength={30} />
        <Button type="button" variant="soft" size="icon" className="size-10 shrink-0" onClick={add} aria-label="Add"><Plus /></Button>
      </div>
    </div>
  );
}

function StartPage() {
  const navigate = useNavigate();
  const [knowsGift, setKnowsGift] = useState(false);
  const [productUrl, setProductUrl] = useState("");
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState<Occasion>("leaving");
  const [closeness, setCloseness] = useState<Closeness>("colleague");
  const [likes, setLikes] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [wishlistUrl, setWishlistUrl] = useState("");
  const [image, setImage] = useState<{ dataUrl: string; type: string } | null>(null);
  const [target, setTarget] = useState("120");
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [voteWindow, setVoteWindow] = useState<VoteWindow>("1d");
  const [expected, setExpected] = useState(10);
  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const targetNum = Number(target) || 0;
  const share = suggestedAmount(targetNum, expected);

  const onFile = (f?: File) => {
    if (!f) return;
    if (f.size > 4_500_000) { toast.error("That image is a bit big. Try one under 4.5 MB."); return; }
    const r = new FileReader();
    r.onload = () => setImage({ dataUrl: String(r.result), type: f.type });
    r.readAsDataURL(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Who's the gift for? Add their name."); return; }
    if (knowsGift && !productUrl.trim()) { toast.error("Paste the product link, or switch to letting Kitty choose."); return; }
    if (targetNum < 1) { toast.error("Set a target for the pot."); return; }
    if (!orgName.trim() || !/\S+@\S+\.\S+/.test(orgEmail)) { toast.error("Add your name and PayPal email so Kitty knows where the money goes."); return; }
    setBusy(true);
    try {
      const res = await createPot({
        data: {
          recipient_name: name.trim(),
          occasion,
          closeness,
          likes,
          dislikes,
          wishlist_url: knowsGift ? productUrl.trim() : wishlistUrl.trim(),
          wishlist_image: image ?? undefined,
          mode: knowsGift ? "fixed_split" : "pot_first",
          target_amount: Math.round(targetNum * 100) / 100,
          deadline_at: new Date(deadline).toISOString(),
          vote_window: knowsGift ? "off" : voteWindow,
          expected_count: expected,
          organiser_name: orgName.trim(),
          organiser_paypal_email: orgEmail.trim(),
        },
      });
      try {
        const store = JSON.parse(localStorage.getItem("kitty:admin") || "{}");
        store[res.slug] = res.adminToken;
        localStorage.setItem("kitty:admin", JSON.stringify(store));
      } catch {
        /* storage unavailable */
      }
      navigate({ to: "/k/$slug/share", params: { slug: res.slug }, search: { t: res.adminToken } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg.startsWith("[") ? "Some details look off. Check the links and email." : msg || "We couldn't start the kitty. Please try again.");
      setBusy(false);
    }
  };

  const symbol = DEFAULT_CURRENCY === "USD" ? "$" : "£";

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="mx-auto max-w-xl px-5 py-5"><Logo /></header>
      <form onSubmit={submit} className="mx-auto max-w-xl space-y-5 px-5 pb-32">
        <div>
          <h1 className="font-display text-4xl font-semibold">Start a kitty</h1>
          <p className="mt-2 text-muted-foreground">A minute of tapping now, and Kitty handles the collecting, choosing and buying.</p>
        </div>

        <section className="kitty-card space-y-4 p-5">
          <Field label="Know what to get?">
            <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
              {[{ v: false, l: "No, let Kitty choose" }, { v: true, l: "Yes, I've a link" }].map((o) => (
                <button key={o.l} type="button" onClick={() => setKnowsGift(o.v)} className="relative h-11 rounded-full text-sm font-semibold">
                  {knowsGift === o.v && <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-full bg-card shadow-soft" />}
                  <span className={`relative ${knowsGift === o.v ? "text-foreground" : "text-muted-foreground"}`}>{o.l}</span>
                </button>
              ))}
            </div>
          </Field>
          <AnimatePresence initial={false}>
            {knowsGift && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="space-y-3 pt-1">
                  <Input value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="Paste the product link" inputMode="url" className="h-12 rounded-xl" />
                  <p className="text-xs text-muted-foreground">Set the target to the gift's price below and Kitty will suggest an equal split.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="kitty-card space-y-6 p-5">
          <Field label="Who's it for?">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their first name" className="h-12 rounded-xl text-base" maxLength={60} autoComplete="off" />
          </Field>
          <Field label="What's the occasion?">
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => <Chip key={o.value} selected={occasion === o.value} onClick={() => setOccasion(o.value)}>{o.label}</Chip>)}
            </div>
          </Field>
          <Field label="How do you know them?">
            <div className="flex flex-wrap gap-2">
              {CLOSENESS.map((o) => <Chip key={o.value} selected={closeness === o.value} onClick={() => setCloseness(o.value)}>{o.label}</Chip>)}
            </div>
          </Field>
        </section>

        {!knowsGift && (
          <section className="kitty-card space-y-6 p-5">
            <Field label={`What's ${name.trim() || "they"} into?`} hint="Kitty uses this to find gifts that actually fit.">
              <TagPicker value={likes} onChange={setLikes} avoid={dislikes} tone="primary" />
            </Field>
            <Field label="Anything to avoid?">
              <TagPicker value={dislikes} onChange={setDislikes} avoid={likes} tone="muted" />
            </Field>
            <Field label="Wishlist" hint="Optional. A link or a screenshot both help.">
              <Input value={wishlistUrl} onChange={(e) => setWishlistUrl(e.target.value)} placeholder="Wishlist link" inputMode="url" className="h-12 rounded-xl" />
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              {image ? (
                <div className="relative w-28">
                  <img src={image.dataUrl} alt="Wishlist screenshot" className="h-28 w-28 rounded-xl object-cover" />
                  <button type="button" onClick={() => setImage(null)} className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-foreground text-background" aria-label="Remove screenshot"><X className="size-4" /></button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => fileRef.current?.click()}><ImagePlus /> Add a screenshot</Button>
              )}
            </Field>
          </section>
        )}

        <section className="kitty-card space-y-6 p-5">
          <Field label={knowsGift ? "Gift price" : "Pot target"}>
            <div className="relative">
              <span className="absolute top-1/2 left-4 -translate-y-1/2 font-display text-xl text-muted-foreground">{symbol}</span>
              <Input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="h-14 rounded-xl pl-9 font-display text-2xl" />
            </div>
          </Field>
          <Field label="How many people are chipping in?" hint={targetNum > 0 ? `That's about ${formatMoney(share, DEFAULT_CURRENCY)} each.` : undefined}>
            <div className="flex items-center gap-3">
              <Button type="button" variant="soft" size="icon" className="size-11" onClick={() => setExpected((n) => Math.max(1, n - 1))} aria-label="Fewer">−</Button>
              <span className="w-12 text-center font-display text-2xl font-semibold">{expected}</span>
              <Button type="button" variant="soft" size="icon" className="size-11" onClick={() => setExpected((n) => Math.min(500, n + 1))} aria-label="More">+</Button>
            </div>
          </Field>
          <Field label="Deadline">
            <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-12 rounded-xl" />
          </Field>
          {!knowsGift && (
            <Field label="Voting window" hint="Everyone votes on Kitty's picks. Kitty decides at the end of the window or once everyone's voted, whichever comes first.">
              <div className="flex flex-wrap gap-2">
                {VOTE_WINDOWS.map((o) => <Chip key={o.value} selected={voteWindow === o.value} onClick={() => setVoteWindow(o.value)}>{o.label}</Chip>)}
              </div>
            </Field>
          )}
        </section>

        <section className="kitty-card space-y-4 p-5">
          <Field label="You, the organiser" hint="The money's paid out to this PayPal account once Kitty buys the gift.">
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Your name" className="h-12 rounded-xl" autoComplete="name" />
            <Input value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} placeholder="Your PayPal email" type="email" className="h-12 rounded-xl" autoComplete="email" />
          </Field>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/90 px-5 py-4 backdrop-blur">
          <div className="mx-auto max-w-xl space-y-2">
            <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy}>
              {busy ? <><Loader2 className="animate-spin" /> Starting…</> : "Start the kitty"}
            </Button>
            <PayPalTrust />
          </div>
        </div>
      </form>
    </div>
  );
}
