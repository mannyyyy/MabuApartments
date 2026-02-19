#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const PHASE_STATE_PATH = path.join(ROOT, ".github", "phase-state.yml");

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

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function ensureProgressFile(progressPath, phase) {
  if (fs.existsSync(progressPath)) {
    return;
  }

  const initial = `# Ralph Phase ${phase} Progress

## Scope Registry
- \`${phase}1_PENDING\`

## Defaults
- max_files: \`10\`
- profile: \`phase_a_strict\`
- autonomy: \`HITL\`

## Current Pointer
- active_scope_id: \`${phase}1_PENDING\`
- active_status: \`pending\`

## Iteration Log
<!-- Appended by scripts/ralph/record-progress.js -->
`;

  fs.mkdirSync(path.dirname(progressPath), { recursive: true });
  fs.writeFileSync(progressPath, initial, "utf8");
}

function upsertCurrentPointer(content, scopeId, status) {
  let next = content;
  if (/^- active_scope_id: `.*`$/m.test(next)) {
    next = next.replace(/^- active_scope_id: `.*`$/m, `- active_scope_id: \`${scopeId}\``);
  } else {
    next += `\n- active_scope_id: \`${scopeId}\``;
  }

  if (/^- active_status: `.*`$/m.test(next)) {
    next = next.replace(/^- active_status: `.*`$/m, `- active_status: \`${status}\``);
  } else {
    next += `\n- active_status: \`${status}\``;
  }

  return next;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scopeId = args["scope-id"];
  if (!scopeId) {
    console.error("Missing required argument: --scope-id");
    process.exit(2);
  }

  const status = args.status || "done";
  const gateResults = args["gate-results"] || "pass";
  const notes = args.notes || "Auto-recorded progress entry";
  const nextScopeId = args["next-scope-id"] || "TBD";
  const timestamp = args.timestamp || new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const phaseState = parseSimpleYaml(fs.readFileSync(PHASE_STATE_PATH, "utf8"));
  const currentPhase = String(phaseState.current_phase || "").toUpperCase();
  if (!currentPhase) {
    throw new Error("current_phase missing in .github/phase-state.yml");
  }

  const progressFile = args["progress-file"] || phaseState.phase_progress_log;
  if (!progressFile) {
    throw new Error("phase_progress_log missing in .github/phase-state.yml");
  }

  const progressPath = path.join(ROOT, progressFile);
  ensureProgressFile(progressPath, currentPhase);

  let content = fs.readFileSync(progressPath, "utf8");

  const dedupePattern = new RegExp(
    `^### .*\\| scope_id=${scopeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\| status=${status.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    "m",
  );

  if (dedupePattern.test(content)) {
    console.log(`Progress entry already exists for ${scopeId} (${status}).`);
    return;
  }

  content = upsertCurrentPointer(content, scopeId, status);

  const entry = `

### ${timestamp} | scope_id=${scopeId} | status=${status}
- gate_results: ${gateResults}
- next_scope_id: ${nextScopeId}
- notes: ${notes}
`;

  content += entry;
  fs.writeFileSync(progressPath, content, "utf8");
  console.log(`Updated ${progressFile} with ${scopeId} (${status}).`);
}

main();

