#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PROMPT_TEMPLATE="$ROOT_DIR/prompts/ralph/phase-a.txt"
PROGRESS_FILE="$ROOT_DIR/progress/ralph-phase-a.md"
GATE_SCRIPT="$ROOT_DIR/scripts/ralph/check-gates.sh"

usage() {
  cat <<'EOF'
Usage:
  scripts/ralph/run-loop.sh <scope_id> [options]

Options:
  --profile <name>        Gate profile (default: phase_a_strict)
  --runner-cmd "<cmd>"    Runner command that accepts prompt-file as final argument
  --max-files <n>         Max changed files allowed (default: 10)
  --allow-dirty           Skip clean-worktree precheck
  --dry-run               Generate prompt and print checks only; no logs or gates
  -h, --help              Show help

Example:
  scripts/ralph/run-loop.sh A1_DEAD_CODE_CLEANUP \
    --runner-cmd "codex --prompt-file" \
    --profile phase_a_strict
EOF
}

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "Missing required file: $path" >&2
    exit 1
  fi
}

scope_summary() {
  case "$1" in
    A1_DEAD_CODE_CLEANUP) echo "Remove confirmed-unused components and related imports." ;;
    A2_NAMING_NORMALIZATION) echo "Normalize component file naming to PascalCase and update imports." ;;
    A3_PRISMA_CONSOLIDATION) echo "Consolidate Prisma usage to a single client module." ;;
    A4_MIDDLEWARE_CORRECTION) echo "Correct middleware placement and compatibility for Next.js." ;;
    *) return 1 ;;
  esac
}

scope_allowed_regex() {
  case "$1" in
    A1_DEAD_CODE_CLEANUP) echo '^(components/|app/)' ;;
    A2_NAMING_NORMALIZATION) echo '^(components/|app/)' ;;
    A3_PRISMA_CONSOLIDATION) echo '^(lib/|app/api/|services/|types/)' ;;
    A4_MIDDLEWARE_CORRECTION) echo '^(middleware\.ts|app/api/middleware\.ts|lib/|app/api/)' ;;
    *) return 1 ;;
  esac
}

scope_done_criteria() {
  case "$1" in
    A1_DEAD_CODE_CLEANUP) echo "No imports reference removed components." ;;
    A2_NAMING_NORMALIZATION) echo "Renamed files compile with all imports resolved." ;;
    A3_PRISMA_CONSOLIDATION) echo "Exactly one Prisma client construction path remains in app code." ;;
    A4_MIDDLEWARE_CORRECTION) echo "Middleware logic is root-valid and matcher targets /api/:path*." ;;
    *) return 1 ;;
  esac
}

next_scope_id() {
  case "$1" in
    A1_DEAD_CODE_CLEANUP) echo "A2_NAMING_NORMALIZATION" ;;
    A2_NAMING_NORMALIZATION) echo "A3_PRISMA_CONSOLIDATION" ;;
    A3_PRISMA_CONSOLIDATION) echo "A4_MIDDLEWARE_CORRECTION" ;;
    A4_MIDDLEWARE_CORRECTION) echo "NONE" ;;
    *) echo "UNKNOWN" ;;
  esac
}

append_progress() {
  local status="$1"
  local changed_files="$2"
  local gate_results="$3"
  local next_scope="$4"
  local notes="$5"
  local ts
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  cat >>"$PROGRESS_FILE" <<EOF

### $ts | scope_id=$SCOPE_ID | status=$status
- changed_files: $changed_files
- gate_results: $gate_results
- next_scope_id: $next_scope
- notes: $notes
EOF
}

SCOPE_ID="${1:-}"
if [[ -z "$SCOPE_ID" ]]; then
  usage
  exit 2
fi
shift || true

PROFILE="phase_a_strict"
RUNNER_CMD="${RALPH_RUNNER_CMD:-}"
MAX_FILES=10
ALLOW_DIRTY=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="${2:-}"
      shift 2
      ;;
    --runner-cmd)
      RUNNER_CMD="${2:-}"
      shift 2
      ;;
    --max-files)
      MAX_FILES="${2:-}"
      shift 2
      ;;
    --allow-dirty)
      ALLOW_DIRTY=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

summary="$(scope_summary "$SCOPE_ID")" || {
  echo "Unknown scope_id: $SCOPE_ID" >&2
  exit 2
}
allowed_regex="$(scope_allowed_regex "$SCOPE_ID")"
done_criteria="$(scope_done_criteria "$SCOPE_ID")"

require_file "$PROMPT_TEMPLATE"
require_file "$PROGRESS_FILE"
require_file "$GATE_SCRIPT"

if [[ "$ALLOW_DIRTY" -ne 1 ]] && [[ -n "$(git status --porcelain)" ]]; then
  echo "Worktree is not clean. Commit/stash changes or pass --allow-dirty." >&2
  exit 1
fi

PROMPT_FILE="$(mktemp "${TMPDIR:-/tmp}/ralph-${SCOPE_ID}-XXXXXX.txt")"
cp "$PROMPT_TEMPLATE" "$PROMPT_FILE"
cat >>"$PROMPT_FILE" <<EOF

Loop Context:
- Scope ID: $SCOPE_ID
- Scope Summary: $summary
- Allowed Path Regex: $allowed_regex
- Done Criteria: $done_criteria
- Max Changed Files: $MAX_FILES
- Gate Profile: $PROFILE
EOF

echo "Generated loop prompt: $PROMPT_FILE"
echo "Scope: $SCOPE_ID"
echo "Allowed path regex: $allowed_regex"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run complete. No logs or gates executed."
  exit 0
fi

append_progress "in_progress" "none" "pending" "$SCOPE_ID" "Loop started"

if [[ -n "$RUNNER_CMD" ]]; then
  echo "Running runner command..."
  bash -lc "${RUNNER_CMD} \"${PROMPT_FILE}\""
else
  echo "No --runner-cmd provided. Skipping runner execution."
fi

raw_changed="$({ git diff --name-only; git diff --cached --name-only; } | sort -u)"
changed="$(
  printf "%s\n" "$raw_changed" \
    | rg -v '^$|^progress/ralph-phase-a\.md$' || true
)"

changed_count="$(printf "%s\n" "$changed" | rg -v '^$' | wc -l | tr -d ' ')"
changed_csv="$(printf "%s\n" "$changed" | rg -v '^$' | paste -sd ',' -)"
if [[ -z "$changed_csv" ]]; then
  changed_csv="none"
fi

status="done"
gate_result="pass"
notes="Loop completed"
next_scope="$(next_scope_id "$SCOPE_ID")"

if [[ "$changed_count" -eq 0 ]]; then
  status="blocked"
  gate_result="skipped"
  notes="No changes detected outside progress log."
fi

if [[ "$status" == "done" ]] && [[ "$changed_count" -gt "$MAX_FILES" ]]; then
  status="blocked"
  gate_result="skipped"
  notes="Changed file count ($changed_count) exceeds max ($MAX_FILES)."
fi

if [[ "$status" == "done" ]]; then
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    if [[ "$file" =~ ^app/api/(create-payment|verify-payment|paystack-webhook)/route\.ts$ ]]; then
      status="blocked"
      gate_result="skipped"
      notes="Payment-critical file modified in Phase A: $file"
      break
    fi
    if ! [[ "$file" =~ $allowed_regex ]]; then
      status="blocked"
      gate_result="skipped"
      notes="File outside allowed scope: $file"
      break
    fi
  done <<EOF
$changed
EOF
fi

if [[ "$status" == "done" ]]; then
  if "$GATE_SCRIPT" "$PROFILE"; then
    gate_result="pass"
    notes="All gates passed."
  else
    status="blocked"
    gate_result="fail"
    notes="Gate profile '$PROFILE' failed."
  fi
fi

if [[ "$status" != "done" ]]; then
  next_scope="$SCOPE_ID"
fi

append_progress "$status" "$changed_csv" "$gate_result" "$next_scope" "$notes"

echo "Loop result: $status"
echo "Changed files: $changed_csv"
echo "Gate result: $gate_result"
echo "Next scope: $next_scope"
