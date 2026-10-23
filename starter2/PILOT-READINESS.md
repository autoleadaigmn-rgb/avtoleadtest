# Starter $9/month: pilot readiness, 2026-10-23

Status: **code candidate prepared locally, commercial intake disabled.** The existing test Worker at https://autolead-starter2-test.autolead-ai-gmn.workers.dev remains `TEST_ONLY` with simulated notifications. GitHub Pages, `main`, CRM and Gmail drafts are unchanged. A separate, unpublished `pilot/` Worker is the proposed first-client candidate.

## Security audit and remaining blockers

The current live test rejects non-fixture contact data and cannot send email, which is appropriate for the demo. Google `sub` authorization and D1 isolation have been tested with fictional records; the owner confirmed live sign-in, status changes, logout and Cedar Ridge denial. These results do **not** establish that real-data intake, a real email provider, or a new shop's setup is production-ready.

The new pilot candidate has server validation, mandatory consent/version, Turnstile verification, short-lived signed sessions, rate limits including a configurable per-shop daily cap, per-shop D1, exact Google-sub owner check, atomic D1 request/outbox storage, Resend idempotency and bounded retries, owner-visible dead jobs, retention and deletion. Tests use only fictional values and provider mocks. It is gated by four independent settings and is not deployed.

Blocking before the first real contact:

1. An actual shop and authorized owner must provide its verified site origin, public profile, recipient email, Google account, retention choice and privacy notice. The shop must approve use of Cloudflare, Turnstile and Resend as processors and the final notice/consent text.
2. Resend Free account, verified sender domain, API key, real Turnstile keys and a shop-specific Google OAuth origin need to be configured. No account, key, DNS record, email or paid service has been created or activated in this work.
3. Create and migrate a new per-shop D1 database only after approval, ensure it fits the Free plan, and deploy the separate pilot Worker disabled first. The existing two test databases remain intact.
4. Run a live fictional-data canary from the installed client site through Turnstile → D1 → real email → owner inbox; verify delivery and duplicate handling. Mocked tests cannot prove provider acceptance or deliverability.
5. Confirm Workers Free CPU headroom and daily quotas with metrics. A 10 ms CPU ceiling can fail on cryptographic verification; no live pilot measurements exist.
6. Document/implement restore with deletion-ledger replay before restoring real data. D1 Free Time Travel can recover up to seven days of deleted data. Review provider and owner-mailbox retention/deletion. Add a human process for failed notifications and security incidents.
7. The pilot widget's scripted assistant currently offers configured services, hours and a structured request form. It is **not** the existing free-text chat flow. Reusing that demo flow requires removing demo-only statements and adding a reviewed form handoff before presenting the pilot as the full Starter chatbot.

## Infrastructure estimate

Planning assumption: **60 saved requests per shop per month, one notification per request**, a single verified AutoLead sender domain, no attachments or AI calls, and ordinary owner reads. This is an illustrative workload, not measured usage. Amounts are USD/month and exclude an existing shop's domain/website, taxes, chargebacks, support labor and any legal review.

| Shops | Requests/emails per month | Worker + D1 | Email | Estimated infrastructure | Revenue at $9/shop |
|---:|---:|---:|---:|---:|---:|
| 1 | 60 | $0 on Free if quota holds | $0 Resend Free | **$0** | $9 |
| 10 | 600 | **$5 minimum Workers Paid** on one account while retaining two test D1s: 12 databases exceed Free's 10 | $0 Resend Free | **$5** | $90 |
| 50 | 3,000 | **$5 minimum Workers Paid**; usage must still be measured | **$20 Resend Pro recommended**: Free's 100/day limit leaves no room for spikes at 3,000/month | **$25** | $450 |

For 1 shop, the Free tier may support a small pilot if requests, CPU and D1 rows remain below limits. Eight new shop databases fit on the current Free account alongside two test databases; a ninth new shop requires a plan/account decision. At 10 and 50 shops, the architecture as specified requires a paid Workers plan on this account. These are estimates only: **no paid plan has been enabled**. Resend Free permits 3,000/month and 100/day; 50 shops averaging 60/month would exactly fill the monthly quota and can exceed the daily quota on a busy day. A daily/monthly email cap and usage alarms must precede scale-up. The $149 one-time setup fee is separate from the $9 recurring price.

Cloudflare official references: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 Free database and backup limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 rows/storage pricing](https://developers.cloudflare.com/d1/platform/pricing/). Email references: [Resend plans](https://resend.com/pricing), [24-hour idempotency](https://resend.com/changelog/idempotency-keys). Bot protection: [Turnstile Free](https://developers.cloudflare.com/turnstile/plans/), [mandatory Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Fastest safe path to a paying first customer

Use a short, clearly scoped paid setup/discovery agreement for one shop while keeping real contact intake off. Obtain its exact site/profile and privacy approval, configure the separate pilot from [pilot/README.md](pilot/README.md), and run the end-to-end fictional canary. After explicit authorization for real data and email, activate only that shop's Worker. Keep the original demo as a sales link, but describe the pilot's structured assistant accurately until the free-text handoff is integrated. Do not promise an appointment or AI Pro.
