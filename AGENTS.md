<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Kitty architecture
- All pot reads/writes go through server functions in `src/lib/kitty.functions.ts` using the admin client; tables have RLS on with no anon policies, because there are no user accounts and visibility rules (hidden names/amounts) must be enforced server-side.
- Organiser actions are authorised by the pot's `admin_token`; contributor withdraw is authorised by the PayPal order id kept in the contributor's localStorage.
- Realtime is a data-free broadcast doorbell (`pot-<id>` topic, DB triggers) and clients refetch via `getPot`, so no table rows are exposed to the browser.
- PayPal calls hit the sandbox REST API directly from `src/lib/paypal.server.ts` with the user's own PAYPAL_CLIENT_ID/SECRET (not the connector gateway), as the user specified.
- The app currency is set in one place: `DEFAULT_CURRENCY` in `src/lib/config.ts`.
- Gift agent: `src/lib/agent.server.ts` orchestrates (plan, search, clean, score, rank, store) and narrates to agent_events; all money and ranking rules are pure code in `src/lib/scoring.ts` (unit-tested), and AI (`src/lib/ai.server.ts`) only plans queries, scores fit and writes reasons, so ranking stays deterministic and auditable.
- Agent runs are triggered by awaited server functions (`triggerAgent` from the contributor page, `runKittyNow`, `updatePotProfile`) rather than background work, because the Worker runtime may drop un-awaited work; a per-pot lock (`pots.agent_lock_at` + `agent_pending`) stops concurrent triggers double-searching.
- Shop search is Channel3 via `src/lib/channel3.server.ts`; a missing CHANNEL3_API_KEY returns `not_configured` and the agent posts one explanatory event instead of failing.
- Closing is a state machine in `src/lib/closing.server.ts` (`tickPot`), locked per pot by `pots.tick_lock_at` and advanced only via conditional status updates, so page-load ticks, the per-minute cron route `/api/public/jobs/tick-pots` and organiser actions can overlap safely; all closing money maths (largest-remainder pro-rata split and refunds, vote close, winner, refunds, hold actions) is pure code in `src/lib/closing.ts` with tests.
- Captures are planned once into `contributions.planned_capture` and every PayPal money call uses a deterministic PayPal-Request-Id (cap-/void-/ref-/reauth- + id, payout batch pot-<id>), so replays never double-charge.
- The mascot lives in `src/components/kitty/KittyMascot.tsx` as inline SVG + motion/react; `mascotStateFor` maps pot status, latest agent_event kind and in-flight work to its state, so every surface derives the pose from real data.
- Demo time is compressed only through the clock helpers in `src/lib/closing.ts` (`scaleMs`, `effectiveDeadline`, `voteDurationMs`, `vetoMs`); `getPot` returns the effective deadline, so tick, vote close, veto and countdown UI all share one clock.
- Seeded demo contributions (`is_seeded` with no `authorization_id`) are detected by `isDemoHold` and never sent to PayPal; a pot with any demo money records a `demo` payout instead of paying out, so demo money is never presented as real.
- Fixed-split pots store the organiser's chosen product as the single ranked candidate; the agent skips search and the closer goes straight to veto once the pot covers its price.
