# CI/CD Pipeline Guide

Complete guide for the Continuous Integration and Continuous Deployment pipelines in WasteFi Backend.

## Table of Contents

- [Overview](#overview)
- [CI Pipeline](#ci-pipeline)
- [CD Pipeline](#cd-pipeline)
- [Workflow Triggers](#workflow-triggers)
- [Environment Setup](#environment-setup)
- [Secrets Configuration](#secrets-configuration)
- [Deployment Environments](#deployment-environments)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

WasteFi Backend uses **GitHub Actions** for CI/CD automation with the following workflows:

- **CI (Continuous Integration)** - Lint, test, build, security scan
- **CD (Continuous Deployment)** - Deploy to staging/production
- **Scheduled Backups** - Daily database backups
- **Dependency Review** - Automated dependency scanning
- **Docker Security Scan** - Container vulnerability scanning

### Pipeline Architecture

```
┌─────────────┐
│   Git Push  │
└──────┬──────┘
       │
       ├─► CI Pipeline ──► Lint ──► Test ──► Build ──► Security ──► Docker Build
       │                                                                    │
       │                                                                    ✓
       └─► CD Pipeline ──► Build Image ──► Push to Registry ──► Deploy ──► Health Check
```

## CI Pipeline

### Workflow: `.github/workflows/ci.yml`

Runs on every push and pull request to `main` and `develop` branches.

### Jobs

#### 1. Lint
- Run ESLint
- Check Prettier formatting
- **Duration**: ~1 minute

#### 2. Test
- Setup PostgreSQL and Redis services
- Run database migrations
- Execute test suite with coverage
- Upload coverage to Codecov
- **Duration**: ~3-5 minutes

#### 3. Build
- Install production dependencies
- Generate Prisma Client
- Compile TypeScript
- Upload build artifacts
- **Duration**: ~2 minutes

#### 4. Security
- Run `npm audit`
- Snyk security scan
- Check for vulnerabilities
- **Duration**: ~1-2 minutes

#### 5. Docker
- Build Docker image
- Verify image builds successfully
- Cache layers for faster builds
- **Duration**: ~2-3 minutes

#### 6. Notify
- Check overall pipeline status
- Send notifications (optional)
- **Duration**: <1 minute

### Total CI Duration
**~10-15 minutes** for full pipeline

### Example Run

```bash
✓ Lint Code (1m 15s)
✓ Run Tests (4m 32s)
✓ Build Application (2m 05s)
✓ Security Scan (1m 48s)
✓ Build Docker Image (2m 55s)
✓ Notify Status (12s)

Total: 12 minutes 47 seconds
```

## CD Pipeline

### Workflow: `.github/workflows/cd.yml`

Runs on:
- Push to `main` branch
- Git tags (e.g., `v1.0.0`)
- Manual workflow dispatch

### Jobs

#### 1. Build and Push
- Build Docker image
- Tag with version/commit SHA
- Push to GitHub Container Registry
- **Duration**: ~3-5 minutes

#### 2. Deploy to Staging
- Triggered on `develop` branch push
- SSH to staging server
- Pull latest code
- Update Docker containers
- Run database migrations
- Wait for health check
- Run smoke tests
- **Duration**: ~3-5 minutes

#### 3. Deploy to Production
- Triggered on version tags (e.g., `v1.0.0`)
- Create database backup
- SSH to production server
- Deploy using deployment script
- Wait for health check
- Run smoke tests
- Create GitHub release
- **Duration**: ~5-7 minutes

#### 4. Rollback
- Runs only on deployment failure
- Automatically reverts to previous version
- **Duration**: ~2 minutes

#### 5. Notify
- Send deployment status notification
- Slack/Discord integration (optional)
- **Duration**: <1 minute

### Deployment Flow

```
main branch push → CI passes → Build Docker Image → Deploy to Staging → Tests → Deploy to Production → Health Check → Success!
```

## Workflow Triggers

### Automatic Triggers

| Event | Workflows Triggered | Branches |
|-------|---------------------|----------|
| Push | CI, CD | main, develop |
| Pull Request | CI, Dependency Review | main, develop |
| Tag Push (v*) | CD (Production) | - |
| Schedule (Daily 2 AM) | Database Backup | - |
| Schedule (Weekly) | Docker Security Scan | - |

### Manual Triggers

```bash
# Trigger deployment manually
gh workflow run cd.yml -f environment=production

# Trigger backup manually
gh workflow run cron-backup.yml

# View workflow runs
gh run list

# View specific run logs
gh run view <run-id>
```

## Environment Setup

### GitHub Repository Settings

#### 1. Enable GitHub Actions

```
Settings → Actions → General → Allow all actions
```

#### 2. Configure Environments

Navigate to: `Settings → Environments`

**Create Environments:**
- `staging` - Auto-deploy on develop push
- `production` - Manual approval required

**Environment Protection Rules (Production):**
- ✅ Required reviewers (1-2 people)
- ✅ Wait timer: 0 minutes
- ✅ Deployment branches: main, tags

#### 3. Enable GitHub Packages

```
Settings → Actions → General → Workflow permissions
→ Read and write permissions
```

## Secrets Configuration

### Required Secrets

Navigate to: `Settings → Secrets and variables → Actions`

#### Deployment Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `STAGING_HOST` | Staging server IP/domain | `staging.wastefi.com` |
| `STAGING_USER` | SSH username | `deploy` |
| `STAGING_SSH_KEY` | SSH private key | `-----BEGIN RSA...` |
| `PROD_HOST` | Production server IP/domain | `api.wastefi.com` |
| `PROD_USER` | SSH username | `deploy` |
| `PROD_SSH_KEY` | SSH private key | `-----BEGIN RSA...` |

#### Security Scanning Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `SNYK_TOKEN` | Snyk API token | [Snyk Dashboard](https://snyk.io) |
| `CODECOV_TOKEN` | Codecov upload token | [Codecov.io](https://codecov.io) |

### Generating SSH Key for Deployment

```bash
# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -C "github-actions@wastefi.com" -f deploy_key

# Copy public key to server
ssh-copy-id -i deploy_key.pub user@server

# Add private key to GitHub Secrets
cat deploy_key | pbcopy  # macOS
cat deploy_key | xclip   # Linux

# Paste into GitHub: Settings → Secrets → New repository secret
# Name: PROD_SSH_KEY
```

## Deployment Environments

### Staging Environment

**URL**: `https://api-staging.wastefi.com`

**Purpose**:
- Test new features
- Integration testing
- Client demos

**Auto-deploy**: On push to `develop` branch

**Configuration**:
```bash
# Server path
/opt/wastefi-backend

# Environment file
.env.staging

# Database
wastefi_staging
```

### Production Environment

**URL**: `https://api.wastefi.com`

**Purpose**:
- Live user traffic
- Stable releases only

**Deploy trigger**: Git tags (e.g., `v1.0.0`)

**Approval**: Requires manual approval

**Configuration**:
```bash
# Server path
/opt/wastefi-backend

# Environment file
.env.production

# Database
wastefi
```

## Monitoring

### GitHub Actions Dashboard

View pipeline status:
```
https://github.com/your-org/wastefi-backend/actions
```

### Build Status Badge

Add to README.md:
```markdown
![CI](https://github.com/your-org/wastefi-backend/workflows/CI/badge.svg)
![CD](https://github.com/your-org/wastefi-backend/workflows/CD/badge.svg)
```

### Notifications

#### Slack Integration

1. Create Slack webhook
2. Add to GitHub Secrets: `SLACK_WEBHOOK_URL`
3. Update workflow:

```yaml
- name: Send Slack notification
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

#### Discord Integration

```yaml
- name: Send Discord notification
  uses: sarisia/actions-status-discord@v1
  with:
    webhook: ${{ secrets.DISCORD_WEBHOOK }}
```

### Monitoring Tools

- **GitHub Actions**: Built-in workflow monitoring
- **Codecov**: Test coverage trends
- **Snyk**: Security vulnerability tracking
- **Trivy**: Container security scanning

## Deployment Process

### Deploying to Staging

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Develop and commit
git add .
git commit -m "Add new feature"

# 3. Push to remote
git push origin feature/new-feature

# 4. Create pull request to develop
gh pr create --base develop

# 5. Merge PR (after CI passes)
# Automatic deployment to staging triggered

# 6. Verify staging deployment
curl https://api-staging.wastefi.com/health
```

### Deploying to Production

```bash
# 1. Merge develop to main
git checkout main
git merge develop
git push origin main

# 2. Create version tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# 3. CD pipeline triggers automatically

# 4. Approve deployment (if required)
# Go to: Actions → CD workflow → Review deployment

# 5. Monitor deployment progress

# 6. Verify production deployment
curl https://api.wastefi.com/health
```

### Manual Deployment

```bash
# Using GitHub CLI
gh workflow run cd.yml -f environment=production

# Or via GitHub UI
# Actions → CD workflow → Run workflow → Select environment
```

## Rollback Strategy

### Automatic Rollback

If deployment fails:
1. Health check fails
2. Rollback job triggers automatically
3. Reverts to previous Git commit
4. Restarts services

### Manual Rollback

```bash
# 1. SSH to server
ssh user@server

# 2. Navigate to app directory
cd /opt/wastefi-backend

# 3. Rollback to previous version
git log --oneline -5
git checkout <previous-commit-hash>

# 4. Restart services
docker-compose up -d --no-build

# 5. Verify
curl http://localhost:3000/health
```

### Database Rollback

```bash
# 1. List available backups
ls -lh backups/db/

# 2. Restore from backup
./scripts/restore-db.sh backups/db/wastefi_20260914_020000.sql.gz

# 3. Restart application
docker-compose restart api
```

## Troubleshooting

### CI Pipeline Failures

#### Lint Errors

```bash
# Run locally
npm run lint

# Auto-fix
npm run lint -- --fix
```

#### Test Failures

```bash
# Run tests locally
npm test

# Run specific test
npm test -- tests/unit/utils/encryption.test.ts

# Watch mode
npm run test:watch
```

#### Build Errors

```bash
# Check TypeScript errors
npx tsc --noEmit

# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### CD Pipeline Failures

#### SSH Connection Failed

```bash
# Test SSH connection
ssh -i ~/.ssh/deploy_key user@server

# Check SSH key in secrets
# Verify key format (should include headers)
```

#### Docker Build Failed

```bash
# Build locally
docker build -t wastefi-backend .

# Check Dockerfile syntax
docker build --no-cache -t wastefi-backend .
```

#### Health Check Failed

```bash
# Check application logs
docker-compose logs api

# Test health endpoint
curl http://localhost:3000/health

# Restart services
docker-compose restart api
```

### Debugging Workflows

```bash
# Enable debug logging
# GitHub: Settings → Secrets → Add
# ACTIONS_STEP_DEBUG = true
# ACTIONS_RUNNER_DEBUG = true

# View workflow logs
gh run view <run-id> --log

# Re-run failed jobs
gh run rerun <run-id>
```

## Best Practices

### 1. Semantic Versioning

Use semantic versioning for tags:
- `v1.0.0` - Major release
- `v1.1.0` - Minor release (new features)
- `v1.0.1` - Patch release (bug fixes)

### 2. Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature branches
- `hotfix/*` - Emergency fixes

### 3. Commit Messages

Follow conventional commits:
```
feat: Add user authentication
fix: Resolve memory leak in Redis connection
docs: Update API documentation
chore: Upgrade dependencies
```

### 4. Testing Strategy

- Unit tests: Run on every commit
- Integration tests: Run on PR
- E2E tests: Run before production deploy

### 5. Deployment Windows

- Staging: Anytime
- Production: During off-peak hours
- Hotfixes: As needed with approval

## Security Considerations

### Secret Rotation

Rotate secrets regularly:
- SSH keys: Every 90 days
- API tokens: Every 90 days
- Database passwords: Every 180 days

### Access Control

- Limit who can approve production deployments
- Use branch protection rules
- Require PR reviews before merge

### Audit Logging

- Monitor deployment logs
- Track who deployed what and when
- Review failed deployment attempts

## Cost Optimization

### GitHub Actions Minutes

- Free tier: 2,000 minutes/month
- Monitor usage: Settings → Billing
- Optimize: Cache dependencies, parallelize jobs

### Best Practices

1. Use caching for dependencies
2. Run tests in parallel
3. Skip unnecessary jobs
4. Use self-hosted runners for heavy workloads

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Support

For CI/CD issues:
- Check workflow logs
- Review this documentation
- Contact: devops@wastefi.com
