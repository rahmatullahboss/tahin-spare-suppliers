# Project Notes — tahin-spare-suppliers
> 6469 notes | Updated: 4/2/2026

## Safety Rules

- **NEVER** run `git clean -fd` or `git reset --hard` without checking `git log` and verifying commits exist.
- **NEVER** delete untracked files or folders blindly. Always backup or stash before bulk edits.

## Quick Reference
- 5966 warnings → see `.agent-mem/gotchas.md`
- 103 conventions → see `.agent-mem/patterns.md`
- Codebase map → see `.agent-mem/project-brief.md`
- Active work → see `.agent-mem/active-context.md`

## Read .agent-mem/gotchas.md before ANY changes

For full memory: `.agent-mem/`
For observation details: `.agent-mem/observations/`

## Available Tools (Use ON-DEMAND only — context in .agent-mem replaces startup calls)
- `smart_save(title, content, category)` — Save + auto-detect conflicts
- `batch_save(items[])` — Save multiple in 1 call
- `query(q)` — Search memory when debugging
- `find(query)` — Full-text search for details
- `errors()` — Check compiler errors after edits
- `read_lines(path, start, end)` — Read file sections
- `grep(pattern, dir)` — Find symbols without loading full files

> Do NOT call load() or warnings() at startup — read the .agent-mem files above instead.

---
*Auto-generated*

# Project Memory — tahin-spare-suppliers
> 6470 notes | Score threshold: >40

## Safety — Never Run Destructive Commands

> Dangerous commands are actively monitored.
> Critical/high risk commands trigger error notifications in real-time.

- **NEVER** run `rm -rf`, `del /s`, `rmdir`, `format`, or any command that deletes files/directories without EXPLICIT user approval.
- **NEVER** run `DROP TABLE`, `DELETE FROM`, `TRUNCATE`, or any destructive database operation.
- **NEVER** run `git push --force`, `git reset --hard`, or any command that rewrites history.
- **NEVER** run `npm publish`, `docker rm`, `terraform destroy`, or any irreversible deployment/infrastructure command.
- **NEVER** pipe remote scripts to shell (`curl | bash`, `wget | sh`).
- **ALWAYS** ask the user before running commands that modify system state, install packages, or make network requests.
- When in doubt, **show the command first** and wait for approval.

**Stack:** JavaScript

## 📝 NOTE: 1 uncommitted file(s) in working tree.\n\n## Important Warnings

- **gotcha in agent.md** — - > 6468 notes | Updated: 4/2/2026
+ > 6469 notes | Updated: 4/2/2026

- **gotcha in agent.md** — - > 6467 notes | Updated: 4/2/2026
+ > 6468 notes | Updated: 4/2/2026

- **gotcha in agent.md** — - > 6466 notes | Updated: 4/2/2026
+ > 6467 notes | Updated: 4/2/2026

- **gotcha in agent.md** — - > 6465 notes | Updated: 4/2/2026
+ > 6466 notes | Updated: 4/2/2026

- **gotcha in agent.md** — - > 6464 notes | Updated: 4/2/2026
+ > 6465 notes | Updated: 4/2/2026

- **gotcha in agent.md** — - > 6463 notes | Updated: 4/2/2026
+ > 6464 notes | Updated: 4/2/2026


## Project Standards

- what-changed in metadata.sqlite-shm — confirmed 4x
- what-changed in metadata.sqlite-wal — confirmed 4x
- what-changed in agent.md — confirmed 3x
- Updated schema Updated — confirmed 3x

## Recent Decisions

- Optimized Tahin — ensures atomic multi-step database operations

## Learned Patterns

- Always: what-changed in agent.md — confirmed 18x (seen 2x)
- Always: what-changed in agent.md — confirmed 18x (seen 3x)
- Always: what-changed in agent.md — confirmed 18x (seen 4x)
- Agent generates new migration for every change (squash related changes)
- Agent installs packages without checking if already installed

### 📚 Core Framework Rules: [czlonkowski/n8n-code-javascript]
# JavaScript Code Node

Expert guidance for writing JavaScript code in n8n Code nodes.

---

## Quick Start



### Essential Rules

1. **Choose "Run Once for All Items" mode** (recommended for most use cases)
2. **Access data**: `$input.all()`, `$input.first()`, or `$input.item`
3. **CRITICAL**: Must return `[{json: {...}}]` format
4. **CRITICAL**: Webhook data is under `$json.body` (not `$json` directly)
5. **Built-ins available**: $helpers.httpRequest(), DateTime (Luxon), $jmespath()

---

## Mode Selection Guide

The Code node offers two execution modes. Choose based on your use case:

### Run Once for All Items (Recommended - Default)

**Use this mode for:** 95% of use cases

- **How it works**: Code executes **once** regardless of input count
- **Data access**: `$input.all()` or `items` array
- **Best for**: Aggregation, filtering, batch processing, transformations, API calls with all data
- **Performance**: Faster for multiple items (single execution)



**When to use:**
- ✅ Comparing items across the dataset
- ✅ Calculating totals, averages, or statistics
- ✅ Sorting or ranking items
- ✅ Deduplication
- ✅ Building aggregated reports
- ✅ Combining data from multiple items

### Run Once for Each Item

**Use this mode for:** Specialized cases only

- **How it works**: Code executes **separately** for each input item
- **Data access**: `$input.item` or `$item`
- **Best for**: Item-specific logic, independent operations, per-item validation
- **Performance**: Slower for large datasets (multiple executions)



**When to use:**
- ✅ Each item needs independent API call
- ✅ Per-item validation with different error handling
- ✅ Item-specific transformations based on item properties
- ✅ When items must be processed separately for business logic

**Decision Shortcut:**
- **Need to look at multiple items?** → Use "All Items" mode
- **Each item completely independent?** → Use "Each Item" mode
- **Not sure?** → Use "All Items" mode (you can always loop inside)

---

## Data Access Patterns

### Pattern 1: $input.all() - Most Common

**Use when**: Processing arrays, batch operations, aggregations



### Pattern 2: $input.first() - Very Common

**Use when**: Working with single objects, API responses, first-in-first-out



### Pattern 3: $input.item - Each Item Mode Only

**Use when**: In "Run Once for Each Item" mode



### Pattern 4: $node - Reference Other Nodes

**Use when**: Need data from specific nodes in workflow



**See**: [DATA_ACCESS.md](DATA_ACCESS.md) ...
(truncated)

- [JavaScript/TypeScript] Use === not == (strict equality prevents type coercion bugs)
- [JavaScript/TypeScript] Use const by default, let when reassignment needed, never var

## Available Tools (ON-DEMAND only)
- `query(q)` — Deep search when stuck
- `find(query)` — Full-text lookup
> Context above IS your context. Do NOT call load() at startup.
