import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Scheduled tick: advances every open kitty (close, vote, veto, buy). Each tick is locked per pot and idempotent.
export const Route = createFileRoute("/api/public/jobs/tick-pots")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { duePots, tickPot } = await import("@/lib/closing.server");
        const ids = await duePots();
        let ticked = 0;
        for (const id of ids) {
          await tickPot(id);
          ticked++;
        }
        return Response.json({ success: true, ticked });
      },
    },
  },
});
