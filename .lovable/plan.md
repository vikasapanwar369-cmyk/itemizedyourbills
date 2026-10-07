# BillSnap: find out whether this is worth building further

## The honest read

You asked for a straight answer, so here it is.

**As a paid "track your household spending" app, the odds are bad.** Not because you built it badly, but because of the category:

- Budgeting apps lose about **67% of users within 30 days**, and "too much manual effort" is the second most common reason people cancel (26%). Photographing every bill is still manual effort. ([strategia-x](https://www.strategia-x.com/blog/2026-04-12-why-budgeting-apps-fail-30-days-fintech-ux-data/), [retentioncheck](https://retentioncheck.com/churn-benchmarks/budgeting-apps))
- Average monthly churn for budgeting apps is **7.9%** — that's about 62% gone in a year. ([retentioncheck](https://retentioncheck.com/churn-benchmarks/budgeting-apps))
- **Mint shut down with 25 million accounts** because it earned only $2-3 per user a year. ([Sacra](https://sacra.com/research/why-mint-failed/))
- In India/South-East Asia, revenue per install at day 60 is **$0.11** against **$0.55** in North America. ([PricePush, RevenueCat data](https://pricepush.app/blog/revenuecat-sosa-2026-pricing-localization-insights))
- The median subscription app earns **$492 a month**, while the top 10% of apps capture 94.5% of all revenue. ([Igniscor](https://www.igniscor.com/post/state-of-app-monetization-2026))
- In India specifically, **Account Aggregator** apps (Fold, Jupiter, Walnut) already track spending automatically with zero user effort — a free app that asks you to photograph bills is competing against "does nothing at all". ([Fold](https://fold.money/))

**But the thing you built — item-level receipt data — is valuable to someone.** It's just not valuable to the person scanning it.

- **Fetch** and **Ibotta** built real businesses on receipts and charge consumers almost nothing. Ibotta reported **$342M revenue in 2025** and now sells a rewards network to Walmart and DoorDash. ([SEC filing](https://www.sec.gov/Archives/edgar/data/1538379/000162828026011669/earningsrelease123125.htm), [AdExchanger](https://www.adexchanger.com/the-sell-sider/ibotta-ceo-bryan-leach-on-transitioning-from-a-cash-back-app-to-cash-everywhere-retail-media/))
- In India, **Magicpin** (10M+ downloads) pays people to upload bills, and **NIQ** runs paid household receipt panels. Consumers get paid; brands pay. ([Magicpin](https://magicpin.in/), [NIQ India panel](https://panel.nielseniq.com/global/en/panel/india-ep3/))
- Solo web-only finance apps *can* work: **Lunch Money** reached $34k a month with no staff, and **ProjectionLab** reached $1M a year. ([story](https://startupfounderstories.com/stories/jen-yip-lunch-money-solo-female-founder), [story](https://small-start.com/en/cases/global-projectionlab-1m-arr/))

**Where it sells.** A bill scanner is *redundant* where bank feeds work (UK, EU, Australia, Brazil) and *necessary* where they don't. The strongest case is **Vietnam** (roughly 70%+ of transactions still cash, no bank-feed aggregators — [VNExpress](https://e.vnexpress.net/news/business/money/what-living-in-vietnam-taught-foreigners-about-saving-and-spending-4923760.html)), then the **Philippines** (GCash-native, bank-poor) and **Gulf expat households** (higher willingness to pay, paper bills still normal, reachable from India). I'd treat that ranking as reasoned inference, not proven fact — the hardest evidence is the cash-vs-bank-feed logic, not country-level sales data.

**My recommendation:** don't pick a country yet. You have 6 accounts (all yours), 8 bills and **zero visitors in 30 days**. Spend two weeks and about ₹600 finding out whether *anyone* keeps using it, then decide. That test is below.

## What I'd do, in order

### 1. Buy a domain (this week, about ₹500-700 a year)
You're on a free `lovable.app` subdomain. It's the first thing to fix and it blocks several things at once: no professional email can be sent (email providers require a domain you control), no Grievance Officer address that a regulator would accept, no trust when asking strangers to scan family bills, and effectively no Google visibility. I can start the buy-or-connect flow whenever you say go.

### 2. Make support real, and fix one legal problem (this week)
Your privacy page currently lists `grievance@billsnap.app` — **an address I invented**, which does not exist. India's DPDP Act expects a named grievance officer with a working contact, acknowledged within 48 hours and resolved within 7. ([requirements](https://compliseal.cogenz.in/blog/dpdp-grievance-officer-india)) Sending me your real name and address, I'll put it in everywhere.

Support you can run for **₹0 a month**, and at your size that's genuinely enough:
- **Zoho Desk free** (3 agents, email tickets, help centre) or **tawk.to** (free unlimited chat widget) — both work on your current subdomain today. ([comparison](https://dupple.com/learn/best-free-help-desk-software))
- A **WhatsApp link** on the help screen — free, and the channel Indian users actually prefer.
- Your existing in-app ticket form becomes the front door; it already has topics, staff replies and open/closed status.
- An honest promise in the UI: *"We're a two-person-of-one team. Acknowledged within 1 business day."*

Load to expect: about 2-5 tickets a month at 100 users, 20-50 at 1,000, and 200-500 at 10,000 (roughly 1-2 hours a day). You're nowhere near that yet, so one shared inbox is correct.

### 3. Test the one hook that might be worth paying for (two weeks)
Dashboards show the past. **Refill predictions get opened before you spend** — "your detergent is due in 2 days". That's the only thing in your app with a reason to be opened twice a week, and it's what your competitor research says is the missing hook.

So test that, not "expense tracking":
- I'll reposition the landing page around never running out and never overpaying, and put your personal inflation index front and centre — that's the genuinely unusual, shareable feature.
- You message **30-50 real people directly** (you said you're happy to do this). I'll write the message and pick who fits: anyone in your life who does the household grocery shopping.
- Success bar, agreed in advance: **at least 5 people scan two bills, and at least 2 come back on their own within 7 days.** If you hit it, we build payments. If you don't, you've spent ₹600 and two weeks, and you'll know.

### 4. Then decide with numbers
If the test works, the next question is *what to charge for*. A ₹99-149 a month refill-and-shopping assistant is a different product from a free expense tracker, and needs different screens. If it doesn't, the itemised data you're collecting is the asset — the honest options are a small paid household panel or a Gulf/market-specific version, and I'd tell you that plainly rather than dress up a failed test.

## One thing to know about payments
When you do charge: **Stripe India is invite-only**, and merchant-of-record tools like Paddle or Lemon Squeezy break the FIRC chain, which costs an Indian exporter roughly 18% in lost GST zero-rating. **Razorpay International** auto-generates eFIRC and is the better fit for an Indian individual. ([Razorpay guide](https://razorpay.com/blog/merchant-of-record-vs-payment-gateway-india/), [comparison](https://www.sprintzeal.com/blog/stripe-alternatives-indian-saas-global-payments))

## Technical details

**Phase 1 — domain (needs your approval to buy)**
- `domain_connect` / `domain_status` flow to buy or connect a domain; DNS and SSL verification; repoint published URL.

**Phase 2 — support and DPDP baseline**
- Replace the placeholder `grievance@billsnap.app` in `src/routes/privacy.tsx` with the real name and address you supply; add the officer's name to the footer and the Privacy Centre.
- Add a `NOTICE_VERSION`-stamped grievance acknowledgement record so the 48-hour clock is provable.
- Wire the existing `support_tickets` table to a real inbox: forward new tickets to your Zoho Desk / shared-inbox address, and show the real reply-to address on `src/routes/_authenticated/support.tsx`.
- Add a WhatsApp link and an honest response-time line to the support screen; add topic-based routing (billing → primary inbox, feature request → list).
- Optional: free status page (Chirp / StatusForge) linked from the footer.

**Phase 3 — landing reposition and instrumentation**
- Rewrite `src/routes/index.tsx` hero and feature order around refill/shopping-list utility and the personal inflation index; item-level extraction becomes proof, not the headline.
- Add the UTM-bearing landing link you'll share, plus a "where did you hear about us" one-tap question at signup so the 30-50 messages are measurable.
- Confirm analytics records the scan-two-bills and return-within-7-days events; if they aren't derivable, add the minimum events so the test can be scored rather than guessed.
- Draft the outreach message and the shortlist of who to send it to, for your approval before anything is sent.

**Sources are cited inline above.** Where a number comes from a secondary blog rather than a filing, I've linked it so you can judge it yourself; the Ibotta figure comes from an SEC filing and the Fetch user counts came from a low-quality source, so I'd verify Fetch before repeating it.
