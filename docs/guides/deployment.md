# Deployment Guide

This guide covers deploying Orkestra to production. Learn how to set up infrastructure, configure environments, and monitor your deployment.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Infrastructure Setup](#infrastructure-setup)
- [Database Setup](#database-setup)
- [Temporal Deployment](#temporal-deployment)
- [Application Deployment](#application-deployment)
- [Environment Configuration](#environment-configuration)
- [Scaling Considerations](#scaling-considerations)
- [Monitoring and Logging](#monitoring-and-logging)
- [Security](#security)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

Orkestra consists of several components that work together:

```
┌─────────────┐
│   Client    │ (Dashboard, MCP, API)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   API /     │ (tRPC, Next.js)
│  Dashboard  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Temporal   │ (Workflow Engine)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │ (Database)
└─────────────┘
```

### Components

| Component       | Purpose            | Tech Stack             |
| --------------- | ------------------ | ---------------------- |
| API Server      | REST/tRPC API      | Next.js API Routes     |
| Dashboard       | Human task UI      | Next.js + React        |
| MCP Server      | AI agent interface | Node.js + MCP SDK      |
| Temporal Server | Workflow execution | Temporal Cluster       |
| PostgreSQL      | Data persistence   | PostgreSQL 12+         |
| Workers         | Workflow execution | Node.js + Temporal SDK |

---

## Prerequisites

### Required Services

- **PostgreSQL** 12 or higher
- **Temporal** Cluster (v1.20+)
- **Redis** (optional, for caching)
- **Node.js** 20 LTS or higher

### Required Tools

- **Docker** and **Docker Compose**
- **pnpm** (recommended) or npm
- **Git** for version control

### External Services (Optional)

- **Resend** for email notifications
- **Slack** for Slack notifications
- **S3-compatible storage** for file attachments
- **Cloud monitoring** (Datadog, New Relic, etc.)

---

## Infrastructure Setup

### Option 1: Docker Compose (Simple)

For smaller deployments, use Docker Compose:

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: orkestra
      POSTGRES_USER: orkestra
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  temporal:
    image: temporalio/auto-setup:1.22.0
    environment:
      DB: postgres12
      DB_PORT: 5432
      POSTGRES_USER: orkestra
      POSTGRES_PWD: ${POSTGRES_PASSWORD}
      POSTGRES_SEEDS: postgres
    depends_on:
      - postgres
    ports:
      - '7233:7233'
      - '7234:7234'
      - '8080:8080'
      - '9090:9090'

  api:
    build: .
    command: pnpm --filter @orkestra/api start
    environment:
      DATABASE_URL: postgresql://orkestra:${POSTGRES_PASSWORD}@postgres:5432/orkestra
      TEMPORAL_HOST: temporal:7233
    depends_on:
      - postgres
      - temporal
    ports:
      - '3000:3000'

  worker:
    build: .
    command: pnpm --filter @orkestra/worker start
    environment:
      DATABASE_URL: postgresql://orkestra:${POSTGRES_PASSWORD}@postgres:5432/orkestra
      TEMPORAL_HOST: temporal:7233
    depends_on:
      - postgres
      - temporal

volumes:
  postgres_data:
```

### Option 2: Kubernetes (Production)

For production, use Kubernetes with Helm charts:

```yaml
# values.yaml
postgresql:
  enabled: true
  auth:
    password: ${POSTGRES_PASSWORD}
  primary:
    persistence:
      enabled: true
      size: 20Gi

temporal:
  enabled: true
  cassandra:
    enabled: false
  postgresql:
    enabled: true
    auth:
      password: ${POSTGRES_PASSWORD}
  server:
    replicaCount: 3

api:
  replicaCount: 3
  image:
    repository: your-registry/orkestra-api
    tag: v1.0.0
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi

worker:
  replicaCount: 3
  image:
    repository: your-registry/orkestra-worker
    tag: v1.0.0
  resources:
    requests:
      cpu: 1000m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 2Gi
```

### Cloud Deployment

#### AWS

```bash
# Using EKS for Kubernetes
eksctl create cluster --name orkestra --region us-east-1

# Using RDS for PostgreSQL
aws rds create-db-instance \
  --db-instance-identifier orkestra-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --allocated-storage 20 \
  --master-username orkestra \
  --master-user-password ${DB_PASSWORD}

# Using ElastiCache for Redis (optional)
aws elasticache create-cache-cluster \
  --cache-cluster-id orkestra-redis \
  --engine redis \
  --cache-node-type cache.t3.medium
```

#### GCP

```bash
# Using GKE for Kubernetes
gcloud container clusters create orkestra \
  --region us-central1 \
  --num-nodes 3

# Using Cloud SQL for PostgreSQL
gcloud sql instances create orkestra-db \
  --tier db-f1-micro \
  --database-version POSTGRES_15 \
  --region us-central1

# Using Memorystore for Redis (optional)
gcloud redis instances create orkestra-redis \
  --region us-central1 \
  --size 1
```

---

## Database Setup

### Initialize Database

```bash
# Run migrations
nix develop --command pnpm db:push

# Seed initial data
nix develop --command pnpm db:seed

# Create admin user
nix develop --command pnpm orkestra user create \
  --email admin@example.com \
  --password securepassword
```

### Database Configuration

```typescript
// .env.production
DATABASE_URL=postgresql://orkestra:password@db.example.com:5432/orkestra
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
DATABASE_TIMEOUT=30000
```

### Backup Strategy

```bash
# Automated backups
0 2 * * * pg_dump orkestra | gzip > /backups/orkestra-$(date +%Y%m%d).sql.gz

# Restore from backup
gunzip < /backups/orkestra-20240115.sql.gz | psql orkestra
```

---

## Temporal Deployment

### Production Configuration

```yaml
# config/production/temporal.yaml
global:
  membership:
    maxJoinDuration: 30s

persistence:
  defaultStore: postgres
  visibilityStore: postgres
  datastores:
    postgres:
      sql:
        pluginName: postgres
        driver: postgres12
        databaseName: temporal
        user: temporal
        password: ${TEMPORAL_DB_PASSWORD}
        host: postgres
        port: 5432
        maxConns: 20
        maxIdleConns: 20

history:
  numHistoryShards: 512
  advancedVisibilityStore:
    enableRead: true
    enableWrite: true
```

### High Availability

```yaml
# Deploy 3 replicas
replicaCount: 3

# Use PostgreSQL replication
postgresql:
  replication:
    enabled: true
    readReplicas: 2
```

### Worker Configuration

```typescript
// packages/worker/src/index.ts
const worker = await Worker.create({
  connection: Connection.address({
    address: process.env.TEMPORAL_HOST || 'localhost:7233',
  }),
  namespace: 'default',
  taskQueue: 'orkestra',
  workflowsPath: require.resolve('./workflows'),
  activitiesPath: require.resolve('./activities'),
  maxConcurrentActivityTaskExecutions: 100,
  maxConcurrentWorkflowTaskExecutions: 100,
  maxConcurrentLocalActivityExecutions: 100,
  maxHeartbeatThrottleInterval: '60s',
  defaultHeartbeatThrottleInterval: '30s',
  maxWorkerActivitiesPerSecond: 1000,
});
```

---

## Application Deployment

### Build for Production

```bash
# Build all packages
nix develop --command pnpm build

# Build Docker images
docker build -t orkestra-api:${VERSION} -f docker/api.Dockerfile .
docker build -t orkestra-worker:${VERSION} -f docker/worker.Dockerfile .
```

### Docker Configuration

```dockerfile
# docker/api.Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build --filter @orkestra/api

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Health Checks

```typescript
// packages/api/src/health.ts
import { Router } from 'express';

const router = Router();

router.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'OK',
    checks: {
      database: await checkDatabase(),
      temporal: await checkTemporal(),
      redis: await checkRedis(),
    },
  };

  const allHealthy = Object.values(health.checks).every((v) => v);

  res.status(allHealthy ? 200 : 503).json(health);
});

async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
```

---

## Environment Configuration

### Development

```bash
# .env.development
NODE_ENV=development
DATABASE_URL=postgresql://orkestra:orkestra@localhost:5432/orkestra
TEMPORAL_HOST=localhost:7233
NEXTAUTH_SECRET=dev-secret
NEXTAUTH_URL=http://localhost:3001
```

### Staging

```bash
# .env.staging
NODE_ENV=production
DATABASE_URL=postgresql://orkestra:${STAGING_DB_PASSWORD}@staging-db.example.com:5432/orkestra
TEMPORAL_HOST=temporal-staging.example.com:7233
NEXTAUTH_SECRET=${STAGING_NEXTAUTH_SECRET}
NEXTAUTH_URL=https://staging.yourcompany.com
```

### Production

```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://orkestra:${PROD_DB_PASSWORD}@prod-db.example.com:5432/orkestra
TEMPORAL_HOST=temporal.prod.example.com:7233
NEXTAUTH_SECRET=${PROD_NEXTAUTH_SECRET}
NEXTAUTH_URL=https://app.yourcompany.com

# Notifications
EMAIL_ENABLED=true
RESEND_API_KEY=${RESEND_API_KEY}
FROM_EMAIL=notifications@yourcompany.com
SLACK_ENABLED=true
SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}

# Monitoring
SENTRY_DSN=${SENTRY_DSN}
DATADOG_API_KEY=${DATADOG_API_KEY}
```

---

## Scaling Considerations

### Database Scaling

```typescript
// Connection pool configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['query', 'error', 'warn'],
});

// Configure pool limits
process.env.DATABASE_POOL_MIN = '5';
process.env.DATABASE_POOL_MAX = '50';
process.env.DATABASE_TIMEOUT = '30000';
```

### Temporal Scaling

```yaml
# Increase history shards
history:
  numHistoryShards: 1024 # More shards = more throughput

# Worker autoscaling
worker:
  replicaCount: 5
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
```

### API Scaling

```yaml
api:
  replicaCount: 3
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
```

### Load Balancing

```yaml
# Use ingress with multiple backends
ingress:
  enabled: true
  className: nginx
  annotations:
    nginx.ingress.kubernetes.io/load-balance: round_robin
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
```

---

## Monitoring and Logging

### Structured Logging

```typescript
// packages/core/src/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  redact: ['password', 'token', 'apiKey'],
});
```

### Metrics Collection

```typescript
// packages/api/src/metrics.ts
import { Counter, Histogram, register } from 'prom-client';

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

export const workflowExecutionCounter = new Counter({
  name: 'workflow_executions_total',
  help: 'Total number of workflow executions',
  labelNames: ['workflow_name', 'status'],
});

register.registerMetric(httpRequestDuration);
register.registerMetric(workflowExecutionCounter);
```

### Error Tracking

```typescript
// packages/api/src/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filter out sensitive data
    if (event.request?.headers) {
      delete event.request.headers.authorization;
    }
    return event;
  },
});
```

### Health Monitoring

```bash
# Kubernetes liveness probe
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

# Kubernetes readiness probe
readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

---

## Security

### Secrets Management

```bash
# Use environment variables for secrets
export DATABASE_PASSWORD=$(vault kv get -field=password secret/orkestra/db)
export NEXTAUTH_SECRET=$(vault kv get -field=secret secret/orkestra/auth)

# Or use Kubernetes secrets
kubectl create secret generic orkestra-secrets \
  --from-literal=database-password=xxx \
  --from-literal=nextauth-secret=xxx
```

### Network Security

```yaml
# Network policies
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: orkestra-network-policy
spec:
  podSelector:
    matchLabels:
      app: orkestra
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000
```

### Rate Limiting

```typescript
// packages/api/src/rate-limit.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Authentication

```typescript
// packages/api/src/auth.ts
import { getServerSession } from 'next-auth';

export async function requireAuth(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  return session.user;
}
```

---

## Backup and Recovery

### Database Backups

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR=/backups

pg_dump orkestra | gzip > ${BACKUP_DIR}/orkestra-${DATE}.sql.gz

# Keep last 30 days
find ${BACKUP_DIR} -name "orkestra-*.sql.gz" -mtime +30 -delete
```

### Temporal State Backup

```bash
# Temporal doesn't require backup but you can export visibility data
temporal workflow list --query "ExecutionStatus='Running'" > running-workflows.json
```

### Recovery Procedure

```bash
# 1. Stop all services
kubectl scale deployment orkestra-api --replicas=0
kubectl scale deployment orkestra-worker --replicas=0

# 2. Restore database
gunzip < /backups/orkestra-20240115.sql.gz | psql orkestra

# 3. Restart services
kubectl scale deployment orkestra-api --replicas=3
kubectl scale deployment orkestra-worker --replicas=3

# 4. Verify health
kubectl rollout status deployment orkestra-api
```

---

## Troubleshooting

### Database Connection Issues

**Symptoms**: Application can't connect to database

**Solutions**:

1. Check database is running
2. Verify connection string
3. Check firewall rules
4. Review database logs

```bash
# Test database connection
psql -h db.example.com -U orkestra -d orkestra

# Check database logs
kubectl logs -l app=postgresql
```

### Temporal Connection Issues

**Symptoms**: Workers can't connect to Temporal

**Solutions**:

1. Verify Temporal server is running
2. Check network connectivity
3. Verify namespace exists
4. Review worker logs

```bash
# Test Temporal connection
tctl --address temporal.example.com:7233 cluster health

# Check Temporal logs
kubectl logs -l app=temporal
```

### High Memory Usage

**Symptoms**: Workers or API consuming too much memory

**Solutions**:

1. Reduce concurrent executions
2. Increase memory limits
3. Profile memory usage
4. Check for memory leaks

```typescript
// Reduce concurrency
const worker = await Worker.create({
  maxConcurrentActivityTaskExecutions: 50, // Reduce from 100
  maxConcurrentWorkflowTaskExecutions: 50,
});
```

### Slow Workflows

**Symptoms**: Workflows taking longer than expected

**Solutions**:

1. Check database query performance
2. Review activity timeouts
3. Analyze Temporal history
4. Optimize workflow logic

```bash
# Analyze workflow performance
tctl workflow show --workflow-id wf_123 --output json | jq .

# Check database slow queries
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Tasks Not Processing

**Symptoms**: Tasks created but not completed

**Solutions**:

1. Check worker is running
2. Verify task queue is correct
3. Review worker logs
4. Check for activity errors

```bash
# Check worker status
kubectl logs -l app=orkestra-worker --tail=100

# List task queues
tctl task-queue describe --task-queue orkestra
```

---

## Resources

- [Architecture](../Architecture.md)
- [Writing Workflows](./writing-workflows.md)
- [Temporal Docs](https://docs.temporal.io/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
