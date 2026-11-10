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
