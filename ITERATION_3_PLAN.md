# Iteration 3: Improvement Plan
**Date:** January 2026  
**Baseline Score:** 88/100  
**Target Score:** 92/100  
**Estimated Effort:** 18 hours

---

## Plan Overview

Iteration 3 focuses on database optimization, response time improvements, automated alerting, and advanced monitoring. Building on the Prometheus metrics foundation from Iteration 2, we'll optimize queries and add comprehensive alerting.

---

## Phase 1: Database Index Optimization (Critical)

**Effort:** 4 hours  
**Priority:** P0

### Task 1.1: Add Missing Database Indexes
- **Create Migration:** Add indexes via Prisma migration
- **Indexes to Add:**
  1. Menu Items: Composite `(isAvailable, stock)` for available items
  2. Menu Items: Full-text search index (GIN) for name/description
  3. Orders: Index on `paymentStatus`
  4. Orders: Composite `(status, paymentStatus)`
  5. Order Items: Index on `menuItemId`
  6. Trucks: Index on `lastUpdated`

**Files to Create:**
- `prisma/migrations/[timestamp]_add_performance_indexes/migration.sql`

**Files to Modify:**
- `prisma/schema.prisma` - Add index definitions

---

## Phase 2: Query Performance Optimization (Critical)

**Effort:** 4 hours  
**Priority:** P0

### Task 2.1: Add Slow Query Logging
- **Solution:** Enable Prisma query logging with sampling
- **Configuration:**
  - Log queries >100ms
  - Sample 10% of queries
  - Track in metrics system
- **Files to Modify:**
  - `utils/prisma.ts` - Add query logging middleware
  - `utils/metrics.js` - Track slow queries

### Task 2.2: Optimize Menu Search
- **Issue:** Text search without full-text index
- **Solution:**
  - Use full-text search with GIN index
  - Add search ranking
  - Limit results appropriately
- **Files to Modify:**
  - `middleware/performance.js` - Optimize `getMenuItemsOptimized`

### Task 2.3: Response Time Optimization
- **Target:** P95 <150ms
- **Actions:**
  - Review slow endpoints using metrics
  - Optimize based on data
  - Add query result limits where missing

---

## Phase 3: Automated Alerting (High Priority)

**Effort:** 4 hours  
**Priority:** P1

### Task 3.1: Alert Rules Configuration
- **Solution:** Create alert rules file
- **Alerts to Configure:**
  1. Slow requests (>1s) - Warning
  2. High error rates (>5%) - Critical
  3. Health check failures - Critical
  4. Low cache hit rates (<50%) - Warning
  5. Database connection failures - Critical
  6. High memory usage (>80%) - Warning

**Files to Create:**
- `alerts/rules.yml` - Prometheus alert rules
- `docs/ALERTING.md` - Alerting documentation

### Task 3.2: Alert Integration
- **Solution:** Configure alert manager or webhook integration
- **Options:**
  - Prometheus Alertmanager
  - Webhook to external service (Slack, PagerDuty, etc.)
  - Email notifications

---

## Phase 4: Grafana Dashboard Setup (High Priority)

**Effort:** 3 hours
**Priority:** P1

### Task 4.1: Create Grafana Dashboards
- **Dashboards to Create:**
  1. API Performance Dashboard
     - Request rate
     - Response times (p50, p95, p99)
     - Error rates
     - Endpoint breakdown
  2. Database Performance Dashboard
     - Query count
     - Slow queries
     - Connection pool usage
  3. Cache Performance Dashboard
     - Hit/miss rates
     - Cache operations
     - Cache size
  4. System Health Dashboard
     - Health check status
     - Memory usage
     - CPU usage
     - Uptime

**Files to Create:**
- `grafana/dashboards/api-performance.json`
- `grafana/dashboards/database-performance.json`
- `grafana/dashboards/cache-performance.json`
- `grafana/dashboards/system-health.json`

---

## Phase 5: Security Enhancements (Medium Priority)

**Effort:** 3 hours  
**Priority:** P2

### Task 5.1: Token Security Enhancement
- **Solution:** Add device fingerprinting
- **Implementation:**
  - Extract device info from request headers
  - Include in token payload (optional)
  - Validate on token refresh
- **Files to Modify:**
  - `server.js` - Enhance token generation

### Task 5.2: Security Test Suite
- **Solution:** Add automated security tests
- **Tests to Add:**
  - SQL injection attempts
  - XSS attempts
  - Rate limiting validation
  - Authentication bypass attempts
- **Files to Create:**
  - `__tests__/security/security.test.js`

---

## Implementation Order

1. **Database Indexes** (Phase 1) - Foundation for performance
2. **Query Optimization** (Phase 2) - Immediate performance gains
3. **Alerting** (Phase 3) - Depends on metrics (already available)
4. **Grafana Dashboards** (Phase 4) - Visualize metrics
5. **Security Enhancements** (Phase 5) - Can run parallel

---

## Success Metrics

- **P95 Response Time:** <150ms (from 200ms)
- **Database Query Performance:** <50ms average (from unknown)
- **Cache Hit Rate:** >80% (maintain)
- **Alert Coverage:** 6+ alert rules configured
- **Dashboard Coverage:** 4 dashboards created

---

**Plan Created:** January 2026  
**Next Step:** Execute improvements
