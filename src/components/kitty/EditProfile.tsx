import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Chip } from "./Chip";
import { INTERESTS } from "@/lib/config";
import { updatePotProfile } from "@/lib/kitty.functions";

export function EditProfile({ open, onOpenChange, slug, adminToken, name, likes: l0, dislikes: d0, wishlist: w0 }: {
  open: boolean; onOpenChange: (v: boolean) => void; slug: string; adminToken: string; name: string; likes: string[]; dislikes: string[]; wishlist: string | null;
}) {
  const [likes, setLikes] = useState(l0);
  const [dislikes, setDislikes] = useState(d0);
  const [wishlist, setWishlist] = useState(w0 ?? "");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const options = Array.from(new Set([...INTERESTS, ...likes, ...dislikes]));
  const cycle = (t: string) => {
    if (likes.includes(t)) { setLikes(likes.filter((x) => x !== t)); setDislikes([...dislikes, t]); }
    else if (dislikes.includes(t)) setDislikes(dislikes.filter((x) => x !== t));
    else setLikes([...likes, t]);
  };
  const save = async () => {
    if (wishlist.trim() && !/^https?:\/\/\S+\.\S+/.test(wishlist.trim())) { toast.error("That wishlist link doesn't look right."); return; }
    setBusy(true);
    onOpenChange(false);
    try {
      await updatePotProfile({ data: { slug, adminToken, likes, dislikes, wishlist_url: wishlist.trim() } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[14px]">
        <DialogHeader>
          <DialogTitle className="font-display text-[28px] font-normal">What's {name} into?</DialogTitle>
          <DialogDescription>Tap once for a like, twice for something to avoid, three times to clear. Kitty re-plans from scratch.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {options.map((t) => (
            <Chip key={t} selected={likes.includes(t)} onClick={() => cycle(t)} className={dislikes.includes(t) ? "border-destructive/40 text-destructive line-through" : undefined}>{t}</Chip>
          ))}
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { e.preventDefault(); setLikes([...likes, custom.trim().toLowerCase()]); setCustom(""); } }} placeholder="add your own" className="h-11 w-40 rounded-full" maxLength={30} />
        </div>
        <Input value={wishlist} onChange={(e) => setWishlist(e.target.value)} placeholder="Wishlist link (optional)" inputMode="url" className="h-12 rounded-[12px]" />
        <Button variant="ink" size="xl" onClick={save} disabled={busy}>Save and re-plan</Button>
      </DialogContent>
    </Dialog>
  );
}
