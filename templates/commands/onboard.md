---
name: buildflow-onboard
description: Deep codebase analysis â€” maps modules, patterns, hotspots, features, import graph, and writes all knowledge files to .buildflow/codebase/
allowed-tools: Read, Write, Bash, Glob, Grep
agent: cartographer
---

# /buildflow-onboard

Deep one-time analysis of an existing codebase. Produces 5 knowledge files that every other BuildFlow command references. All other agents load these files rather than re-scanning the codebase.

## When to run
- First time using BuildFlow on an existing project
- After a major refactor or framework migration
- `--update` flag: incremental refresh after significant changes
- `--paths src/auth,packages/ui` flag: scoped remap of specific paths

## Usage
- `/buildflow-onboard` â€” full analysis + write all knowledge files
- `/buildflow-onboard --update` â€” refresh changed files only
- `/buildflow-onboard --paths src/auth,packages/ui` â€” remap specific paths
- `/buildflow-onboard --query locale` â€” search knowledge files for a term without rewriting

---

## OUTPUT CONTRACT â€” Read this first

This command MUST produce the following files before it is complete. The analysis and the file writes are not separable â€” each analysis section writes its file immediately. Do not defer writes to the end.

Required output files:
```
.buildflow/codebase/CODEBASE.md     â† module map, entry points, folder roles, tech stack, physical layout
.buildflow/codebase/PATTERNS.md     â† code patterns, architectural style, feature inventory, locale support
.buildflow/codebase/DEPENDENCIES.md â† package dependencies, external integrations, import graph, fan-in/out
.buildflow/codebase/RISKS.md        â† high-risk files, code quality concerns, debt, fragile flows
.buildflow/codebase/TESTING.md      â† test framework, layout, coverage gaps
.buildflow/codebase/intel.json      â† machine-readable index for other commands
```

If any write fails, stop immediately and report the file path and error. Do not continue to the next step.

---

## Step 1: Setup

```bash
mkdir -p .buildflow/codebase .buildflow/memory
```

Check for prior state:
- If `.buildflow/codebase/CODEBASE.md` already exists and `--update` is NOT passed: ask "Full re-onboard or incremental update?" â€” in non-interactive context, default to incremental.
- If `--update`: identify changed files since last `drift_baseline.recorded_at` in `intel.json`, classify them into drift areas, then present a **multiselect** of affected areas. If `--paths` is also given, skip the multiselect and use those paths directly.

  **Drift area classification:**

  | Changed file type | Drift area | Steps to re-run |
  |---|---|---|
  | `locales/`, `i18n/`, `*.po/arb/resx/strings.xml` | `locale` | Step 9c â†’ PATTERNS.md + intel.json |
  | Route / screen / page / handler files | `routes` | Step 9a â†’ PATTERNS.md |
  | Source files (general) | `modules` | Steps 4â€“6 â†’ import graph, load-bearing, risk |
  | Dependency files (`package.json`, `go.mod`, etc.) | `dependencies` | Step 8 â†’ CODEBASE.md, DEPENDENCIES.md |
  | Structural change (new dirs, new entry points) | `structure` | Step 3 â†’ CODEBASE.md |

  **Multiselect prompt (shown when drift is detected):**
  ```
  Drift detected since last onboard ([date])
  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  Select areas to refresh (comma-separated, or "all"):

    [1]  structure    â€” [N] new directories or entry points
    [2]  modules      â€” [N] source files changed
    [3]  dependencies â€” package manifest changed
    [4]  routes       â€” [N] route/screen/page files changed
    [5]  locale       â€” locale catalog or i18n files changed

  Your selection (e.g. 1,3 or "all"):
  ```

  Re-run only the steps corresponding to the selected drift areas. If no drift is detected in any area, print "No drift detected since [date] â€” onboard data is current." and exit.
- If `--query [term]`: search `.buildflow/codebase/*.md` and `intel.json` for the term, print matches, and exit without rewriting any files.
- If `--paths [paths]`: validate paths are repo-relative, don't contain `..` or shell metacharacters, then restrict all scans to those paths.

---

## Step 2: Language & Framework Detection

Run this first â€” the language determines which grep patterns to use in later steps.

```bash
# Detect project files
ls package.json requirements.txt Cargo.toml go.mod pom.xml build.gradle build.gradle.kts pubspec.yaml Package.swift build.sbt Gemfile composer.json 2>/dev/null
```

Identify: primary language, framework, package manager, runtime version.

Stack analysis feeds into CODEBASE.md (written in Step 12 after all analysis is complete).

---

## Step 3: Structural Analysis

Run these scans:

```bash
# Entry points
find . \( -name "main.*" -o -name "index.*" -o -name "app.*" \) | grep -v node_modules | grep -v ".buildflow" | head -20

# Directory structure
find . -maxdepth 3 -type d | grep -v node_modules | grep -v ".git" | grep -v ".buildflow" | head -40

# Layer markers
find . \( -path "*/controllers/*" -o -path "*/services/*" -o -path "*/models/*" -o -path "*/repositories/*" -o -path "*/routes/*" -o -path "*/components/*" \) | grep -v node_modules | head -20

# File count by type
find src/ app/ lib/ -type f 2>/dev/null | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -10
```

Identify: entry points, top-level folder responsibilities, architectural pattern (MVC / layered / hexagonal / feature-based / flat).

Structural analysis feeds into CODEBASE.md (written in Step 12 after all analysis is complete).

---


## Step 4 onwards: Deep Analysis Module

→ **Load module now:** Read .claude/commands/buildflow-onboard-analyze.md and execute Steps 4–12. Return when all 6 knowledge files are written to .buildflow/codebase/.
