# Ralph Execution Protocol (Phase-Aware, HITL-First)

## Purpose
This protocol applies a controlled Ralph loop workflow across refactor phases while keeping payment-critical safety and release quality gates intact.

## Source of Truth
- Current phase and checklist behavior are defined in `.github/phase-state.yml`.
- The PR template is generated from this config using `scripts/ralph/generate-pr-template.js`.

## Core Rules
- Runner: Codex CLI (or compatible runner command).
- Autonomy: HITL by default.
- Scope: one `scope_id` per loop.
- File cap: defined by `.github/phase-state.yml` (`max_changed_files`).
- Payment safety guard: driven by `.github/phase-state.yml`.

## Artifacts
- Protocol: `docs/RALPH_EXECUTION_PROTOCOL.md`
- Phase config: `.github/phase-state.yml`
- Template generator: `scripts/ralph/generate-pr-template.js`
- PR template: `.github/PULL_REQUEST_TEMPLATE.md` (auto-generated)
- Loop runner: `scripts/ralph/run-loop.sh`
- Gate checks: `scripts/ralph/check-gates.sh`
- Progress logs:
- `progress/ralph-phase-a.md`
- `progress/ralph-phase-b.md`

## Loop Lifecycle
1. Pick one `scope_id`.
2. Run loop tooling for the target scope.
3. Enforce quality gates (`lint`, `typecheck`, `build` profile as needed).
4. Keep one-scope-per-commit and record rollback strategy.
5. Human reviews before merge.

## PR Template Automation
### Local
```bash
npm run generate:pr-template
npm run check:pr-template
```

### CI
- `validate-pr-template.yml` fails PRs when `.github/PULL_REQUEST_TEMPLATE.md` is stale relative to `.github/phase-state.yml`.
- `sync-pr-template.yml` auto-syncs template on `main` when phase-state/generator changes.

## Phase Change Procedure
1. Update `.github/phase-state.yml`:
- `current_phase`
- `scope_prefix`
- `phase_progress_log`
- guard settings if needed
2. Run `npm run generate:pr-template`.
3. Commit config + generated template.
4. Merge to `main` (sync workflow keeps template aligned).

## Gate Profiles
- `phase_a_strict`: `lint`, `typecheck`, `build`
- `phase_a_fast`: `lint`, `typecheck`
- `payment_safety_smoke`: `lint`, `typecheck`, `build`, route presence checks

## Current Limitation
- `scripts/ralph/run-loop.sh` currently contains explicit A-scope logic (`A1` to `A4`).
- For B+ work, use the same one-scope/one-commit discipline and gates; extend script scope tables in a separate change if full loop automation is required.

## Commit and Rollback
- One completed scope maps to one commit.
- If a scope is blocked, do not commit partial results.
- Rollback strategy is single-commit revert per loop.
