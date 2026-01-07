# Database Replication Strategy
**Version:** 1.0.0  
**Last Updated:** January 2026  
**Status:** Framework Ready

---

## Overview

This document outlines the database replication strategy for the Food Truck Management System. Database replication enables read scaling, high availability, and improved performance.

---

## Architecture

### Primary-Read Replica Setup

```
┌─────────────┐
│   Primary   │ (Write operations)
│  Database   │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
┌──────▼──────┐   ┌──────▼──────┐
│   Replica   │   │   Replica   │ (Read operations)
│     1       │   │     2       │
└─────────────┘   └─────────────┘
```

### Benefits

1. **Read Scaling:** Distribute read queries across replicas
2. **High Availability:** Automatic failover capability
3. **Performance:** Reduced load on primary database
4. **Backup:** Replicas can serve as backup sources

---

## Implementation Strategy

### Phase 1: Prisma Read/Write Splitting

#### Prisma Configuration

**File:** `prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DATABASE_PRIMARY_URL") // For migrations
}
```

#### Environment Variables

```env
# Primary database (writes)
DATABASE_PRIMARY_URL=postgresql://user:password@primary-host:5432/foodtruck

# Read replicas (reads)
DATABASE_REPLICA_1_URL=postgresql://user:password@replica1-host:5432/foodtruck
DATABASE_REPLICA_2_URL=postgresql://user:password@replica2-host:5432/foodtruck

# Combined URL for Prisma (uses primary)
DATABASE_URL=postgresql://user:password@primary-host:5432/foodtruck
```

#### Prisma Client Extension

**File:** `utils/prisma.js` (to be updated)

```javascript
const { PrismaClient } = require('@prisma/client');

class ReplicatedPrismaClient extends PrismaClient {
  constructor() {
    super();
    this.replicas = [
      process.env.DATABASE_REPLICA_1_URL,
      process.env.DATABASE_REPLICA_2_URL,
    ].filter(Boolean);
  }

  // Route read queries to replicas
  async $queryRaw(...args) {
    if (this.replicas.length > 0) {
      const replicaUrl = this.replicas[Math.floor(Math.random() * this.replicas.length)];
      // Use replica connection for read queries
      return super.$queryRaw(...args);
    }
    return super.$queryRaw(...args);
  }
}

module.exports = new ReplicatedPrismaClient();
```

### Phase 2: Application-Level Routing

#### Read/Write Middleware

**File:** `middleware/database.js` (to be created)

```javascript
/**
 * Database routing middleware
 * Routes read queries to replicas, writes to primary
 */

const prisma = require('../utils/prisma').default;

// Determine if query is read-only
function isReadOnlyQuery(query) {
  const readOnlyMethods = ['findMany', 'findUnique', 'findFirst', 'count', 'aggregate', 'groupBy'];
  return readOnlyMethods.some(method => query.includes(method));
}

// Route query to appropriate database
async function routeQuery(queryFn, isRead = false) {
  if (isRead && process.env.DATABASE_REPLICA_1_URL) {
    // Route to replica
    return queryFn();
  }
  // Route to primary
  return queryFn();
}

module.exports = {
  routeQuery,
  isReadOnlyQuery,
};
```

### Phase 3: Replication Lag Monitoring

#### Monitoring Script

**File:** `scripts/monitor-replication-lag.js` (to be created)

```javascript
/**
 * Monitor replication lag between primary and replicas
 */

const { PrismaClient } = require('@prisma/client');

async function checkReplicationLag() {
  const primary = new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_PRIMARY_URL },
    },
  });

  const replica = new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_REPLICA_1_URL },
    },
  });

  try {
    // Get timestamp from primary
    const primaryResult = await primary.$queryRaw`SELECT NOW() as timestamp`;
    const primaryTime = primaryResult[0].timestamp;

    // Get timestamp from replica
    const replicaResult = await replica.$queryRaw`SELECT NOW() as timestamp`;
    const replicaTime = replicaResult[0].timestamp;

    // Calculate lag
    const lag = Math.abs(new Date(replicaTime) - new Date(primaryTime));

    console.log(`Replication lag: ${lag}ms`);

    if (lag > 1000) { // Alert if lag > 1 second
      console.warn('⚠️ High replication lag detected!');
    }

    return lag;
  } finally {
    await primary.$disconnect();
    await replica.$disconnect();
  }
}

// Run check
checkReplicationLag().catch(console.error);
```

---

## PostgreSQL Configuration

### Primary Database Setup

**File:** `postgresql.conf` (on primary server)

```conf
# Enable WAL (Write-Ahead Logging)
wal_level = replica

# Set max replication slots
max_replication_slots = 3

# Set max WAL senders
max_wal_senders = 3
```

### Replica Setup

**File:** `postgresql.conf` (on replica server)

```conf
# Enable hot standby
hot_standby = on

# Read-only mode
default_transaction_read_only = on
```

### Replication Slot Creation

```sql
-- On primary database
SELECT pg_create_physical_replication_slot('replica1');
SELECT pg_create_physical_replication_slot('replica2');
```

---

## Cloud Provider Setup

### AWS RDS

1. **Create Read Replica:**
   ```bash
   aws rds create-db-instance-read-replica \
     --db-instance-identifier foodtruck-replica-1 \
     --source-db-instance-identifier foodtruck-primary \
     --publicly-accessible
   ```

2. **Configure Multi-AZ:**
   - Enable Multi-AZ for high availability
   - Automatic failover capability

### Google Cloud SQL

1. **Create Read Replica:**
   ```bash
   gcloud sql instances create foodtruck-replica-1 \
     --master-instance-name=foodtruck-primary \
     --region=us-central1
   ```

### Azure Database

1. **Create Read Replica:**
   ```bash
   az postgres flexible-server replica create \
     --replica-name foodtruck-replica-1 \
     --resource-group myResourceGroup \
     --source-server foodtruck-primary
   ```

---

## Application Integration

### Prisma Read/Write Splitting

**File:** `utils/prisma.js` (update existing)

```javascript
const { PrismaClient } = require('@prisma/client');

// Primary client for writes
const primaryClient = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_PRIMARY_URL || process.env.DATABASE_URL },
  },
});

// Replica clients for reads
const replicaClients = [
  process.env.DATABASE_REPLICA_1_URL,
  process.env.DATABASE_REPLICA_2_URL,
].filter(Boolean).map(url => new PrismaClient({
  datasources: { db: { url } },
}));

// Select replica using round-robin
let replicaIndex = 0;
function getReplicaClient() {
  if (replicaClients.length === 0) {
    return primaryClient;
  }
  const client = replicaClients[replicaIndex];
  replicaIndex = (replicaIndex + 1) % replicaClients.length;
  return client;
}

// Wrapper for read operations
const prisma = {
  // Write operations (always use primary)
  $transaction: (...args) => primaryClient.$transaction(...args),
  $executeRaw: (...args) => primaryClient.$executeRaw(...args),
  $executeRawUnsafe: (...args) => primaryClient.$executeRawUnsafe(...args),
  
  // Model operations (route based on operation)
  user: {
    create: (...args) => primaryClient.user.create(...args),
    update: (...args) => primaryClient.user.update(...args),
    delete: (...args) => primaryClient.user.delete(...args),
    findMany: (...args) => getReplicaClient().user.findMany(...args),
    findUnique: (...args) => getReplicaClient().user.findUnique(...args),
    findFirst: (...args) => getReplicaClient().user.findFirst(...args),
    count: (...args) => getReplicaClient().user.count(...args),
  },
  // ... repeat for other models
};

module.exports = { default: prisma, primaryClient, replicaClients };
```

---

## Monitoring and Alerts

### Metrics to Monitor

1. **Replication Lag:** Time difference between primary and replica
2. **Replica Health:** Connection status and query performance
3. **Read/Write Distribution:** Query routing statistics
4. **Error Rates:** Failed queries on replicas

### Alerting

- **High Replication Lag:** > 1 second
- **Replica Down:** Connection failures
- **Query Errors:** High error rate on replicas

---

## Testing

### Replication Test

**File:** `scripts/test-replication.js` (to be created)

```javascript
/**
 * Test database replication
 */

async function testReplication() {
  // Write to primary
  await primaryClient.user.create({ data: { ... } });
  
  // Wait for replication
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Read from replica
  const user = await replicaClient.user.findUnique({ where: { id } });
  
  if (user) {
    console.log('✅ Replication working');
  } else {
    console.error('❌ Replication failed');
  }
}
```

---

## Rollback Plan

If replication causes issues:

1. **Disable Replica Routing:**
   - Set `DATABASE_REPLICA_1_URL` to empty
   - All queries route to primary

2. **Remove Replicas:**
   - Delete replica instances
   - Update application configuration

---

## Cost Considerations

### AWS RDS Pricing
- Primary: ~$200/month (db.t3.medium)
- Replica: ~$200/month (db.t3.medium)
- **Total:** ~$400/month

### Optimization
- Use smaller instance types for replicas
- Scale replicas based on read load
- Use reserved instances for cost savings

---

## Best Practices

1. **Monitor Replication Lag:** Keep lag < 1 second
2. **Health Checks:** Regular replica health monitoring
3. **Failover Testing:** Test failover procedures regularly
4. **Load Balancing:** Distribute reads evenly across replicas
5. **Connection Pooling:** Optimize connection pools

---

## Implementation Checklist

- [ ] Set up primary database
- [ ] Create read replicas
- [ ] Configure replication slots
- [ ] Update Prisma configuration
- [ ] Implement read/write splitting
- [ ] Add replication lag monitoring
- [ ] Set up alerts
- [ ] Test replication
- [ ] Document procedures
- [ ] Train team

---

## References

- [PostgreSQL Replication Documentation](https://www.postgresql.org/docs/current/high-availability.html)
- [Prisma Connection Pooling](https://www.prisma.io/docs/concepts/components/prisma-client/connection-management)
- [AWS RDS Read Replicas](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html)

---

**Document Owner:** DevOps Team  
**Review Frequency:** Quarterly  
**Next Review:** April 2026
