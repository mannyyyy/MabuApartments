# Payment and Email Incident Log

## Scope

This log tracks payment and confirmation-email incidents encountered during the February 2026 hardening cycle, with root causes, fixes, and prevention controls.

## Incident Entries

### 2026-02-20 - Environment Mismatch During Verification

- Symptom: Payment verification reported missing or unknown references after checkout.
- Impact: Successful test checkouts did not consistently converge to confirmed booking state.
- Root cause: Payment initiated in test/preview context but verification path executed with live/production credentials.
- Fix applied: Added callback base URL override support to payment initializer and derived callback host from request forwarded headers in `POST /api/booking-requests/initiate`.
- Validation: Callback URL resolved to initiating deployment host and test checkout verification succeeded in matching environment.
- Prevention: Enforce key separation by environment and keep callback host request-origin based instead of hardcoded global URL.

### 2026-02-20 - Preview Webhook Blocked by Deployment Protection

- Symptom: Webhook delivery to preview failed and booking requests remained in processing/initiated state.
- Impact: Delayed or missing booking confirmation despite successful payment.
- Root cause: Paystack webhook requests to preview were blocked by Vercel deployment protection before app handler execution.
- Fix applied: Configured preview webhook URL with protection bypass query parameter for machine-to-machine requests.
- Validation: Preview webhook endpoint became reachable and booking request state transitioned after valid webhook path.
- Prevention: Document preview protection constraints in runbook/policy and require webhook reachability tests after env or domain changes.

### 2026-02-20 - Invalid Webhook Signature Rejections

- Symptom: `Rejected Paystack webhook due to invalid signature` appeared in logs.
- Impact: Webhook events were ignored and booking state did not finalize.
- Root cause: Mode/domain/key mismatch between webhook sender and receiving deployment.
- Fix applied: Added structured webhook logs with host/environment/signature context and standardized test/live key routing by environment.
- Validation: Valid signed events were accepted after key/domain alignment.
- Prevention: Keep webhook domain and secret aligned with Paystack mode and audit env scopes after each key update.

### 2026-02-20 - Booking Email Header Image Missing

- Symptom: Booking confirmation emails rendered without the logo image.
- Impact: Degraded customer-facing email branding.
- Root cause: Remote image behavior in email clients combined with serverless runtime file-path assumptions.
- Fix applied: Implemented inline CID attachment flow in `utils/email.ts`, added fallback to fetch and attach logo from public URL, and switched asset target to `public/images/MABU.png`.
- Validation: New emails rendered the logo through inline attachment in tested clients.
- Prevention: Keep branded assets in `public/images` and include email rendering checks in post-deploy validation.

### 2026-02-20 - Documentation Drift From Runtime Behavior

- Symptom: Docs did not reflect callback derivation behavior, preview webhook constraints, or current env policies.
- Impact: Repeated configuration mistakes and slower incident resolution.
- Root cause: Rapid payment-flow changes were not synchronized with operational documentation updates.
- Fix applied: Updated `README.md` payment operations guidance, expanded `docs/ops/vercel-env-policy.md`, and added `docs/ops/payment-runbook.md` plus this incident log.
- Validation: Docs now map to current code paths and operational controls.
- Prevention: Treat documentation updates as a required acceptance criterion for payment/email behavior changes.

## Retrospective Actions

1. Keep test/live payment paths isolated by environment and domain.
2. Require one full payment E2E test after env variable changes.
3. Keep webhook observability fields (`host`, `environment`, `reference`) in logs.
4. Keep this incident log updated for future payment/email production changes.
