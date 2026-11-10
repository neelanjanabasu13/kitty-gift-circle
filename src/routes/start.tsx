import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowUp, ImagePlus, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/kitty/Chip";
import { KittyMark, Logo } from "@/components/kitty/Logo";
import { CLOSENESS, DEFAULT_CURRENCY, INTERESTS, OCCASIONS, VOTE_WINDOWS, type Closeness, type Occasion, type VoteWindow } from "@/lib/config";
import { formatMoney, suggestedAmount } from "@/lib/kitty";
import { createPot } from "@/lib/kitty.functions";

export const Route = createFileRoute("/start")({
  validateSearch: (s: Record<string, unknown>) => ({ name: typeof s["name"] === "string" ? (s["name"] as string).slice(0, 60) : undefined }),
  head: () => ({
    meta: [
      { title: "Start a kitty · Kitty" },
      { name: "description", content: "Answer a few quick questions and Kitty does the collecting, choosing and buying." },
      { property: "og:title", content: "Start a kitty" },
      { property: "og:description", content: "Set up a group gift in a minute. Nobody's charged unless the gift happens." },
    ],
  }),
  component: StartPage,
});

const pad = (n: number) => String(n).padStart(2, "0");
const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
function preset(kind: "tomorrow" | "3days" | "friday") {
  const d = new Date();
  if (kind === "tomorrow") { d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); }
  if (kind === "3days") { d.setDate(d.getDate() + 3); d.setHours(18, 0, 0, 0); }
  if (kind === "friday") { const add = ((5 - d.getDay() + 7) % 7) || 7; d.setDate(d.getDate() + add); d.setHours(17, 0, 0, 0); }
  return toLocal(d);
}
const DEADLINES = [
  { key: "tomorrow", label: "Tomorrow 6pm" },
  { key: "3days", label: "In 3 days" },
  { key: "friday", label: "Friday 5pm" },
] as const;
const TARGETS = [50, 80, 120, 200];

type StepId = "name" | "occasion" | "closeness" | "mode" | "likes" | "dislikes" | "wishlist" | "money" | "deadline" | "vote" | "organiser" | "review";

function StartPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [name, setName] = useState(search.name ?? "");
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [closeness, setCloseness] = useState<Closeness | null>(null);
  const [knowsGift, setKnowsGift] = useState<boolean | null>(null);
  const [productUrl, setProductUrl] = useState("");
  const [likes, setLikes] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [wishlistUrl, setWishlistUrl] = useState("");
  const [image, setImage] = useState<{ dataUrl: string; type: string } | null>(null);
  const [target, setTarget] = useState("120");
  const [expected, setExpected] = useState(10);
  const [deadline, setDeadline] = useState(() => preset("friday"));
  const [deadlineKey, setDeadlineKey] = useState<string>("friday");
  const [voteWindow, setVoteWindow] = useState<VoteWindow>("1d");
  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(search.name ? 1 : 0);
  const fileRef = useRef<HTMLInputElement>(null);

  const who = name.trim() || "them";
  const targetNum = Number(target) || 0;
  const share = suggestedAmount(targetNum, expected);
  const occLabel = OCCASIONS.find((o) => o.value === occasion)?.label;
  const closeLabel = CLOSENESS.find((o) => o.value === closeness)?.label;
  const dlLabel = DEADLINES.find((d) => d.key === deadlineKey)?.label ?? new Date(deadline).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  const steps: StepId[] = useMemo(() => {
    const all: StepId[] = ["name", "occasion", "closeness", "mode", "likes", "dislikes", "wishlist", "money", "deadline", "vote", "organiser", "review"];
    return knowsGift ? all.filter((s) => !["likes", "dislikes", "wishlist", "vote"].includes(s)) : all;
  }, [knowsGift]);
  const step = steps[Math.min(idx, steps.length - 1)]!;
  const progress = Math.round((Math.min(idx, steps.length - 1) / (steps.length - 1)) * 100);

  const valid: Record<StepId, boolean> = {
    name: name.trim().length > 0,
    occasion: !!occasion,
    closeness: !!closeness,
    mode: knowsGift === false || (knowsGift === true && /^https?:\/\/\S+\.\S+/.test(productUrl.trim())),
    likes: true,
    dislikes: true,
    wishlist: !wishlistUrl.trim() || /^https?:\/\/\S+\.\S+/.test(wishlistUrl.trim()),
    money: targetNum >= 1 && expected >= 1,
    deadline: new Date(deadline).getTime() > Date.now(),
    vote: true,
    organiser: orgName.trim().length > 0 && /\S+@\S+\.\S+/.test(orgEmail),
    review: true,
  };

  const question: Record<StepId, string> = {
    name: "Who's the gift for?",
    occasion: `Lovely. What's the occasion for ${who}?`,
    closeness: `How do you know ${who}?`,
    mode: "Do you already know what to get?",
    likes: `What's ${who} into? Pick a few.`,
    dislikes: "Anything I should avoid?",
    wishlist: "Got a wishlist? A link or a screenshot both help.",
    money: knowsGift ? "What does the gift cost, and how many are chipping in?" : "How big should the pot be?",
    deadline: "When should the pot close?",
    vote: "Want a quick vote on my picks?",
    organiser: "Last bit. Where should the money go once I buy it?",
    review: "Here's the plan. Tap anything to change it.",
  };

  const reaction = (s: StepId): string | null => {
    if (s === "occasion" && occasion) return occasion === "leaving" ? "A send-off. Let's make it a good one." : occasion === "new_baby" ? "Congratulations to them." : null;
    if (s === "mode" && knowsGift === false) return "Leave it with me. I'll find real gifts that fit.";
    if (s === "likes" && likes.length) return `${likes.slice(0, 2).map(cap).join(" and ")}. Good to know.`;
    if (s === "dislikes" && dislikes.length) return `Noted. I'll steer clear of ${dislikes.slice(0, 2).join(" and ")}.`;
    if (s === "money" && targetNum >= 1) return `About ${formatMoney(share, DEFAULT_CURRENCY)} each. Easy.`;
    return null;
  };

  const summary: Record<StepId, string> = {
    name: name.trim(),
    occasion: occLabel ?? "",
    closeness: closeLabel ?? "",
    mode: knowsGift ? "I've got a link" : "Kitty chooses",
    likes: likes.length ? likes.join(", ") : "Skipped",
    dislikes: dislikes.length ? dislikes.join(", ") : "Nothing",
    wishlist: image ? "Screenshot added" : wishlistUrl.trim() ? "Link added" : "Skipped",
    money: `${formatMoney(targetNum, DEFAULT_CURRENCY)} from ${expected} people`,
    deadline: dlLabel,
    vote: VOTE_WINDOWS.find((v) => v.value === voteWindow)?.label ?? "",
    organiser: `${orgName.trim()} · ${orgEmail.trim()}`,
    review: "",
  };

  const next = () => {
    if (!valid[step]) return;
    setIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  // Enter always advances when the current answer is valid, even after tapping a chip.
  const keyRef = useRef<() => void>(() => {});
  keyRef.current = () => {
    if (step === "review") { if (!busy) void submit(); return; }
    next();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented || e.shiftKey || e.isComposing) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return; // the form handles those
      if (el?.closest("[role=dialog]")) return;
      e.preventDefault();
      keyRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onFile = (f?: File) => {
    if (!f) return;
    if (f.size > 4_500_000) { toast.error("That image is a bit big. Try one under 4.5 MB."); return; }
    const r = new FileReader();
    r.onload = () => setImage({ dataUrl: String(r.result), type: f.type });
    r.readAsDataURL(f);
  };

  const submit = async () => {
    for (const s of steps) if (!valid[s]) { setIdx(steps.indexOf(s)); toast.error("One answer needs a quick look."); return; }
    setBusy(true);
    try {
      const res = await createPot({
        data: {
          recipient_name: name.trim(),
          occasion: occasion!,
          closeness: closeness!,
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
      } catch { /* storage unavailable */ }
      navigate({ to: "/k/$slug/share", params: { slug: res.slug }, search: { t: res.adminToken } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg.startsWith("[") ? "Some details look off. Check the links and email." : msg || "We couldn't start the kitty. Please try again.");
      setBusy(false);
    }
  };

  const done = step === "review" ? [] : steps.slice(0, Math.min(idx, steps.length - 1));

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="fixed inset-x-0 top-0 z-20 h-0.5 bg-transparent">
        <motion.div className="h-full bg-kraft" animate={{ width: `${progress}%` }} />
      </div>
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-3">
        <Logo />
        {idx > 0 ? (
          <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} className="inline-flex min-h-11 items-center gap-1.5 text-[14px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back</button>
        ) : (
          <Link to="/" className="inline-flex min-h-11 items-center text-[14px] text-muted-foreground hover:text-foreground">Cancel</Link>
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-8">
        {/* Answered so far */}
        <ul className="space-y-3 pt-4">
          {done.map((s) => (
            <motion.li key={s} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-muted-foreground">{question[s]}</span>
              <button type="button" onClick={() => setIdx(steps.indexOf(s))} className="inline-flex min-h-9 max-w-full items-center gap-1.5 truncate rounded-full border bg-card px-3 text-[13px] hover:border-foreground/30">
                {summary[s]} <Pencil className="size-3 text-muted-foreground" />
              </button>
            </motion.li>
          ))}
        </ul>

        {/* Current question */}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pt-10">
            {done.length > 0 && reaction(done[done.length - 1]!) && (
              <p className="mb-3 flex items-center gap-2 text-[14px] text-muted-foreground"><KittyMark className="size-3.5" />{reaction(done[done.length - 1]!)}</p>
            )}
            <div className="flex items-start gap-3">
              <span className="mt-2 hidden text-foreground sm:block"><KittyMark className="size-6" live /></span>
              <h1 className="text-[36px] md:text-[44px]">{question[step]}</h1>
            </div>
            {step === "vote" && <p className="mt-3 text-[14px] text-muted-foreground">I decide at the end of the window or once everyone's voted, whichever comes first.</p>}
            {step === "organiser" && <p className="mt-3 text-[14px] text-muted-foreground">The money's paid out to your PayPal once Kitty buys the gift.</p>}

            {step === "review" && (
              <div className="mt-8 surface divide-y">
                {steps.filter((s) => s !== "review").map((s) => (
                  <button key={s} type="button" onClick={() => setIdx(steps.indexOf(s))} className="flex min-h-14 w-full items-center justify-between gap-4 px-4 text-left hover:bg-muted/50">
                    <span className="text-[13px] text-muted-foreground">{REVIEW_LABEL[s]}</span>
                    <span className="truncate text-[15px]">{summary[s]}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Composer: answers live here, sticky on mobile */}
      <form
        onSubmit={(e) => { e.preventDefault(); step === "review" ? submit() : next(); }}
        className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur"
      >
        <div className="mx-auto max-w-2xl space-y-4 px-5 py-4">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {step === "name" && (
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Their first name" maxLength={60} className="h-12 rounded-[12px] text-[16px]" autoComplete="off" />
              )}
              {step === "occasion" && <Chips options={OCCASIONS} value={occasion} onPick={(v) => { setOccasion(v); setIdx((i) => i + 1); }} />}
              {step === "closeness" && <Chips options={CLOSENESS} value={closeness} onPick={(v) => { setCloseness(v); setIdx((i) => i + 1); }} />}
              {step === "mode" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Chip selected={knowsGift === false} onClick={() => { setKnowsGift(false); setIdx((i) => i + 1); }}>No, Kitty chooses</Chip>
                    <Chip selected={knowsGift === true} onClick={() => setKnowsGift(true)}>Yes, I've a link</Chip>
                  </div>
                  {knowsGift && <Input autoFocus value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="Paste the product link" inputMode="url" className="h-12 rounded-[12px]" />}
                </div>
              )}
              {step === "likes" && <TagPicker value={likes} onChange={setLikes} avoid={dislikes} />}
              {step === "dislikes" && <TagPicker value={dislikes} onChange={setDislikes} avoid={likes} extra={["scented stuff", "alcohol", "clutter", "novelty"]} />}
              {step === "wishlist" && (
                <div className="space-y-3">
                  <Input value={wishlistUrl} onChange={(e) => setWishlistUrl(e.target.value)} placeholder="Wishlist link (optional)" inputMode="url" className="h-12 rounded-[12px]" />
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                  {image ? (
                    <div className="flex items-center gap-3">
                      <img src={image.dataUrl} alt="Wishlist screenshot" className="size-14 rounded-[10px] border object-cover" />
                      <button type="button" onClick={() => setImage(null)} className="inline-flex min-h-11 items-center gap-1 text-[14px] text-muted-foreground"><X className="size-4" /> Remove</button>
                    </div>
                  ) : (
                    <Button type="button" variant="quiet" size="tap" onClick={() => fileRef.current?.click()}><ImagePlus /> Add a screenshot</Button>
                  )}
                </div>
              )}
              {step === "money" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {!knowsGift && TARGETS.map((t) => <Chip key={t} selected={targetNum === t} onClick={() => setTarget(String(t))}>{formatMoney(t, DEFAULT_CURRENCY)}</Chip>)}
                    <Input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Custom amount" className="h-11 w-28 rounded-full text-center tabular" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="quiet" size="icon" className="size-11" onClick={() => setExpected((n) => Math.max(1, n - 1))} aria-label="Fewer people">−</Button>
                      <span className="w-20 text-center text-[15px] tabular">{expected} people</span>
                      <Button type="button" variant="quiet" size="icon" className="size-11" onClick={() => setExpected((n) => Math.min(500, n + 1))} aria-label="More people">+</Button>
                    </div>
                    <span className="text-[14px] text-muted-foreground tabular">about {formatMoney(share, DEFAULT_CURRENCY)} each</span>
                  </div>
                </div>
              )}
              {step === "deadline" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {DEADLINES.map((d) => <Chip key={d.key} selected={deadlineKey === d.key} onClick={() => { setDeadlineKey(d.key); setDeadline(preset(d.key)); }}>{d.label}</Chip>)}
                    <Chip selected={deadlineKey === "custom"} onClick={() => setDeadlineKey("custom")}>Pick a time</Chip>
                  </div>
                  {deadlineKey === "custom" && <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-12 rounded-[12px]" />}
                </div>
              )}
              {step === "vote" && <div className="flex flex-wrap gap-2">{VOTE_WINDOWS.map((o) => <Chip key={o.value} selected={voteWindow === o.value} onClick={() => setVoteWindow(o.value)}>{o.label}</Chip>)}</div>}
              {step === "organiser" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input autoFocus value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Your name" className="h-12 rounded-[12px]" autoComplete="name" />
                  <Input value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} placeholder="Your PayPal email" type="email" className="h-12 rounded-[12px]" autoComplete="email" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {step !== "occasion" && step !== "closeness" && (
            <div className="flex items-center justify-between gap-3">
              <span className="hidden text-[12px] text-muted-foreground sm:inline">{step === "review" ? "" : "Press Enter to continue"}</span>
              <div className="ml-auto flex items-center gap-2">
                {["likes", "dislikes", "wishlist"].includes(step) && <Button type="button" variant="ghost" size="tap" onClick={() => setIdx((i) => i + 1)}>Skip</Button>}
                {step === "review" ? (
                  <Button type="submit" variant="ink" size="xl" disabled={busy} className="min-w-44">{busy ? "Starting..." : "Start the kitty"}</Button>
                ) : (
                  step !== "mode" || knowsGift ? <Button type="submit" variant="ink" size="tap" disabled={!valid[step]} aria-label="Continue"><ArrowUp /> Continue</Button> : null
                )}
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

const REVIEW_LABEL: Record<StepId, string> = {
  name: "For", occasion: "Occasion", closeness: "You are their", mode: "Gift", likes: "Into", dislikes: "Avoid",
  wishlist: "Wishlist", money: "Pot", deadline: "Closes", vote: "Vote", organiser: "Pay out to", review: "",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Chips<T extends string>({ options, value, onPick }: { options: readonly { value: T; label: string }[]; value: T | null; onPick: (v: T) => void }) {
  return <div className="flex flex-wrap gap-2">{options.map((o) => <Chip key={o.value} selected={value === o.value} onClick={() => onPick(o.value)}>{o.label}</Chip>)}</div>;
}

function TagPicker({ value, onChange, avoid, extra = [] }: { value: string[]; onChange: (v: string[]) => void; avoid: string[]; extra?: string[] }) {
  const [custom, setCustom] = useState("");
  const [adding, setAdding] = useState(false);
  const options = Array.from(new Set([...extra, ...INTERESTS, ...value])).filter((t) => !avoid.includes(t));
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  const add = () => {
    const t = custom.trim().toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setCustom("");
    setAdding(false);
  };
  return (
    <div className="max-h-[40vh] space-y-3 overflow-y-auto">
      <div className="flex flex-wrap gap-2">
        {options.map((t) => <Chip key={t} selected={value.includes(t)} onClick={() => toggle(t)}>{t}</Chip>)}
        {adding ? (
          <Input autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} onBlur={add} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Type and press Enter" className="h-11 w-48 rounded-full" maxLength={30} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-11 items-center gap-1 px-2 text-[14px] text-muted-foreground hover:text-foreground"><Plus className="size-4" /> add your own</button>
        )}
      </div>
    </div>
  );
}
