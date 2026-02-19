## Summary
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
- [ ] No payment-critical file changed in Phase A:
- [ ] `app/api/create-payment/route.ts`
- [ ] `app/api/verify-payment/route.ts`
- [ ] `app/api/paystack-webhook/route.ts`
- [ ] `progress/ralph-phase-a.md` updated with loop result
- [ ] Rollback path documented (single commit revert)

## Risk Notes
- User-visible impact:
- Backward compatibility:
- Operational risk:

