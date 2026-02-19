#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PROFILE="${1:-phase_a_strict}"

run_gate() {
  local name="$1"
  shift
  echo "[gate] $name"
  "$@"
}

payment_routes_exist() {
  test -f "app/api/create-payment/route.ts"
  test -f "app/api/verify-payment/route.ts"
  test -f "app/api/paystack-webhook/route.ts"
}

case "$PROFILE" in
  phase_a_strict)
    run_gate "lint" npm run lint
    run_gate "typecheck" npx tsc --noEmit
    run_gate "build" npm run build
    ;;
  phase_a_fast)
    run_gate "lint" npm run lint
    run_gate "typecheck" npx tsc --noEmit
    ;;
  payment_safety_smoke)
    run_gate "lint" npm run lint
    run_gate "typecheck" npx tsc --noEmit
    run_gate "build" npm run build
    run_gate "payment route presence" payment_routes_exist
    ;;
  *)
    echo "Unknown gate profile: $PROFILE" >&2
    echo "Valid profiles: phase_a_strict, phase_a_fast, payment_safety_smoke" >&2
    exit 2
    ;;
esac

echo "[gate] profile '$PROFILE' passed"

