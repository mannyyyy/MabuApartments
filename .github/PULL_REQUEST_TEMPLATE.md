<!-- AUTO-GENERATED: run `npm run generate:pr-template`; do not edit directly -->
## Summary
- Phase: `Phase E`
- Scope ID:
- What changed:
- Why:

## Validation
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
- [ ] Targeted tests for touched behavior

## Ralph Loop Checklist
- [ ] Exactly one `scope_id` implemented in this PR
- [ ] Changed file count is `<= 10` for this loop
- [ ] No payment-critical files changed in this scope (or justified in Risk Notes):
- [ ] `app/api/create-payment/route.ts`
- [ ] `app/api/verify-payment/route.ts`
- [ ] `app/api/paystack-webhook/route.ts`
- [ ] Relevant phase progress log updated (or N/A with reason): `progress/ralph-phase-e.md`
- [ ] Rollback path documented (single commit revert)

## Risk Notes
- User-visible impact:
- Backward compatibility:
- Operational risk:
