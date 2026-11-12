import { useState } from "react";
import { Copy, Mail, MessageCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { KittyMascot } from "./KittyMascot";
import { approveReminder } from "@/lib/kitty.functions";
import { PUBLIC_SITE_URL } from "@/lib/config";

type Reminder = { id: string; draft_text: string | null; approved_at: string | null; missing_count: number | null };

/** Kitty drafts the nudge; the organiser approves it once and sends it from their own app. */
export function ReminderCard({ reminder, slug, adminToken, onDone }: { reminder: Reminder; slug: string; adminToken: string; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reminder.draft_text ?? "");
  const [busy, setBusy] = useState(false);
  const link = `${PUBLIC_SITE_URL.replace(/\/$/, "")}/k/${slug}`;
  const message = (reminder.approved_at ? reminder.draft_text ?? text : text).replace("[link]", link);
  const n = reminder.missing_count ?? 0;

  return (
    <section className="surface space-y-4 p-5">
      <div className="flex items-start gap-3">
        <KittyMascot state="idle" size={56} />
        <div className="min-w-0">
          <h2 className="text-[26px]">{reminder.approved_at ? "Your nudge is ready to send" : "I drafted a nudge"}</h2>
          <p className="text-[14px] text-muted-foreground">
            For the {n === 1 ? "1 person who hasn't" : `${n} people who haven't`} chipped in yet. Kitty never sends it, you do, from your own app.
          </p>
        </div>
      </div>

      {editing && !reminder.approved_at ? (
        <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={400} rows={4} className="rounded-[12px] text-[15px]" aria-label="Edit the nudge" />
      ) : (
        <p className="rounded-[14px] rounded-bl-[4px] bg-kraft-soft px-4 py-3 text-[15px]">{message}</p>
      )}

      {reminder.approved_at ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="ink" size="tap" onClick={async () => { await navigator.clipboard.writeText(message); toast.success("Copied. Paste it wherever your group chats."); }}><Copy /> Copy</Button>
          <Button asChild variant="quiet" size="tap"><a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button>
          <Button asChild variant="quiet" size="tap"><a href={`mailto:?subject=${encodeURIComponent("Quick one about the group gift")}&body=${encodeURIComponent(message)}`}><Mail /> Email</a></Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ink"
            size="tap"
            disabled={busy || text.trim().length < 5}
            onClick={async () => {
              setBusy(true);
              try { await approveReminder({ data: { slug, adminToken, reminderId: reminder.id, text: text.trim() } }); onDone(); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't approve it. Try again."); }
              finally { setBusy(false); }
            }}
          >
            {busy ? "Approving..." : "Approve"}
          </Button>
          {!editing && <Button variant="quiet" size="tap" onClick={() => setEditing(true)}><Pencil /> Edit</Button>}
        </div>
      )}
    </section>
  );
}
