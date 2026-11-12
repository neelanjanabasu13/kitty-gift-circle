import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPot } from "@/lib/kitty.functions";

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
  return q;
}

/**
 * Backup polling beside realtime: every 3s while Kitty is working or within 60s of a change,
 * 10s for the next few minutes, then 30s when idle. Paused while the tab is hidden; resumes on focus.
 */
function usePolling(slug: string, data: any) {
  const qc = useQueryClient();
  const lastChange = useRef(Date.now());
  const sig = data ? JSON.stringify([data.pot?.status, data.raised, data.people, data.pot?.agent_working, data.events?.length]) : "";
  const working = !!data?.pot?.agent_working;
  useEffect(() => { lastChange.current = Date.now(); }, [sig]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const interval = () => {
      const since = Date.now() - lastChange.current;
      return working || since < 60_000 ? 3_000 : since < 5 * 60_000 ? 10_000 : 30_000;
    };
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      qc.invalidateQueries({ queryKey: ["pot", slug] }, { cancelRefetch: false });
      timer = setTimeout(tick, interval());
    };
    const resume = () => {
      if (document.visibilityState !== "visible") { clearTimeout(timer); return; }
      clearTimeout(timer);
      tick();
    };
    timer = setTimeout(tick, interval());
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [slug, working, qc]);
}
