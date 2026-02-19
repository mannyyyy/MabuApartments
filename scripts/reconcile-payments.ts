#!/usr/bin/env ts-node
import "dotenv/config"
import { formatReconciliationReport } from "../lib/payments/reconciliation"
import { runPaymentReconciliation } from "../services/payment-reconciliation.service"

function readArgNumber(name: string, fallback: number) {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  const rawValue = process.argv[index + 1]
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function hasFlag(name: string) {
  return process.argv.includes(name)
}

async function main() {
  const windowDays = readArgNumber("--window-days", 14)
  const pendingTimeoutHours = readArgNumber("--pending-timeout-hours", 24)
  const failOnIssue = hasFlag("--fail-on-issue")
  const jsonOutput = hasFlag("--json")

  const report = await runPaymentReconciliation({ windowDays, pendingTimeoutHours })

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } else {
    process.stdout.write(`${formatReconciliationReport(report)}\n`)
  }

  if (failOnIssue && report.summary.issueCount > 0) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error("Failed to run payment reconciliation", error)
  process.exit(1)
})
