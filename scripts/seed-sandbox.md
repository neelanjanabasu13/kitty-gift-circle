# Making the demo pot's holds real (PayPal sandbox)

The demo pot (start it from `/health`, "Start the demo pot") is seeded with 9 contributions marked
`is_seeded = true`. They have no PayPal authorization, so the app labels them
"demo hold, not a real PayPal hold" and the closing code never sends them to PayPal: capture, void,
reauthorise and hold checks all skip them, and a pot containing any demo money records a `demo`
payout instead of paying the organiser.

A seeded row only counts as real money once it carries a real sandbox `authorization_id`. To get
real sandbox holds, add real contributions alongside (or instead of) the seeds:

1. In the PayPal developer dashboard, create a few **sandbox personal (buyer)** accounts.
2. Open the demo pot's contributor link `/k/<slug>` in a browser.
3. Pick an amount, then approve the PayPal popup while signed in as one sandbox buyer.
   The app creates an AUTHORIZE order, authorises it and stores the real `authorization_id`.
4. Repeat per buyer. A browser script can automate this, for example with Playwright:
   - open `/k/<slug>`, tap an amount chip, click the PayPal button,
   - in the popup fill the sandbox buyer email and password (read them from environment
     variables, never hard-code them) and approve,
   - wait for "held, not charged" on the page.
5. Run "Reset demo pot" from the manage page overflow menu to start over. It voids every real
   sandbox hold (and refunds any real capture) before wiping the pot and seeding it again.

Demo speed runs the pot clock at 60x, so the 1 hour vote takes 1 minute, the 2 hour veto countdown
takes 2 minutes and the 2 day deadline takes 48 minutes (the reminder nudge is drafted at 24).
