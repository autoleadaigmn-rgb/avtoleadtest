# AutoLead AI — auto repair receptionist template

Working demo: https://autoleadaigmn-rgb.github.io/avtoleadtest/

This is a configurable, rules-based web receptionist. It is not generative AI, a phone answering service, a diagnostic tool or a live booking system. Real customer-data collection is disabled. The fictional Bayline Auto Care demonstration uses only synthetic fixture values.

## Try the product

Ask about shop services/hours, or enter several details together. Example:

> I'm Alex Demo, alex@example.com. My 2019 Toyota Camry brakes squeal when stopping. No preference.

The chat extracts the known fields and asks only for missing ones. Use “change time to No preference”, “change contact”, “Edit details” or “Cancel”. Nothing is sent until the separate consent checkbox and send button are used. A request is not an appointment confirmation.

## Protected owner workspace

Use the Owner dashboard link on the site, signed into the verified owner’s Google account. The owner deployment must run as the user accessing the app, with access restricted to that owner. If Google’s multi-account error occurs, use an incognito window with only the owner account signed in.

The dashboard reads the private Google Sheet, searches name/contact/vehicle/concern, filters statuses and persists New, Contacted, Scheduled or Closed. Scheduled is an internal workflow label; it sends no customer message and creates no calendar booking. Local preview on the public site is a separate browser copy, not the server inbox.

Under Shop branding and information, edit name, HTTPS logo URL, colors, public contacts, hours, services and greeting. These settings are saved server-side and fetched by the public website on reload. The notification recipient is not a public setting: it is the verified Google owner stored in Script Properties. Public request data cannot redirect email or choose a Sheet.

## Provision another shop

Reuse the template but provision a separate Apps Script project and private request Sheet under each client’s verified Google owner. This is isolated deployment per client, not a shared multi-tenant SaaS.

1. Copy the complete `backend/Code.gs` (or `backend/Deployed.gs` in the modular source archive) into that client’s Apps Script project. It includes the owner HTML.
2. Authorize and run `setupDemoRequests` as that Google owner. It stores OWNER_EMAIL and REQUESTS_SHEET_ID privately and creates the separate request Sheet. Do not share that Sheet publicly.
3. Deploy the intake as the owner, accessible to visitors. Its fixed test-data gate must remain active.
4. Create a separate owner-only deployment, executing as the accessing user. Use its URL with `?owner=1` for the dashboard. Every owner RPC also checks the exact active Google email.
5. Configure the shop in the owner dashboard. Point the template’s public endpoint and dashboard addresses to these deployments. Never add tokens, private Sheet IDs or credentials to GitHub.
6. Verify a synthetic request, receipt, private row, owner email and cross-account denial. Keep production collection disabled until the client approves security, consent, privacy, retention and stronger abuse protection.

## Test boundaries and recovery

Only Alex Demo, alex@example.com, 2019 Toyota Camry, configured services, supported fictional concerns and sample times are accepted. New tests have a global 15-second cooldown and a three-record UTC daily cap. Identical fields within 24 hours or an identical request ID return the existing receipt without another email. The default detailed sample can be repeated safely.

The client waits for a readable JSON receipt. Timeouts remain unconfirmed and retries reuse the request ID. Sheet values are protected against formula interpretation. Notifications are only sent to the owner. A failed notification is flagged for review and is not automatically resent.

Google-account authorization is checked before any owner Sheet read, write or settings operation. Status updates reject stale expected values. The public GET exposes only presentation configuration; it never lists requests. Basic timing/honeypot/rate controls are not robust denial-of-service protection or a production spam solution.

Remove synthetic rows and notification emails manually within seven days after review. Local deletion does not remove server records. `disableDemoIntake` pauses future acceptance and retains data. Commercial prospecting CRM and draft creation remain separate and unchanged.

