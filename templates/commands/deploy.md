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
- `light.md → container_runtime: docker` (set by `/buildflow-docker`)
- `docker-compose.yml` present → Docker Compose deployment available

Classify the deploy path:

| Detected | Deploy path |
|----------|------------|
| `vercel.json` or `vercel` CLI | Vercel platform |
| `netlify.toml` or `netlify` CLI | Netlify platform |
| `fly.toml` or `flyctl` CLI | Fly.io |
| `railway.json` or `railway` CLI | Railway |
| `Dockerfile` + registry configured | Docker image push + remote pull |
| `docker-compose.yml` on remote host | Docker Compose remote deploy |
| `.github/workflows/` with deploy job | CI/CD managed — guide user to trigger |
| None detected | Manual guidance |

## Step 4: Environment Confirmation
Show:
- Target environment (staging / production)
- Deploy method detected
- What will change (git diff summary)

Ask for explicit confirmation before proceeding, especially for production.

## Step 5: Deploy

### Platform deploy (Vercel / Netlify / Fly / Railway):
```bash
vercel --prod
netlify deploy --prod
flyctl deploy
railway up
```

### Docker image deploy path (when `container_runtime: docker`):

**5a — Build and tag:**
```bash
docker build -t [app_name]:[tag] .
docker tag [app_name]:[tag] [registry]/[app_name]:[tag]
```

**5b — Security scan before push (run `/buildflow-docker scan` inline):**
```bash
docker scout cves [app_name]:[tag] --exit-code 2>/dev/null || trivy image --severity CRITICAL --exit-code 1 [app_name]:[tag] 2>/dev/null
```
Critical CVEs found → BLOCK push. High CVEs → WARN, ask confirmation.

**5c — Push to registry:**
```bash
docker push [registry]/[app_name]:[tag]
```

**5d — Deploy on target host (choose method):**

SSH + docker-compose pull:
```bash
ssh [user]@[host] "cd [app_dir] && docker compose pull && docker compose up -d --remove-orphans"
```

Kubernetes rollout:
```bash
kubectl set image deployment/[app_name] [app_name]=[registry]/[app_name]:[tag]
kubectl rollout status deployment/[app_name]
```

Fly.io with Docker:
```bash
flyctl deploy --image [registry]/[app_name]:[tag]
```

**5e — Run database migrations (if schema changed this phase):**
```bash
# Docker exec migration
docker compose exec app [migration command]
# Examples:
# Node.js Prisma:  npx prisma migrate deploy
# Django:          python manage.py migrate
# Rails:           bundle exec rake db:migrate
# Java Spring:     handled at app startup (Flyway/Liquibase)
# .NET EF Core:    dotnet ef database update
```

## Step 6: Post-Deploy Verification
- Confirm deploy succeeded (exit code, deploy URL)
- Ping health check endpoint:
  ```bash
  curl -sf https://[deploy_url]/health || wget -qO- https://[deploy_url]/health
  ```
- Check container is running: `docker compose ps` (if Docker deploy)
- Check for errors in deploy logs: `docker compose logs app --tail=20`

## Step 7: Update State
```yaml
last_deploy: [today]
environment: [staging/production]
deployed_phase: [N]
deploy_url: [url if available]
deploy_method: [vercel / netlify / fly / docker / compose / manual]
docker_image: [registry/app_name:tag if Docker deploy]
```

## --dry-run Flag
Shows the pre-flight checklist results and what deploy command would run — without deploying.

## Token Budget: ~15K
