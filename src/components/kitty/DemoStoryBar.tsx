import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { advanceDemo, resetDemoPot } from "@/lib/kitty.functions";
import { DEMO_CAST, demoStage, type DemoStage } from "@/lib/demoScript";

const STEPS: { stage: DemoStage; label: string }[] = [
  { stage: "chipping", label: "People chip in" },
  { stage: "closing", label: "Kitty picks the shortlist" },
  { stage: "voting", label: "The group votes" },
  { stage: "countdown", label: "Last-chance countdown" },
  { stage: "buying", label: "Buying, with the surplus released" },
  { stage: "done", label: "Receipt and card" },
];

/** Drives the guided demo story on the manage page: polls the next beat, with pause, skip and replay. */
export function DemoStoryBar({ slug, adminToken, status, chipped }: { slug: string; adminToken: string; status: string; chipped: number }) {
  const qc = useQueryClient();
  const [paused, setPaused] = useState(false);
  const [err, setErr] = useState(false);
  const busy = useRef(0);
  const stage = demoStage(status, chipped);
  const idx = Math.max(0, STEPS.findIndex((s) => s.stage === stage));
  const finished = stage === "done" || stage === "cancelled";

  const step = async (skip = false) => {
    // Keep the page fresh even while a long step (a shop search, the final buy) is still running.
    qc.invalidateQueries({ queryKey: ["pot", slug] });
    if (busy.current && Date.now() - busy.current < 90_000) return;
    busy.current = Date.now();
    try {
      await advanceDemo({ data: { slug, adminToken, skip } });
      setErr(false);
    } catch { setErr(true); } finally {
      busy.current = 0;
      qc.invalidateQueries({ queryKey: ["pot", slug] });
    }
  };

  useEffect(() => {
    if (paused || finished) return;
    void step();
    const t = setInterval(() => void step(), 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, finished, slug, adminToken]);

  const replay = async () => {
    await resetDemoPot({ data: { slug, adminToken } });
    setPaused(false);
    qc.invalidateQueries({ queryKey: ["pot", slug] });
  };

  return (
    <section aria-label="Demo story" className="surface p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite">
          <p className="text-[13px] text-muted-foreground">Demo story, step {idx + 1} of {STEPS.length}</p>
          <p className="text-[17px] font-medium">
            {STEPS[idx]!.label}
            {stage === "chipping" && <span className="text-muted-foreground tabular"> ({chipped} of {DEMO_CAST.length})</span>}
          </p>
          {err && <p className="text-[13px] text-muted-foreground">That step stumbled. I'll try again in a moment.</p>}
        </div>
        <div className="flex gap-2">
          {finished ? (
            <Button variant="ink" size="tap" onClick={replay}><RotateCcw /> Play it again</Button>
          ) : (
            <>
              <Button variant="quiet" size="tap" onClick={() => setPaused((p) => !p)}>{paused ? <><Play /> Resume</> : <><Pause /> Pause</>}</Button>
              <Button variant="outline" size="tap" onClick={() => step(true)}><SkipForward /> Skip to next step</Button>
            </>
          )}
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-6 gap-1.5" aria-hidden>
        {STEPS.map((s, i) => <li key={s.stage} className={`h-1.5 rounded-full ${i <= idx ? "bg-held" : "bg-muted"}`} />)}
      </ol>
    </section>
  );
}
