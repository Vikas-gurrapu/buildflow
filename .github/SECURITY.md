# Security Policy

BuildFlow is a developer workflow tool that installs project-local instructions, command files, and `.buildflow/` state into user repositories. Security reports are taken seriously because BuildFlow may run inside active codebases and interact with AI coding tools, git workflows, and local project files.

## Supported Versions

Security fixes are provided for the latest major version. Older major versions may receive fixes only when the issue is severe and the patch is low risk.

| Version | Supported |
| ------- | --------- |
| 6.x     | Yes       |
| 5.x     | Critical fixes only |
| 4.x     | No        |
| 1.x     | No        |

Users should upgrade to the latest published version before reporting a bug unless the vulnerability prevents upgrading.

```bash
npx buildflow-dev@latest update
```

## Reporting a Vulnerability

Please do not report security vulnerabilities in public issues, pull requests, or discussions.

Use GitHub's private vulnerability reporting if it is enabled for this repository:

`https://github.com/Vikas-gurrapu/buildflow/security/advisories/new`

If private vulnerability reporting is not available, email the maintainer listed in `package.json`.

Please include:

- A clear description of the vulnerability.
- The affected BuildFlow version.
- Your operating system and shell.
- The command or workflow involved, such as `init`, `install`, `update`, `audit`, or a `/buildflow-*` command.
- A minimal reproduction, proof of concept, or affected file path if safe to share.
- Whether the issue requires a malicious package, malicious repository content, untrusted contributor input, or only normal usage.

Do not include real secrets, production tokens, private repository contents, or customer data in the report.

## Response Expectations

The maintainer aims to:

- Acknowledge valid security reports within 72 hours.
- Triage severity and reproducibility within 7 days.
- Provide a remediation plan, workaround, or decline reason after triage.
- Publish a patched npm release and GitHub advisory when appropriate.

Timelines may vary for complex issues, but reporters will be kept updated when a report is accepted.

## Scope

Examples of in-scope issues:

- Arbitrary file write or overwrite outside the intended project/config locations.
- Command injection through project names, paths, package metadata, or generated command files.
- Unsafe handling of secrets, tokens, environment variables, or `.buildflow/` state.
- Supply-chain risks in install/update flows.
- Permissions bypasses in generated workflow or agent instructions.
- Unsafe default behavior that could modify user code or git history without consent.

Examples generally out of scope:

- Vulnerabilities in third-party AI tools themselves.
- Social engineering attacks that do not exploit BuildFlow behavior.
- Reports requiring already-compromised maintainer credentials.
- Generic dependency alerts without an exploitable BuildFlow impact.

## Disclosure

Please allow time for a fix before public disclosure. Once a patch is available, the maintainer may publish a GitHub Security Advisory, release notes, and upgrade instructions.
