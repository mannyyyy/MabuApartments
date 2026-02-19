# Ralph Execution Protocol (Phase A, HITL-First)

## Purpose
This protocol applies a controlled Ralph loop workflow to Phase A of the refactor plan. It is designed to improve execution speed without compromising payment safety or code quality.

## Core Rules
- Runner: Codex CLI (or compatible runner command).
- Autonomy: HITL by default.
- Scope: one scope per loop.
- File cap: max 10 changed files per loop.
- Session cap: max 5 loops per session.
- Payment safety: Phase A loops must not modify:
- `app/api/create-payment/route.ts`
- `app/api/verify-payment/route.ts`
- `app/api/paystack-webhook/route.ts`

## Phase A Scope IDs
- `A1_DEAD_CODE_CLEANUP`
- `A2_NAMING_NORMALIZATION`
- `A3_PRISMA_CONSOLIDATION`
- `A4_MIDDLEWARE_CORRECTION`

## Artifacts
- Protocol: `docs/RALPH_EXECUTION_PROTOCOL.md`
- Prompt template: `prompts/ralph/phase-a.txt`
- Loop runner: `scripts/ralph/run-loop.sh`
- Gate checks: `scripts/ralph/check-gates.sh`
- Progress log: `progress/ralph-phase-a.md`

## Loop Lifecycle
1. Pick one `scope_id`.
2. Run `scripts/ralph/run-loop.sh <scope_id> --runner-cmd "<your runner command>"`.
3. Runner executes exactly one scope from the generated prompt.
4. Script validates:
- file cap
- allowed path regex for scope
- payment-file protection
5. Script runs gates with profile `phase_a_strict` by default.
6. Script appends `in_progress` and final `done` or `blocked` entries to progress log.
7. Human reviews output before starting next loop.

## Gate Profiles
- `phase_a_strict`: `lint`, `typecheck`, `build`
- `phase_a_fast`: `lint`, `typecheck`
- `payment_safety_smoke`: `lint`, `typecheck`, `build`, route presence checks

## Commit and Rollback
- One completed scope maps to one commit.
- If a scope is blocked, do not commit partial results.
- Rollback strategy is single-commit revert per loop.

## Expansion Criteria (Beyond Phase A)
Allow expansion only after all are true:
- 3 consecutive green loops (no rollback).
- No unresolved Phase A regressions.
- Reviewer sign-off on progress log quality.
- Payment-critical files stay under manual supervision.

## Example Commands
```bash
# Dry run (no edits, no gates)
scripts/ralph/run-loop.sh A1_DEAD_CODE_CLEANUP --dry-run

# Execute one loop with default strict gates
scripts/ralph/run-loop.sh A1_DEAD_CODE_CLEANUP \
  --runner-cmd "codex --prompt-file"

# Execute one loop with fast gates
scripts/ralph/run-loop.sh A2_NAMING_NORMALIZATION \
  --runner-cmd "codex --prompt-file" \
  --profile phase_a_fast
```

