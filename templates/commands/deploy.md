---
name: buildflow-deploy
description: Deploy to staging or production with pre-flight checks
allowed-tools: Read, Write, Bash, Grep, Glob
agent: strategist
---

# /buildflow-deploy

Pre-flight checks and deployment orchestration. Ensures the build is safe to deploy before pushing to any environment.

## Usage
- `/buildflow-deploy` — deploy to default environment
- `/buildflow-deploy staging` — deploy to staging
- `/buildflow-deploy production` — deploy to production (stricter gate)
- `/buildflow-deploy --dry-run` — show what would happen without deploying

## Step 1: Load Context
Read `.buildflow/core/state.md` for current phase and status.
Read `.buildflow/memory/light.md` for project framework and deploy config.

## Step 2: Pre-flight Gate

**Always required:**
- [ ] `/buildflow-test` passed (or confirm manually)
- [ ] `/buildflow-audit --pre-ship` passed (no critical secrets or vulnerabilities)
- [ ] No uncommitted changes (`git status` clean)
- [ ] On correct branch (not committing directly to main unless intentional)

**Production only (additional):**
- [ ] `/buildflow-check` passed
- [ ] All tests passing including integration
- [ ] Environment variables verified for target environment
- [ ] Database migrations reviewed if schema changed

If any gate fails: stop and report what needs to be resolved.

## Step 3: Detect Deploy Setup
Check for:
- `package.json` scripts: `deploy`, `deploy:staging`, `deploy:prod`
- Deployment config files: `vercel.json`, `netlify.toml`, `fly.toml`, `railway.json`, `Dockerfile`
- CI/CD config: `.github/workflows/`, `.gitlab-ci.yml`
- Cloud CLI tools: `vercel`, `netlify`, `flyctl`, `railway`, `heroku`

## Step 4: Environment Confirmation
Show:
- Target environment (staging / production)
- Deploy method detected
- What will change (git diff summary)

Ask for explicit confirmation before proceeding, especially for production.

## Step 5: Deploy
Run the detected deploy command or guide the user through manual steps if no automation is detected.

```bash
# Examples depending on detected setup:
vercel --prod
netlify deploy --prod
flyctl deploy
railway up
```

## Step 6: Post-Deploy Verification
- Confirm deploy succeeded (exit code, deploy URL)
- Run a smoke test if possible (ping health endpoint, load the app URL)
- Check for errors in deploy logs

## Step 7: Update State
```yaml
last_deploy: [today]
environment: [staging/production]
deployed_phase: [N]
deploy_url: [url if available]
```

## --dry-run Flag
Shows the pre-flight checklist results and what deploy command would run — without deploying.

## Token Budget: ~15K
