# Mabu Apartments Refactoring Plan (Concise, Decision-Complete)

## 1) Goal and Non-Goals

### Goal
Refactor the app into a production-safe Next.js App Router architecture without breaking booking, payment, and review flows.

### Non-Goals
- No UX redesign in this refactor.
- No route URL changes unless explicitly required.
- No payment provider migration.

## 2) Locked Decisions

- Keep route paths under `app/` as they exist today.
- Do not introduce `app/(routes)` in this refactor.
- Use root `middleware.ts` only (not `app/api/middleware.ts`).
- Keep `GET /api/reviews` for paginated public reads.
- Move write mutations to Server Actions where practical.
- Keep payment and webhook integration as API route handlers:
- `POST /api/create-payment`
- `POST /api/verify-payment`
- `POST /api/paystack-webhook`
- Consolidate Prisma client to a single shared module.
- Remove direct `new PrismaClient()` usage from route handlers/services.
- Canonical metadata must use `alternates.canonical`.
- Keep existing UI behavior during component splits.

## 3) Current-State Risks to Eliminate

- Conflicting middleware placement and Express-style limiter usage.
- Duplicate Prisma client modules and per-file client instantiation.
- Mixed API/action strategy without clear boundaries.
- Oversized components with business logic, validation, and rendering coupled.
- Missing payment reliability guarantees (idempotency, reconciliation, alerting).

## 4) Implementation Order

## Phase A: Foundation and Safety

### Change
- Remove confirmed-unused components.
- Normalize naming to PascalCase for component files.
- Consolidate Prisma client and update imports.
- Move middleware logic to root and replace Express-compatible assumptions.

### Why
- Reduces dead code and avoids runtime instability from duplicate DB clients.
- Prevents broken rate limiting and edge/runtime incompatibilities.

### Done when
- No imports reference deleted components.
- Exactly one Prisma client module is used by app code.
- Middleware exists only at root and runs for `/api/:path*`.

## Phase B: Structural Refactor Without Behavior Change

### Change
- Split large components:
  Header into container + desktop/mobile nav + scroll hook.
  Booking form into orchestration + date range + price summary + hooks.
  Reviews into container + card/list + pagination hook.
- Extract Zod schemas into `lib/validators`.
- Extract business logic into `services`.

### Why
- Makes behavior testable and allows clean server/client boundaries.

### Done when
- New modules compile with no behavior regressions.
- Validation logic is not embedded inside page-level UI files.
- API/action handlers call service functions for core business logic.

## Phase C: Rendering and Data Boundaries

### Change
- Default pages/components to Server Components where browser APIs are not required.
- Keep browser-only logic in explicit client leaf components.
- Apply cache strategy intentionally:
  SSG: marketing pages.
  ISR: room listing/detail content pages.
  SSR/dynamic: user/session/payment result pages.

### Why
- Improves performance and reduces client JS without breaking interactive features.

### Done when
- Unnecessary `"use client"` directives removed.
- Data-fetching boundaries are explicit and type-safe.

## Phase D: Mutation Path Migration

### Change
- Introduce Server Actions for write flows:
  Booking create/extend.
  Review submission.
  Availability checks used by server-side paths.
- Keep API routes where required by third-party or public-read constraints.

### Why
- Aligns with App Router mutation patterns while preserving integration constraints.

### Done when
- No duplicate mutation paths for the same operation.
- Retained API routes have explicit rationale.

## Phase E: Hardening and Release Gates

### Change
- Add/normalize metadata and semantic HTML.
- Add security controls: strict validation, sanitization, rate limiting, error shaping.
- Add tests and CI gates for critical flows.
- Add payment monitoring and reconciliation.

### Why
- Refactor is only complete when it is safe to operate in production.

### Done when
- All release criteria in Section 8 pass in staging and production rollout.

## 5) Public Interfaces and Contracts

### Server Actions (target)
- `app/actions/bookings.ts`
- `createBooking(input)`
- `extendBooking(input)`
- `app/actions/reviews.ts`
- `submitReview(input)`
- `app/actions/availability.ts`
- `checkAvailability(input)`

### API Routes retained
- `POST /api/create-payment`
- `POST /api/verify-payment`
- `POST /api/paystack-webhook`
- `GET /api/reviews` (paginated read for infinite scroll compatibility)

### API Routes to deprecate after migration validation
- `POST /api/create-booking`
- `POST /api/check-availability` (if fully replaced by action path)
- `GET /api/unavailable-dates` (if supplied by server-driven data path)

### Type contracts to centralize
- `BookingInput`
- `BookingExtensionInput`
- `AvailabilityCheckInput`
- `ReviewInput`
- `PaymentInitInput`
- `ActionResult<T>`
- `ApiError`

## 6) Payment Critical Path (Non-Negotiable)

### Required transaction flow
1. User selects room and date range.
2. Availability is revalidated server-side at submit time.
3. Payment is initialized with Paystack.
4. User is redirected to Paystack checkout.
5. Redirect return is treated as provisional.
6. Webhook verification determines final payment truth.
7. Booking state is written idempotently.
8. Success/failure pages reflect verified server state.

### Reliability controls
- Webhook signature verification is mandatory.
- Idempotency key or equivalent dedupe is mandatory for booking/payment writes.
- Duplicate webhook events must be safely ignored.
- Reconciliation job/command must detect orphaned transactions and orphaned bookings.
- Alerting required for payment initialization failures, webhook delivery or verification failures, and verification mismatch rates.

### International card readiness criteria
- Live-mode Paystack credentials configured.
- Required channels enabled in Paystack dashboard.
- Currency and settlement constraints validated for target customer regions.
- Real low-value live transactions executed for at least one local card and at least one international card.
- 3DS challenge path tested end-to-end.

## 7) Test Plan

### Unit
- Validators reject malformed payloads and accept valid payloads.
- Service functions enforce invariants and return typed results.

### Integration
- Server Actions and retained API routes enforce the same validation rules.
- Prisma/service layer is used consistently (no direct client drift).

### End-to-End (critical)
- Browse rooms and room details.
- Check availability.
- Initialize payment.
- Complete successful payment and persist confirmed booking.
- Fail/cancel payment and confirm no paid booking state.
- Submit review and fetch paginated reviews.
- Extend booking and verify availability/pricing updates.

### Webhook robustness
- Duplicate webhook event does not duplicate side effects.
- Out-of-order redirect and webhook events converge to correct state.
- Invalid webhook signature is rejected and logged.

## 8) Release Acceptance Criteria

- `npm run build` passes.
- Lint and type checks pass.
- Critical E2E suite passes in CI.
- Payment critical path passes in staging.
- Live-mode smoke test passes for local and international cards.
- Reconciliation reports zero unexplained successful-charge-without-booking cases.
- Monitoring dashboards and alerts are active before production rollout.

## 9) Rollout and Rollback

### Rollout
- Ship in small phases.
- Keep legacy endpoints until replacement path is verified.
- Validate booking/payment metrics after each phase.

### Rollback
- Re-enable legacy mutation path behind flags if regression appears.
- Preserve webhook handler availability during rollback.
- Keep migration logs to restore state deterministically.

## 10) Assumptions and Defaults

- Existing route URLs and UX should remain stable during refactor.
- `GET /api/reviews` stays public and paginated for current UI.
- Payment integration remains Paystack via API route handlers.
- Environment secrets and webhook reachability are available in staging/production.
- This document supersedes older week/day scheduling and metric-estimate sections.
