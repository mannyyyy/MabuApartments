# Payment and Email Operations Runbook

## Purpose

This runbook is the source of truth for operating and validating the booking payment flow.

It covers:

- Paystack configuration by environment
- Vercel configuration requirements
- End-to-end validation after deploy
- Fast triage for common failures

## System Overview

1. Client submits booking form.
2. `POST /api/booking-requests/initiate` creates or reuses a booking request and initializes Paystack.
3. API sets Paystack `callback_url` as `{request-origin}/payment-success`.
4. User is redirected to Paystack checkout.
5. Paystack sends webhook to `POST /api/paystack-webhook`.
6. App verifies signature and transaction, creates booking, and updates booking request status.
7. Client polls `GET /api/verify-payment?reference=...` from `/payment-success`.
8. Confirmation email is sent with inline CID logo attachment.

## Environment Requirements

### Key Separation Policy

- `development` and `preview`: test keys (`sk_test_*`, `pk_test_*`)
- `production`: live keys (`sk_live_*`, `pk_live_*`)

### Required Variables

- `PAYSTACK_SECRET_KEY`
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- Email vars (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, `CONTACT_FORM_RECIPIENT`)

## Paystack Dashboard Configuration

### Test Mode

- Secret/public keys must be test keys.
- Webhook URL should use preview domain only for preview testing.
- If preview has deployment protection enabled, append bypass token query param: `https://<preview-domain>.vercel.app/api/paystack-webhook?x-vercel-protection-bypass=<token>`.
- Callback URL in dashboard is optional fallback for this app, because callback is set per transaction.

### Live Mode

- Secret/public keys must be live keys.
- Webhook URL must be `https://www.mabuapartments.com/api/paystack-webhook`.
- Callback URL in dashboard can remain set, but app still sends callback per transaction.

## Vercel Settings

1. Confirm env vars are scoped correctly by environment.
2. Redeploy after any env change.
3. If testing webhooks against preview with protection enabled, provision and use bypass token.

## End-to-End Validation Checklist

Run this after deploy or env changes:

1. Start a payment from target environment domain.
2. Confirm redirect to Paystack checkout succeeds.
3. Complete payment.
4. Confirm callback returns to `/payment-success` on the same environment domain.
5. Confirm webhook is accepted (not blocked by protection and not invalid signature).
6. Confirm `/api/verify-payment?reference=<ref>` returns expected state.
7. Confirm `bookingRequest.paymentStatus = paid` and `bookingId` is set.
8. Confirm a `booking` row exists for `paymentReference`.
9. Confirm confirmation email arrives and logo renders.

## DB Verification Queries

Use Prisma Studio or SQL to confirm payment completion.

### Booking request by payment reference

```sql
select id, payment_reference, payment_status, booking_id, review_reason, webhook_received_at, updated_at
from booking_requests
where payment_reference = '<reference>';
```

### Booking by payment reference

```sql
select id, payment_reference, guest_email, check_in, check_out, created_at
from bookings
where payment_reference = '<reference>';
```

## Fast Triage Guide

### Symptom: `Transaction reference not found`

Likely causes:

- Test transaction verified using live key environment.
- Callback or verify route reached a different deployment than initiation.

Actions:

1. Confirm initiating host and callback host match.
2. Confirm key environment (`test` vs `live`) for the deployment.
3. Retry from the intended environment domain.

### Symptom: `Rejected Paystack webhook due to invalid signature`

Likely causes:

- Wrong secret key for the mode (test vs live).
- Webhook payload delivered to deployment with mismatched secret.

Actions:

1. Confirm `PAYSTACK_SECRET_KEY` matches Paystack mode used.
2. Confirm webhook target domain points to correct environment.
3. Re-run payment and inspect webhook logs with host/environment context.

### Symptom: Webhook never updates booking status

Likely causes:

- Preview deployment protection blocking Paystack server request.
- Webhook URL not reachable.

Actions:

1. Validate webhook target URL is public from Paystack.
2. For preview testing, use bypass query parameter token.
3. Confirm webhook handler logs receipt of event.

### Symptom: Booking email logo missing

Likely causes:

- Email client remote-image blocking (legacy behavior).
- Inline attachment not produced.

Actions:

1. Confirm current code path is using inline CID attachment.
2. Confirm `public/images/MABU.png` exists in deployment artifact.
3. Send a fresh confirmation email and verify client display settings.

## Logging Signals to Watch

- `Initializing Paystack transaction`
- `Received Paystack webhook event`
- `Rejected Paystack webhook due to invalid signature`
- `Paystack verify failed during status polling`

## Escalation

Escalate if any of the following occur:

- Repeated `paid_needs_review` for valid payments
- Signature failures after confirmed key/domain alignment
- Callback/webhook host mismatch despite correct configuration
- Confirmed payments without booking creation
