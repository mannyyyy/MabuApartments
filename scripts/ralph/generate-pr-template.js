#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const PHASE_STATE_PATH = path.join(ROOT, ".github", "phase-state.yml");
const TEMPLATE_PATH = path.join(ROOT, ".github", "PULL_REQUEST_TEMPLATE.md");

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseSimpleYaml(content) {
  const obj = {};
  let currentListKey = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- ")) {
      if (!currentListKey || !Array.isArray(obj[currentListKey])) {
        throw new Error(`Invalid list item without list key: "${rawLine}"`);
      }
      obj[currentListKey].push(parseScalar(trimmed.slice(2)));
      continue;
    }

    const match = /^([A-Za-z0-9_]+):(?:\s*(.*))?$/.exec(trimmed);
    if (!match) {
      throw new Error(`Unable to parse line: "${rawLine}"`);
    }

    const key = match[1];
    const value = match[2] ?? "";

    if (value === "") {
      obj[key] = [];
      currentListKey = key;
    } else {
      obj[key] = parseScalar(value);
      currentListKey = null;
    }
  }

  return obj;
}

function validateConfig(config) {
  const requiredKeys = [
    "current_phase",
    "scope_prefix",
    "max_changed_files",
    "enforce_payment_guard",
    "phase_progress_log",
    "payment_guard_files",
  ];

  for (const key of requiredKeys) {
    if (!(key in config)) {
      throw new Error(`Missing required key in phase-state.yml: ${key}`);
    }
  }

  const phase = String(config.current_phase).toUpperCase();
  if (!/^[A-Z]$/.test(phase)) {
    throw new Error("current_phase must be a single uppercase phase letter (e.g. A, B, C)");
  }

  if (!Number.isInteger(config.max_changed_files) || config.max_changed_files <= 0) {
    throw new Error("max_changed_files must be a positive integer");
  }

  if (typeof config.enforce_payment_guard !== "boolean") {
    throw new Error("enforce_payment_guard must be true or false");
  }

  if (!Array.isArray(config.payment_guard_files) || config.payment_guard_files.length === 0) {
    throw new Error("payment_guard_files must be a non-empty list");
  }

  return {
    ...config,
    current_phase: phase,
    scope_prefix: String(config.scope_prefix).toUpperCase(),
    phase_progress_log: String(config.phase_progress_log),
    payment_guard_files: config.payment_guard_files.map((item) => String(item)),
  };
}

function renderTemplate(config) {
  const isPhaseA = config.current_phase === "A";
  const paymentGuardHeader = isPhaseA
    ? "No payment-critical file changed in Phase A:"
    : "No payment-critical files changed in this scope (or justified in Risk Notes):";
  const progressLogLine = isPhaseA
    ? `\`${config.phase_progress_log}\` updated with loop result`
    : `Relevant phase progress log updated (or N/A with reason): \`${config.phase_progress_log}\``;

  const paymentFileCheckboxes = config.payment_guard_files
    .map((file) => `- [ ] \`${file}\``)
    .join("\n");

  return `<!-- AUTO-GENERATED: run \`npm run generate:pr-template\`; do not edit directly -->
## Summary
- Phase: \`Phase ${config.current_phase}\`
- Scope ID:
- What changed:
- Why:

## Validation
- [ ] \`npm run lint\`
- [ ] \`npx tsc --noEmit\`
- [ ] \`npm run build\`
- [ ] Targeted tests for touched behavior

## Ralph Loop Checklist
- [ ] Exactly one \`scope_id\` implemented in this PR
- [ ] Changed file count is \`<= ${config.max_changed_files}\` for this loop
- [ ] ${paymentGuardHeader}
${paymentFileCheckboxes}
- [ ] ${progressLogLine}
- [ ] Rollback path documented (single commit revert)

## Risk Notes
- User-visible impact:
- Backward compatibility:
- Operational risk:
`;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const configRaw = fs.readFileSync(PHASE_STATE_PATH, "utf8");
  const parsedConfig = parseSimpleYaml(configRaw);
  const config = validateConfig(parsedConfig);
  const rendered = renderTemplate(config);

  const existing = fs.existsSync(TEMPLATE_PATH) ? fs.readFileSync(TEMPLATE_PATH, "utf8") : "";

  if (checkOnly) {
    if (existing !== rendered) {
      console.error("PULL_REQUEST_TEMPLATE.md is out of date with .github/phase-state.yml");
      console.error("Run: npm run generate:pr-template");
      process.exit(1);
    }
    console.log("PULL_REQUEST_TEMPLATE.md is up to date.");
    return;
  }

  if (existing === rendered) {
    console.log("No changes needed: PULL_REQUEST_TEMPLATE.md is already up to date.");
    return;
  }

  fs.writeFileSync(TEMPLATE_PATH, rendered, "utf8");
  console.log("Updated .github/PULL_REQUEST_TEMPLATE.md");
}

main();

