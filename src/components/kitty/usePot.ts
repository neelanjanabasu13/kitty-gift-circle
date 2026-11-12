import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPot, warmPicks } from "@/lib/kitty.functions";

export const potQuery = (slug: string, adminToken?: string) =>
  queryOptions({
    queryKey: ["pot", slug, adminToken ?? null],
    queryFn: () => getPot({ data: { slug, adminToken } }),
  });

/** Live pot: subscribes to the pot's data-free realtime doorbell and refetches on every change. */
export function useLivePot(slug: string, adminToken?: string) {
  const q = useSuspenseQuery(potQuery(slug, adminToken));
  const qc = useQueryClient();
  const potId = q.data?.pot.id;
  useEffect(() => {
    if (!potId) return;
    const channel = supabase
      .channel(`pot-${potId}`)
      .on("broadcast", { event: "changed" }, () => {
        qc.invalidateQueries({ queryKey: ["pot", slug] }, { cancelRefetch: false });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [potId, slug, qc]);
  usePolling(slug, q.data);
  useFirstIdeas(slug, q.data);
  return q;
}

const ACTED_EVENT = "kitty:pot-acted";
const actedAt = new Map<string, number>();
/** Call after the user acts on a pot (chip-in, vote, withdraw): polling speeds up to 2.5s for 60s. */
export function markPotActed(slug: string) {
  actedAt.set(slug, Date.now());
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(ACTED_EVENT, { detail: slug }));
}

/**
 * Backup polling beside realtime: 10s from load; 2.5s for 60s after the user acts on this page,
 * or while a Kitty run is in flight for this pot. Paused while the tab is hidden.
 */
function usePolling(slug: string, data: any) {
  const qc = useQueryClient();
  const working = !!data?.pot?.agent_working;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const interval = () => (working || Date.now() - (actedAt.get(slug) ?? 0) < 60_000 ? 2_500 : 10_000);
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      qc.invalidateQueries({ queryKey: ["pot", slug] }, { cancelRefetch: false });
      timer = setTimeout(tick, interval());
    };
    const reschedule = () => { clearTimeout(timer); if (document.visibilityState === "visible") timer = setTimeout(tick, interval()); };
    const resume = () => { clearTimeout(timer); if (document.visibilityState === "visible") tick(); };
    const onActed = (e: Event) => { if ((e as CustomEvent).detail === slug) reschedule(); };
    timer = setTimeout(tick, interval());
    document.addEventListener("visibilitychange", resume);
    window.addEventListener(ACTED_EVENT, onActed);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener(ACTED_EVENT, onActed);
    };
  }, [slug, working, qc]);
}

const warmed = new Set<string>();
/** A brand-new pot with no gift ideas yet asks Kitty once for first ideas at the target budget. */
function useFirstIdeas(slug: string, data: any) {
  const qc = useQueryClient();
  const empty = !!data && data.pot?.status === "collecting" && data.pot?.mode !== "fixed_split" && !data.pot?.is_demo && !(data.candidates?.length) && !!data.config?.shop;
  useEffect(() => {
    if (!empty || warmed.has(slug)) return;
    warmed.add(slug);
    markPotActed(slug);
    void warmPicks({ data: { slug } }).then(() => qc.invalidateQueries({ queryKey: ["pot", slug] }), () => warmed.delete(slug));
  }, [empty, slug, qc]);
}
