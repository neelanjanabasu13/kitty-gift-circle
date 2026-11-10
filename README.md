# Kitty

**The group gift that knows the person and buys itself.**

One organiser sets up a pot once. Friends or colleagues chip in through one share link, with no accounts. Every contribution is a PayPal **hold**, not a charge. Kitty's agent finds real gifts that fit the person and the money raised, runs an optional vote, and buys on a veto countdown. Nobody is charged unless the gift happens, and if the pot ends up bigger than the gift, everyone gets their surplus back in proportion to what they put in.

Built for the PayPal AI Hackathon.

## The flow

1. **Set it up.** The organiser answers a short chat (who it's for, occasion, what they love and what to avoid, pot size, deadline, vote window, their PayPal email). Kitty creates a pot with a public share link and a private manage link.
2. **Everyone chips in.** Contributors open `/k/{slug}`, pick an amount, choose whether their name and amount are shown, optionally vote on a category and sign the card, then place a PayPal hold. It takes about 10 seconds.
3. **Kitty picks.** As the pot grows, the agent plans searches, finds real products through Channel3, drops anything that clashes with dislikes or the budget, scores fit with Lovable AI and ranks the picks in plain code. It narrates every step in a friendly activity feed.
4. **Close and vote.** When the target is reached or the deadline passes, Kitty runs one last search at the exact pot and opens an optional vote on the top 3.
5. **Veto countdown.** Kitty announces "Buying the X for £118 at 5pm unless you veto." The organiser can swap, veto or buy now. Doing nothing proceeds.
6. **Buy.** Kitty re-checks the offer and every hold, captures each contributor's fair share, releases the rest, and pays the organiser, who buys the gift through the shop link. A receipt and a card of every signature are shared.

## How PayPal is used (sandbox only)

All calls go to `https://api-m.sandbox.paypal.com` from server functions.

| Step | API | Notes |
| --- | --- | --- |
| Hold | Orders v2 `POST /v2/checkout/orders` with `intent: AUTHORIZE` | `custom_id` = contribution id, `PayPal-Request-Id` set |
| Confirm hold | `POST /v2/checkout/orders/{id}/authorize` | Stores authorization id, expiry and a 3 day honour period |
| Hold check | `GET /v2/payments/authorizations/{id}` | Before buying; lapsed holds leave the pot and Kitty re-ranks |
| Refresh | `POST /v2/payments/authorizations/{id}/reauthorize` | Past the honour period and within 29 days |
| Pay | `POST /v2/payments/authorizations/{id}/capture` | Pro-rata share, `final_capture: true`, `PayPal-Request-Id: cap-{contribution}` |
| Release | `POST /v2/payments/authorizations/{id}/void` | Withdraw, cancel, and unused holds, `void-{contribution}` |
| Refund | `POST /v2/payments/captures/{id}/refund` | Same proportions, `ref-{capture}-{reason}` |
| Payout | `POST /v1/payments/payouts` | `sender_batch_id: pot-{id}`, one item to the organiser |

Every money call carries a deterministic `PayPal-Request-Id`, captures are planned once and stored, and every state change is a conditional update, so a replayed tick never double-charges or double-pays. If Payouts isn't enabled on the account, Kitty marks the payout as a fallback: captured funds stay in Kitty's PayPal account and the receipt says it would pay out to the organiser in production.

## How Channel3 is used

- **Search** (`POST /v1/search`) with price filters between half the pot and the current authorised pot, in-stock only, and the market's country and currency (GB/GBP by default, switchable to US/USD in `src/lib/config.ts`).
- **Lookup by URL** fills in title, image, shop and price when the organiser already knows the gift.
- **Product refresh** before buying, to catch price rises or sold-out items.
- **Attribution:** every search sends `x-user-id` = pot id.
- **Commission disclosure:** "We may earn a commission when you buy through links on this page." appears near every pick list and buy link.

## How Lovable AI is used

Lovable AI only does the soft, human parts:

- planning 4 to 6 single-product searches from the profile and group votes,
- scoring how well each product fits (0 to 1) with a one-line reason that names a like,
- the why-line on the veto screen,
- drafting the reminder nudge for people who haven't chipped in.

**Plain code makes every money decision:** cleaning, ranking, budgets, vote close, winner, the pro-rata split, refunds and hold actions all live in tested pure functions (`src/lib/scoring.ts`, `src/lib/closing.ts`).

## Ranking

Hard rules first: anything matching a dislike is dropped, anything above the pot is dropped, suspiciously cheap offers are dropped, and a fit below 0.4 is never shown.

Then a weighted score:

| Signal | Weight |
| --- | --- |
| Fit (AI) | 35% |
| Category vote share (capped so votes can't lift a poor fit) | 20% |
| Pot fit (1.0 at 80 to 100% of the pot) | 20% |
| Wishlist match | 10% |
| Quality (rating damped by review count) | 10% |
| Offer reliability | 5% |

The top 3 must span at least 2 categories unless the votes are unanimous.

## The surplus rule

If the pot is bigger than the gift, everyone pays the same share of what they put in, and the rest of each hold is released and never charged.

Worked example: the pot reaches **£122** and the gift costs **£118**. Everyone pays 118 / 122, about 96.7%, of their hold. Someone who held £20 pays £19.34 and gets £0.66 released; someone who held £10 pays £9.67. Shares are worked out in pence with the largest-remainder method (floor every share, then hand leftover pennies to the largest remainders), so the captures add up to exactly £118.00. Any later refund uses the same proportions.

## Real vs seeded

| Thing | In the demo |
| --- | --- |
| A judge's own contribution | Real PayPal sandbox hold |
| Seeded contributions | Marked `is_seeded`, tagged "demo", never sent to PayPal unless they carry a real sandbox authorization |
| Gift picks | Live from Channel3 |
| Capture, void, refund and payout | Real sandbox calls (demo holds are skipped; a pot with demo money records a demo payout) |
| Buying from the shop | Done by the organiser through the buy link |
| Time | Real time, or demo speed (60x) shown with a "Demo speed" badge on every pot screen |

Start the demo pot from `/health`. See `scripts/seed-sandbox.md` for turning seeded holds into real sandbox holds.

## Secrets

Add these in the project's secrets settings (never in code):

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `CHANNEL3_API_KEY`

Without them the app stays calm: the contributor page says payments switch on soon, and the picks area says gift search switches on once the shop key is added. `/health` shows which are connected or missing.

## Run it locally

```sh
bun install
bun run dev
bunx vitest run
```

The app is TanStack Start (React 19, Vite) with Lovable Cloud for the database and realtime.

## Test accounts

- Sandbox buyer login: `TODO`
- Sandbox buyer password: `TODO`
- Test card: `TODO`

## Licence

MIT. See `LICENSE`.
