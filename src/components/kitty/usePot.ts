import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";
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
  return q;
}
