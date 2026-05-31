# Contributing to BuildFlow

BuildFlow is an open source project and contributions are welcome from anyone — developers across different stacks, workflows, and threat models make it better for everyone.

---

## Ways to Contribute

- **Bug reports** — something broken, behaving unexpectedly, or producing wrong output
- **Feature requests** — a workflow need or command flag that doesn't exist yet
- **New slash commands** — a dev workflow pattern worth encoding as a `/buildflow-*` command
- **AI tool integrations** — support for a tool not yet in the supported list
- **Security findings** — see [Security](#security) below
- **Documentation fixes** — incorrect descriptions, outdated examples, missing flags

---

## Before You Start

For anything beyond a small fix, open an issue first and describe what you're trying to do. This avoids duplicate work and lets maintainers flag if something conflicts with the roadmap before you invest time in it.

For small fixes (typos, broken examples, wrong flag descriptions) — just open a PR directly.

---

## Development Setup

```bash
git clone https://github.com/Vikas-gurrapu/buildflow.git
cd buildflow
npm install
node bin/buildflow.js --help
```

No build step. Source files run directly — ES Modules only, Node 18+.

---

## Project Conventions

- **ES Modules only** — use `import/export`, never `require()`
- **Node 18+ compatibility** — use `dirname(fileURLToPath(import.meta.url))`, not `import.meta.dirname`
- **No TypeScript, no bundler** — zero build step, source runs directly
- **Lazy command imports** — `bin/buildflow.js` uses `() => import(...)` for fast startup
- **No comments explaining what code does** — name things clearly instead
- **Post-change testing only** — add/update tests after implementation, focused on touched files

---

## Adding a New Slash Command

1. Create `templates/commands/<name>.md` with frontmatter + numbered steps
2. Add the name to `commandNames` in `loadCommandTemplates()` in [`src/commands/install.js`](src/commands/install.js) and to `COMMAND_NAMES` in [`src/commands/uninstall.js`](src/commands/uninstall.js)
3. If it is a major epic command, add an Epic State Resume step that reads and updates `.buildflow/epics/[epic]/STATE.md`
4. Add it to the quick reference table in [`templates/CLAUDE.md`](templates/CLAUDE.md)
5. Document it in the AI Slash Commands section of README.md

---

## Adding a New AI Tool Integration

1. Add an entry to the `TOOLS` object in [`src/commands/install.js`](src/commands/install.js)
2. Implement `detect()`, `installGlobal()`, `installLocal()`, and `triggerNote`
3. Ensure install output includes update checks, Folder Access Guard instructions, and epic `STATE.md` resume rules
4. Add it to the Supported AI Tools table in README.md

---

## Pull Request Process

- Keep PRs focused — one concern per PR
- Reference the issue your PR addresses
- Update README.md and `templates/CLAUDE.md` if your change affects documented behavior
- All PRs require at least one review before merge — no direct pushes to main
- CI runs template validation and a security audit on every PR

---

## Security

Do not report security vulnerabilities in public issues or PRs.

Use GitHub's private vulnerability reporting:
`https://github.com/Vikas-gurrapu/buildflow/security/advisories/new`

See [SECURITY.md](.github/SECURITY.md) for full scope, response expectations, and disclosure policy.

---

## Code of Conduct

Be direct, be specific, assume good intent. Feedback on code and ideas is always welcome. Personal attacks are not.

---

## License

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
