# Vercel Environment Variable and Payment Routing Policy

## Scope

- Project: `mabu-apartments`
- Team: `codewith-zachs-projects`
- Applies to: Vercel `development`, `preview`, and `production`

## Canonical Environment Matrix

| Runtime environment | `PAYSTACK_SECRET_KEY` | `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | `NEXT_PUBLIC_APP_URL` | Expected payment mode |
| --- | --- | --- | --- | --- |
| `development` | `sk_test_*` | `pk_test_*` | `http://localhost:3000` | Test |
| `preview` | `sk_test_*` | `pk_test_*` | `https://<preview-domain>.vercel.app` | Test |
| `production` | `sk_live_*` | `pk_live_*` | `https://www.mabuapartments.com` | Live |

## Callback and Webhook Routing Rules

### Callback URL

- Callback URL is not static in Paystack dashboard for this app flow.
- `POST /api/booking-requests/initiate` sets `callback_url` dynamically as `{request-origin}/payment-success`.
- Request origin is derived from forwarded headers (`x-forwarded-host` and `x-forwarded-proto`) when present.
- Outcome: callback host follows the domain where payment was initiated.

### Webhook URL

- Webhook URL is configured in Paystack dashboard and must be reachable by Paystack servers.
- Production webhook URL is `https://www.mabuapartments.com/api/paystack-webhook`.
- Preview webhook testing under deployment protection requires bypass query param: `https://<preview-domain>.vercel.app/api/paystack-webhook?x-vercel-protection-bypass=<token>`.

## Deployment Protection Policy

- If Vercel deployment protection is enabled for previews, external webhook senders cannot pass the protection challenge.
- Without bypass, Paystack webhook calls to preview commonly fail before app handler execution (for example `401`).
- Use a scoped protection bypass token for machine-to-machine preview testing.
- Treat bypass tokens as secrets; rotate if exposed.

## Required Runtime Variables

- Database: `DATABASE_URL`
- Uploads: `UPLOAD_TOKEN_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_ID_UPLOAD_FOLDER`
- Rate limit/token store: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, `CONTACT_FORM_RECIPIENT`
- App URL: `NEXT_PUBLIC_APP_URL`
- Paystack init resilience tuning (optional): `PAYSTACK_INIT_TIMEOUT_MS`, `PAYSTACK_INIT_MAX_RETRIES`, `PAYSTACK_INIT_RETRY_BASE_MS`

## Deprecated Variables

- `PAYSTACK_PUBLIC_KEY` is deprecated and must not be used.
- Use `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` for client-side Paystack key access.

## Post-Change Operational Checklist

After any Vercel env update:

1. Redeploy the target environment.
2. Initiate one test payment from that environment.
3. Confirm callback host matches initiating host.
4. Confirm webhook request reaches `/api/paystack-webhook` and signature is valid.
5. Confirm `GET /api/verify-payment?reference=<ref>` transitions to `confirmed` or expected review state.
6. Confirm booking creation and payment status in DB.

## Cleanup Policy

- Remove env vars only when code and docs confirm they are unused.
- Keep provider/db alias vars unless migration work is actively scheduled.
