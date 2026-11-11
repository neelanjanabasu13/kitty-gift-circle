# Live demo that actually plays, start to finish

## What's wrong now
The demo button waits for Kitty's whole shop search to finish before it opens anything, so on a slow search the page just sits on "Kitty is shopping for Priya..." and looks broken. Even when it does open, judges land on a manage page with nine pretend chip-ins and then have to wait 48 minutes for anything else to happen, so the real story (people suggesting likes, some skipping, a vote, the surplus coming back) is never shown.

## What judges will see instead
One tap on "Watch Kitty live with a demo pot" opens Priya's pot within a second or two, and a guided story then plays by itself in about three minutes, with a small "Demo story" bar at the top showing which step is happening, a Pause button and a "Skip to next step" button.

1. **Setup.** Alex sets up the kitty for Priya, £120 target, vote window on.
2. **People chip in, one by one, every few seconds.** Each person's arrival lands in the feed and the meter fills:
   - Jo chips in £20 and suggests "she's into pottery", Kitty notes it.
   - Sam chips in £15, skips the "what does she like" question.
   - Ravi chips in £25, suggests "loves good coffee", hides his amount.
   - Mei chips in anonymously, no message.
   - a few more, some signing the card, some not.
3. **Kitty searches and reshuffles** as the pot crosses £50 and £100 (real shop search, picks fade in).
4. **Pot closes and the vote opens.** 6 of 9 people vote, 3 don't; the feed says who voted and the why-line reads "6 of 9 chipped-in people voted, and they picked it."
5. **Countdown.** "Here's exactly what Kitty will buy" card with the short veto countdown.
6. **Buying, with a surplus.** The winning gift costs less than the £130 raised, so everyone pays their share and gets the rest released in the same proportion they put in (for example Jo held £20, pays £18.46, £1.54 released), shown per person, adding up exactly.
7. **Receipt and card.** Ends on the receipt with every person's held / paid / released line and the signed card. A "Play it again" button restarts.

No real money moves: every chip-in stays labelled "demo hold", as today.

## Also fixed
- The button no longer waits for the search; if anything fails it shows a plain message and a Try again button rather than spinning forever.
- If the shop search is slow or unavailable, the demo uses a ready-made set of picks so the story never stalls.

## Technical details
- `seedDemoPot` returns immediately after inserting the pot and events; the first agent run moves to the manage page (awaited `triggerAgent`-style call fired after navigation), keeping the no-background-work rule.
- New `advanceDemo(slug, adminToken)` server function: a pure step script in `src/lib/demoScript.ts` (chip-ins with likes/skip/hidden/anonymous, card messages, category votes, final votes for a subset, forced close). Each call applies the next due step idempotently (`pots.demo_step`, `demo_step_at` columns) and calls existing tick/agent code, so vote close, veto, pro-rata capture and receipt use the real closing logic unchanged.
- Manage page polls `advanceDemo` every few seconds while `is_demo`; `DemoStoryBar` component shows step, pause, skip.
- Demo uses a tight clock for this story only (vote ~20s, veto ~20s) via the existing clock helpers.
- Target winning price below raised total so the surplus path runs; tests in `closing.test.ts` / new `demoScript.test.ts` assert the script's voters (6 of 9), the per-person paid/released amounts summing exactly to price, and proportional refunds.
- Fallback picks: when Channel3 returns nothing within the time limit, the demo inserts three stored candidates.
