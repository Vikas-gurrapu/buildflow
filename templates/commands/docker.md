---
name: buildflow-docker
description: Docker scaffolding, container management, and image lifecycle for any project
allowed-tools: Read, Write, Bash, Grep, Glob
agent: architect
---

# /buildflow-docker

Docker scaffolding, management, and lifecycle operations. Generates optimized Dockerfiles and Compose configs for any detected language/framework, manages container builds and runs, and integrates with the BuildFlow ship/deploy pipeline.

## Usage
- `/buildflow-docker` — detect state and show Docker menu
- `/buildflow-docker scaffold` — generate Dockerfile + docker-compose.yml for this project
- `/buildflow-docker build` — build the image locally
- `/buildflow-docker run` — start services with docker-compose
- `/buildflow-docker stop` — stop running containers
- `/buildflow-docker logs [service]` — tail logs for a service
- `/buildflow-docker shell [service]` — open a shell in a running container
- `/buildflow-docker push [registry]` — tag and push image to a registry
- `/buildflow-docker scan` — security scan the built image (Trivy / docker scout)
- `/buildflow-docker clean` — remove dangling images and stopped containers

---

## Step 1: Detect Current State

```bash
# Check if Docker is installed and running
docker --version 2>/dev/null && docker info --format '{{.ServerVersion}}' 2>/dev/null

# Check what Docker files already exist
ls Dockerfile Dockerfile.* docker-compose.yml docker-compose.yaml docker-compose.*.yml .dockerignore 2>/dev/null

# Check for running containers for this project
docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null
```

Read `.buildflow/memory/light.md` for `framework`, `language`, `app_name`.

**Print state summary:**
```
Docker State
────────────
Docker installed:   YES [version] / NO ← install from docker.com
Compose available:  YES (plugin) / YES (standalone) / NO
Dockerfile:         EXISTS / MISSING
docker-compose.yml: EXISTS / MISSING
.dockerignore:      EXISTS / MISSING
Running containers: [N] / NONE
```

If no command given after state summary: show the menu and wait for user choice.

---

## Step 2: `scaffold` — Generate Dockerfile + Compose

### 2a: Detect Language and Framework
Read from `light.md` (set by `init`). If missing, auto-detect from project root files:
- `package.json` → Node.js/TypeScript (check for Next.js, React SPA, Express, NestJS, Fastify)
- `pom.xml` / `build.gradle` / `build.gradle.kts` → Java / Kotlin
- `requirements.txt` / `pyproject.toml` → Python (check for Django, FastAPI, Flask)
- `Gemfile` → Ruby (Rails vs Sinatra)
- `composer.json` → PHP (Laravel vs Symfony)
- `Cargo.toml` → Rust
- `go.mod` → Go
- `pubspec.yaml` → Dart / Flutter
- `Package.swift` → Swift
- `build.sbt` → Scala
- `.csproj` / `.sln` → C# / .NET

### 2b: Ask About Services Needed
```
What services does your app need?

  [1] App only (no database — static site, pure API client, etc.)
  [2] App + PostgreSQL
  [3] App + MySQL / MariaDB
  [4] App + MongoDB
  [5] App + Redis
  [6] App + PostgreSQL + Redis (common web app stack)
  [7] App + custom (describe what you need)
```

Also ask: "Do you need a local dev hot-reload setup? (yes/no)"

### 2c: Generate Dockerfile

Generate a production-grade, multi-stage Dockerfile appropriate for the language:

**Node.js / TypeScript:**
```dockerfile
# Stage 1 — deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2 — build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3 — runner (minimal)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# or: COPY --from=builder /app/.next ./.next  (Next.js)
USER appuser
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**Python (FastAPI / Flask / Django):**
```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim AS runner
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
RUN adduser --disabled-password --gecos "" appuser
COPY --from=builder /root/.local /home/appuser/.local
COPY . .
USER appuser
EXPOSE 8000
# FastAPI: CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
# Django:  CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
# Flask:   CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Java (Spring Boot with Maven):**
```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline -q
COPY src ./src
RUN ./mvnw package -DskipTests -q

FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/target/*.jar app.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Java / Kotlin (Gradle):**
```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY gradle/ gradle/
COPY gradlew build.gradle.kts settings.gradle.kts ./
RUN ./gradlew dependencies --no-daemon -q 2>/dev/null || true
COPY src ./src
RUN ./gradlew bootJar --no-daemon -q

FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/build/libs/*.jar app.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**C# / .NET:**
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder
WORKDIR /app
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runner
WORKDIR /app
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
COPY --from=builder /app/publish .
USER appuser
EXPOSE 8080
ENTRYPOINT ["dotnet", "[AppName].dll"]
```

**Go:**
```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/server

FROM scratch AS runner
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
```

**Rust:**
```dockerfile
FROM rust:1.78-slim AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src
COPY src ./src
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd -r -s /bin/false appuser
COPY --from=builder /app/target/release/[app-name] /usr/local/bin/app
USER appuser
EXPOSE 8080
CMD ["/usr/local/bin/app"]
```

**Ruby (Rails):**
```dockerfile
FROM ruby:3.3-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev nodejs && rm -rf /var/lib/apt/lists/*
COPY Gemfile Gemfile.lock ./
RUN bundle install --without development test
COPY . .
RUN bundle exec rake assets:precompile RAILS_ENV=production 2>/dev/null || true

FROM ruby:3.3-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 && rm -rf /var/lib/apt/lists/*
RUN adduser --disabled-password --gecos "" appuser
COPY --from=builder /app .
COPY --from=builder /usr/local/bundle /usr/local/bundle
USER appuser
EXPOSE 3000
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
```

**PHP (Laravel):**
```dockerfile
FROM php:8.3-fpm-alpine AS builder
WORKDIR /app
RUN apk add --no-cache composer nodejs npm
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader
COPY . .
RUN npm ci && npm run build 2>/dev/null || true

FROM php:8.3-fpm-alpine AS runner
WORKDIR /app
RUN adduser -D appuser
COPY --from=builder /app .
RUN chown -R appuser:appuser /app/storage /app/bootstrap/cache
USER appuser
EXPOSE 9000
CMD ["php-fpm"]
```

**Dart / Flutter (web build served via nginx):**
```dockerfile
FROM dart:stable AS builder
WORKDIR /app
COPY pubspec.* ./
RUN dart pub get
COPY . .
RUN dart compile exe bin/server.dart -o bin/server
# OR for Flutter web:
# RUN flutter build web --release

FROM debian:bookworm-slim AS runner
WORKDIR /app
RUN useradd -r appuser
COPY --from=builder /app/bin/server .
USER appuser
EXPOSE 8080
CMD ["./server"]
```

**Scala (sbt):**
```dockerfile
FROM sbtscala/scala-sbt:eclipse-temurin-21_1.10.0_3.4.1 AS builder
WORKDIR /app
COPY build.sbt project/ ./
RUN sbt update
COPY src ./src
RUN sbt assembly

FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/target/scala-*/*assembly*.jar app.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### 2d: Generate .dockerignore

Write a `.dockerignore` appropriate for the language:

```
# Common
.buildflow/
.git/
.github/
*.md
LICENSE

# Node.js
node_modules/
.npm/
dist/
.next/
out/

# Python
__pycache__/
*.pyc
*.pyo
.venv/
venv/
.pytest_cache/
*.egg-info/

# Java / Kotlin / Scala
target/
build/
.gradle/
*.class

# C# / .NET
bin/
obj/
*.user

# Ruby
vendor/bundle/
.bundle/
log/
tmp/
*.log

# PHP
vendor/
.env

# Go
# (Go binaries are committed — nothing to ignore beyond common)

# Rust
target/

# Dart / Flutter
build/
.dart_tool/
.pub-cache/

# Swift
.build/
*.xcodeproj/xcuserdata/

# All
.env
.env.*
!.env.example
```

### 2e: Generate docker-compose.yml

Based on the services selected in Step 2b:

```yaml
# docker-compose.yml — generated by BuildFlow for [app_name]
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    ports:
      - "[host_port]:[container_port]"
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
      redis:           # remove if no redis
        condition: service_started
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:[port]/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  db:                  # remove if no database
    image: postgres:16-alpine   # or mysql:8, mongo:7, etc.
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: ${DB_USER:-appuser}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
      POSTGRES_DB: ${DB_NAME:-appdb}
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-appuser}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:               # remove if no redis
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  db_data:
  redis_data:
```

**Also generate `docker-compose.dev.yml`** (for local dev with hot-reload, if user requested):
```yaml
# docker-compose.dev.yml — hot-reload dev overlay
# Usage: docker compose -f docker-compose.yml -f docker-compose.dev.yml up
services:
  app:
    build:
      target: builder   # use the builder stage with dev deps
    command: [language-specific dev command]
    # Node.js: npm run dev
    # Python: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    # Ruby:   bundle exec rails server -b 0.0.0.0
    # PHP:    php artisan serve --host=0.0.0.0
    # Go:     air  (github.com/cosmtrek/air)
    # Rust:   cargo watch -x run
    volumes:
      - .:/app
      - /app/node_modules   # node_modules exclusion (Node only)
    environment:
      - NODE_ENV=development
```

### 2f: Scaffold Summary
```
Docker Scaffold Complete
────────────────────────
Dockerfile:           ✓ written  (multi-stage, [language], [N] stages)
.dockerignore:        ✓ written
docker-compose.yml:   ✓ written  (app + [services])
docker-compose.dev.yml: ✓ written  (hot-reload dev overlay)

Next steps:
  1. Copy .env.example to .env and fill in secrets
  2. Run: /buildflow-docker build
  3. Run: /buildflow-docker run
```

Write `container_runtime: docker` to `light.md`.

---

## Step 3: `build` — Build Image

```bash
docker compose build --no-cache
# OR if no compose file:
docker build -t [app_name]:latest .
```

Print: build output tail (last 10 lines). On success:
```
Image built: [app_name]:latest
Size: [X] MB
Build time: [N]s
```

On failure: print full build error, suggest fix based on error pattern (e.g., "COPY failed — file not found: check .dockerignore isn't excluding required files").

---

## Step 4: `run` — Start Services

```bash
docker compose up -d
```

Wait up to 30s for health checks to pass, then:
```bash
docker compose ps
```

```
Services Running
────────────────
app    → localhost:[port]   HEALTHY
db     → localhost:5432     HEALTHY
redis  → localhost:6379     RUNNING
```

If any service fails to start: `docker compose logs [service] --tail=30` and print the error.

---

## Step 5: `stop` — Stop Services

```bash
docker compose down
```

Print: "All containers stopped. Volumes preserved (use `docker compose down -v` to remove data volumes)."

---

## Step 6: `logs` — Tail Logs

```bash
docker compose logs [service] --follow --tail=50
```

If no service specified: `docker compose logs --follow --tail=20` (all services).

---

## Step 7: `shell` — Open Shell

```bash
docker compose exec [service] sh
# or bash if available:
docker compose exec [service] bash 2>/dev/null || docker compose exec [service] sh
```

If service not specified: default to `app`.

---

## Step 8: `push` — Tag and Push to Registry

Ask: "Which registry?"
```
  [1] Docker Hub       docker.io/[username]/[app_name]
  [2] AWS ECR          [account].dkr.ecr.[region].amazonaws.com/[app_name]
  [3] Google GCR       gcr.io/[project]/[app_name]
  [4] GitHub Packages  ghcr.io/[org]/[app_name]
  [5] Custom registry  [enter URL]
```

Then:
```bash
# Docker Hub
docker tag [app_name]:latest [username]/[app_name]:[tag]
docker push [username]/[app_name]:[tag]

# AWS ECR
aws ecr get-login-password --region [region] | docker login --username AWS --password-stdin [account].dkr.ecr.[region].amazonaws.com
docker tag [app_name]:latest [ecr_url]:[tag]
docker push [ecr_url]:[tag]

# GitHub Packages
echo $GITHUB_TOKEN | docker login ghcr.io -u [username] --password-stdin
docker tag [app_name]:latest ghcr.io/[org]/[app_name]:[tag]
docker push ghcr.io/[org]/[app_name]:[tag]
```

---

## Step 9: `scan` — Security Scan

Prefer `docker scout` (bundled with Docker Desktop) or Trivy:

```bash
# Docker Scout (Docker Desktop / Docker Hub)
docker scout cves [app_name]:latest --format sarif 2>/dev/null

# Trivy (open source, install separately)
trivy image --severity HIGH,CRITICAL [app_name]:latest 2>/dev/null

# Fallback: docker scan (deprecated but still available)
docker scan [app_name]:latest 2>/dev/null
```

**Report format:**
```
Container Security Scan — [app_name]:latest
────────────────────────────────────────────
🔴 Critical CVEs:  [N]
🟡 High CVEs:      [N]
🟠 Medium CVEs:    [N]

Critical findings:
  CVE-XXXX-XXXX  [package] [version]  → upgrade to [version]
  CVE-XXXX-XXXX  [package] [version]  → no fix available (consider base image change)

Base image: [image:tag]
Suggestion: [suggest slimmer/newer base if large CVE count — e.g., "switch from debian to alpine"]
```

**Critical CVEs found → append to `.buildflow/security/DEBT.md`.**
Write scan report to `.buildflow/security/reports/docker-scan-[date].md`.

---

## Step 10: `clean` — Remove Dangling Resources

```bash
# Show what will be removed
docker images --filter dangling=true
docker ps -a --filter status=exited

# Remove
docker image prune -f
docker container prune -f
```

Print: "Removed [N] dangling images ([X] MB freed), [N] stopped containers."

---

## Docker Integration With BuildFlow Pipeline

### At `/buildflow-build` wave completion (if Dockerfile exists):
After each wave, verify the Docker image still builds:
```bash
docker build -q -t [app_name]:wave-check . 2>&1 | tail -3
docker rmi [app_name]:wave-check -f 2>/dev/null
```
If build fails: WARN (non-blocking) — "⚠ Docker build failed after this wave. Run `/buildflow-docker build` to diagnose."

### At `/buildflow-ship` Gate 3 (if Dockerfile exists):
Blocking Docker build check — see ship.md Gate 3 Docker section.

### At `/buildflow-deploy`:
If `container_runtime: docker` in `light.md`: use Docker deployment path in deploy.md.

---

## Token cost report (print at end of docker)

Measure actual cost before printing:
1. Sum character counts of all Context Packet files loaded ÷ 4 = input tokens
2. Estimate output ÷ 4 = output tokens
3. Update `state.md → session_tokens_used`

Default output (minimal):
```
Docker [sub-command] complete — [brief result]
Session: ~[N]K tokens
```

Verbose (only if `verbose_context: true`):
```
Token Cost — /buildflow-docker
──────────────────────────────
Context loaded:    ~[N]K tokens
Output generated:  ~[N]K tokens
This command:      ~[N]K tokens
Session total:     ~[N]K tokens   (since [session_start])
```

## Guided Next Step

After `scaffold`:
```
──────────────────────────────────────────────────
→ Next:  /buildflow-docker build
   Why:  Dockerfile ready — build the image to verify it compiles cleanly
──────────────────────────────────────────────────
Session: ~[N]K tokens
```

After `build`: `→ Next: /buildflow-docker run` (start container locally).
After `scan` with findings: `→ Next: fix CVEs listed in DEBT.md, then re-run /buildflow-docker scan`.
After `push`: `→ Next: /buildflow-deploy` (image is in registry — trigger deployment).

## Token Budget: ~10K (scaffold) / ~5K (run/build/logs/stop) / ~15K (scan)
