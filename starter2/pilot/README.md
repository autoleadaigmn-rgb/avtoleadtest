# Starter pilot candidate — live intake disabled by default

This folder is a separate candidate for one real shop per Worker and one D1 database per shop. It does not alter the existing `autolead-starter2-test` Worker, Google Sheets CRM, Gmail drafts, GitHub Pages, or test D1 databases. The original `wrangler.example.jsonc` remains disabled by default. Two separate fictional Workers were deployed in `PILOT_TEST` mode on 2026-10-23; this mode accepts only the fixed `example.com` identities in `fixture.js`, uses the official Turnstile test keys, and simulates email. See [CLOUD-TEST-REPORT.md](CLOUD-TEST-REPORT.md) for their exact status. Real-data intake still requires `MODE=PILOT`, `TEST_ONLY=false`, `MAIL_TRANSPORT=RESEND`, `REAL_DATA_APPROVED=true`, and `PRIVACY_REVIEWED=true`, plus a separately approved client setup.

## Prepared behavior

- The iframe assistant serves configured services and hours, and collects name, email or phone, vehicle, concern, and an unambiguous preferred local date/time. It states that a request is **not** an appointment. It is rule-based, not a generative AI assistant. Install with one line after activation: `<script async src="https://APPROVED-SHOP-WORKER.workers.dev/embed.js"></script>`.
- An unchecked consent box and a shop-hosted privacy link precede submission. The server validates every field and the policy version, restricts size, rejects extra fields/HTML/control characters, checks a signed short-lived session, honeypot, per-session and per-IP rate limits, and verifies Cloudflare Turnstile through Siteverify, including hostname/action/shop data. A per-shop accepted-request cap (`dailyRequestLimit`, 20/day in the fictional examples) protects the shared free email quota; approve a real shop's cap with its owner. The site-origin frame policy limits supported browser embedding; it is not authentication by itself.
- D1 writes a request and immutable notification snapshot in the same transaction using a trigger. A UUID is an idempotency key for request retries. The Resend adapter uses the same per-request idempotency key and frozen recipient/body on every attempt. Automatic retries stop before Resend's 24-hour idempotency window expires; uncertain older jobs become `RECONCILE_MANUALLY` instead of risking a duplicate. Dead jobs are visible in the private owner inbox.
- A separate Google Web client ID and an exact, server-secret Google `sub` authorize the one shop's inbox. The Worker validates Google signature, issuer, audience and expiry on every owner request. The owner can search, filter, change status and delete. No owner data is in public config.
- The scheduled task deletes expired requests, outbox entries and rate buckets every 15 minutes. The configured retention is 1–90 days. Manual deletion leaves a tombstone preventing replay.

## Local verification

From `starter2`, run `pnpm test`. It bundles this Worker and runs the pilot suite with local D1, fake Google signing keys, fake Turnstile and fake email transport. No real contact data or real email is sent. A shop profile can be checked offline with:

`node pilot/configure.mjs pilot/profiles/bayline.example.json`

This writes an ignored **disabled** `pilot/wrangler.local-bayline-pilot.jsonc` with a placeholder D1 UUID; it does not create cloud resources. The example shops and addresses are fictional. Edit a copy of the public profile for the real shop only after approval. Keep the owner's receiving email and verified Google `sub` out of the profile and Git.

## First-shop connection sequence

1. Obtain written approval for real customer data and transactional email. Identify the shop's legal/business name, exact HTTPS site origin, services, hours, IANA time zone, brand assets, public contact information and owner Google account. Agree on the retention period (30 days suggested), support contact, deletion requests, and incident response. Confirm that the shop's privacy notice is live at the exact configured URL and identifies the shop, AutoLead, Cloudflare, Resend and Turnstile with their roles.
2. Use one verified sender domain for AutoLead in a Resend Free account. Verify DNS and sender address; keep the API key only as a Worker secret. Confirm the owner recipient address with the owner. Create a Turnstile widget for the exact Worker hostname and keep its secret server-side. Create/verify a Google Web OAuth client for that exact origin and obtain the owner's verified Google `sub` through a signed login, not from an email string or URL query.
3. Confirm that a D1 Free slot remains. Create **one new** D1 database for this shop only after approval; apply `pilot/migrations/0001_initial.sql`. Generate the shop-specific disabled Wrangler config using its actual D1 UUID. Set `OWNER_EMAIL`, `OWNER_SUB`, `SESSION_SECRET`, `TURNSTILE_SECRET`, and `RESEND_API_KEY` with `wrangler secret put NAME --config pilot/wrangler.local-SHOP.jsonc`, one at a time. Put the verified sender in a secret named `RESEND_FROM`. Never store these values in Git, shell history, screenshots, or a public `vars` map.
4. Deploy the **disabled** Worker to a separate `workers.dev` URL, with `workers_dev=true` only for this approved pilot. Verify `/health` returns `enabled:false`; test the widget layout with fictional data. Then explicitly approve activation and change the five safety values to `MODE=PILOT`, `TEST_ONLY=false`, `MAIL_TRANSPORT=RESEND`, `REAL_DATA_APPROVED=true`, `PRIVACY_REVIEWED=true`. Publish only this separate Worker. Do not change the test Worker or `main`.
5. Test with fictional `example.com` and `555` data first: real Turnstile token, D1 insert, owner inbox, one received notification, duplicate retry, owner status, deletion, and mobile layout. Check Worker CPU and errors plus D1 row usage and Resend quota. Only then allow a real visitor submission. Keep a human contact fallback on the shop site.
6. Install the one-line script on the shop's site. If the site has CSP, allow the Worker origin in `script-src` and `frame-src`. Verify the parent origin matches `siteOrigin`; test desktop and phone. Give the owner the private inbox URL and deletion procedure. Review pending/dead notification counts daily during the pilot.

## Stop and rollback

For immediate intake pause, set `REAL_DATA_APPROVED=false` (or `MODE=TEST_ONLY`) in this shop's config and deploy. The API then returns `PILOT_DISABLED`; existing D1 records are not deleted. Remove the one-line script from the shop site if needed. Preserve the D1 database for its approved retention period; do not erase it as part of a code rollback. Disable email sending by setting `MAIL_TRANSPORT=SIMULATED` and deploy; this also disables intake. Investigate queued or dead notifications before resuming. A restore from D1 Time Travel can resurrect deleted records: export the deletion ledger before any restore and replay tombstones afterward. A tested automated restore-and-replay tool is **not yet present**; do not restore live personal data until this is addressed.

## Privacy and operating requirements before activation

The shop's notice needs to state the collected fields, purpose, consent, third-party processors, access controls, storage locations, retention and deletion timing, email copies, response contact, and that the requested appointment is not confirmed. A deletion from D1 does not itself erase an already delivered email from the owner's mailbox or provider retention. D1 Free Time Travel retains recoverable history for up to seven days; the Resend Free plan advertises 30-day data retention. Define a procedure for deleting provider and mailbox copies where available. Obtain a privacy/legal review for the jurisdictions served; code validation alone is not a policy.

Before a paying customer uses it, complete a live canary with a verified sender, Turnstile, Google owner access and real provider delivery; measure the Workers Free 10 ms CPU limit; test outage reconciliation and restore/deletion behavior; add operational monitoring for dead outbox jobs. Do not represent the local mock tests as hosted or production tests.

## Official limits used for planning

- [Workers Free pricing](https://developers.cloudflare.com/workers/platform/pricing/): 100,000 requests/day; [Free limits](https://developers.cloudflare.com/workers/platform/limits/): 10 ms CPU/invocation.
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/): 10 databases/account on Free, 500 MB/database, seven-day Time Travel; [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): 5 million rows read/day, 100,000 rows written/day and 5 GB total storage on Free.
- [Resend pricing](https://resend.com/pricing): Free 3,000 emails/month, 100/day, three domains; Pro $20/month for 50,000/month. [Idempotency keys](https://resend.com/changelog/idempotency-keys) are retained for 24 hours.
- [Turnstile Free](https://developers.cloudflare.com/turnstile/plans/) offers up to 20 widgets; [server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) is required.
- [FTC data-minimization guidance](https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business-0).
