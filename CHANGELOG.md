# Changelog

All notable changes to buildflow-dev are documented here.

---

## [7.1.0] — 2026-05-29

### Added

- **`/buildflow-workspace onboard`** — new sub-command that discovers all sub-repos under the workspace root (by detecting `package.json`, `go.mod`, `Cargo.toml`, `pom.xml`, etc.), presents a multiselect list with onboard status per repo, and runs `/buildflow-onboard` for each selected repo sequentially. Shortcuts: `A` (all), `N` (not-onboarded only), `R` (force full re-onboard). Already-onboarded repos auto-use `--update` mode.

- **Multi-repo example** in README — practical 3-repo (api/web/shared) walkthrough showing workspace onboard → map → impact analysis flow.

- **Multiselect for `/buildflow-settings` main menu** — enter comma-separated numbers (`1,3,7`) to change multiple settings in one pass instead of cycling through the menu repeatedly.

- **Multiselect for `/buildflow-settings` Workflow Toggles [13]** — all 5 toggles shown at once with current values; select which to change together and set new values inline.

- **Multiselect for `/buildflow-onboard --update`** — drift classified into areas (`structure`, `modules`, `dependencies`, `routes`, `locale`); multiselect prompt shows only affected areas so you re-run the minimum needed.

### Changed

- **`/buildflow-check` Manual UAT (Step 5b)** — rewritten from "dump all use cases at once" to **one-by-one sequential flow**: each use case shows individually with `[P]ass / [F]ail / [S]kip`. On `[F]`, captures what broke, offers `[X] Fix now` (pause + fix + re-present) or `[C] Continue`. Ends with a UAT summary and ship readiness verdict.

- **`/buildflow-workspace onboard --update`** — same discovery flow as `onboard`, but runs `--update` for already-onboarded repos by default.

- README version tagline updated to v7.1.

---

## [7.0.6] — 2026-05-25

### Fixed

- Locale detection fix: `intel.json` locale fields now write correctly when no locale support is found (sets `status: NO` with `confidence: high` instead of leaving `status: UNKNOWN`).

---

## [7.0.5] — 2026-05-24

### Fixed

- `switch-epic` added to `commandNames` in `install.js` and `COMMAND_NAMES` in `uninstall.js` — was missing, so the command was not being installed.

---

## [7.0.4] — 2026-05-23

### Changed

- Renamed phases to epics throughout all templates and scaffold files (`phases/` → `epics/`, `phase` → `epic` in STATE.md shape, command names).

---

## [7.0.3] — 2026-05-22

### Changed

- Merged planning into spec — `REQUIREMENTS.md` + `DESIGN.md` → `SPEC.md`; `DECISIONS.md` → `CONTEXT.md`.
- Made `discuss` post-spec (was pre-spec in v7.0.0–7.0.2).

---

## [7.0.0] — 2026-05-20

### Added

- **`/buildflow-discuss`** — pre-plan decision workshop with parallel Researchers per option, locked decisions with confidence scores (1–5), auto-patches spec on confirmation.
- **`/buildflow-switch-epic`** — pause active epic and switch to another; full context preserved in `paused_epics[]` in `STATE.md`.
- **`/buildflow-ui-spec`** — locked UI design contract before any frontend phase; detects existing CSS framework.
- **`/buildflow-ui-review`** — 6-dimension UI audit (color, typography, spacing, component coverage, responsive, a11y).
- **Global learnings store** — `~/.buildflow/learnings/global.md` written at every milestone, surfaced at session start.
- **Workflow toggles + yolo mode** — `skip_prompts`, `require_think`, `require_check`, `research_depth`, `auto_wave_retry` in `PREFERENCES.md`.
- **`/buildflow-settings`** — 13-item interactive settings menu.
- **`/buildflow-complete-epic`** — milestone archival, global learnings write, release tag, state reset.
- **Wave-level task files** — `PLAN.md` is now a lightweight index; per-wave task lists live in `waves/wave-N.md`. Build loads only the active wave.
- **Codebase folder consolidation** — 12 files → 6: `CODEBASE.md`, `PATTERNS.md`, `DEPENDENCIES.md`, `RISKS.md`, `TESTING.md`, `intel.json`.
- **Epic folder consolidation** — 13 files → 10 + `waves/`: `CONTEXT.md`, `SPEC.md`, `ACCEPTANCE.md`, `CHECK.md`, `DEBT.md` and standard outputs.
- **Epic/hotfix routing** — when a debug or hotfix session starts with an active epic, agent asks `[E]` (file under epic) or `[I]` (independent fix).
- **Density-adjusted token formula** — `Math.ceil((chars / (baseDivisor − densityPenalty)) × 1.05)` with file-type buckets; replaces flat ÷4 estimate.
- **Scope-reduction detection** in `/buildflow-build` and `/buildflow-check` — ACs dropped from plan surface as WARN or BLOCK.
- **15-language runtime support** — added Elixir, C/C++, Haskell to detection.
- **CI/CD infrastructure** — `.github/` workflows for test, lint, template validation, security audit.

### Changed

- Spec generation now writes `SPEC.md` (merged requirements + design), `ACCEPTANCE.md`, `PLAN.md` (index), and per-wave files in one pass.
- `/buildflow-check --strict` now reads from `SPEC.md` instead of old `DESIGN.md`.
- `CHECK.md` replaces `VERIFICATION.md` + `COVERAGE.md` everywhere.

---

## [6.x] — prior versions

See git log for earlier changes. v6.0 introduced epic STATE.md resume, spec governance (versioned specs, approval audit trail, amendment gate), git permission system, build telemetry gates, file ownership maps, thin-slice ordering, git worktree isolation, 5-lens onboarding, and queryable intel.json.
