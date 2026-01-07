# Operations Runbook
**Food Truck Management System**  
**Version:** 2.0.0  
**Last Updated:** January 2026

---

## Table of Contents

1. [Deployment Procedures](#deployment-procedures)
2. [Monitoring & Alerting](#monitoring--alerting)
3. [Troubleshooting Guide](#troubleshooting-guide)
4. [Incident Response](#incident-response)
5. [Maintenance Procedures](#maintenance-procedures)

---

## Deployment Procedures

### Pre-Deployment Checklist

- [ ] All tests passing (>95% coverage)
- [ ] Security scan completed (0 critical vulnerabilities)
- [ ] Database migrations reviewed and tested
- [ ] Environment variables configured
- [ ] Backup database before migration
- [ ] Notify team of deployment window

### Backend Deployment (Vercel)

```bash
# 1. Verify environment variables
vercel env ls

# 2. Deploy to staging
vercel --prod=false

# 3. Run smoke tests
curl https://staging-api.foodtruck.com/health

# 4. Deploy to production
vercel --prod

# 5. Verify deployment
curl https://api.foodtruck.com/health
```

### Database Migration

```bash
# 1. Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Generate migration (if creating new)
yarn db:migrate dev --name migration_name

# 3. Review migration SQL
cat prisma/migrations/[latest]/migration.sql

# 4. Apply migration to staging
yarn db:migrate deploy

# 5. Verify migration
yarn db:studio

# 6. Apply to production (same command, different DATABASE_URL)
```

### Mobile App Deployment (Expo EAS)

```bash
# 1. Update version in app.json
# 2. Build for production
cd packages/customer-app
eas build --platform all --profile production

# 3. Submit to app stores
eas submit --platform all --profile production
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

1. **API Performance**
   - Response times (p50, p95, p99)
   - Request rate
   - Error rate

2. **Database**
   - Query performance
   - Slow query count
   - Connection pool usage

3. **Cache**
   - Hit rate (target: >80%)
   - Operation counts

4. **System**
   - Memory usage
   - CPU usage
   - Uptime

### Alert Response Procedures

#### Critical Alerts (Immediate Action)

1. **Service Down**
   - Check health endpoints
   - Review logs
   - Restart service if needed
   - Escalate if persists

2. **High Error Rate (>10%)**
   - Check error logs
   - Review recent deployments
   - Rollback if necessary

3. **Database Connection Issues**
   - Check database status
   - Verify connection pool
   - Check network connectivity

#### Warning Alerts (Review Within 30 Minutes)

1. **Slow Requests**
   - Review slow query logs
   - Check metrics dashboard
   - Optimize if needed

2. **Low Cache Hit Rate**
   - Review cache strategy
   - Check TTLs
   - Verify cache invalidation

---

## Troubleshooting Guide

### Common Issues

#### Issue: High Response Times

**Symptoms:**
- P95 response time >1s
- Slow query alerts

**Diagnosis:**
1. Check `/api/metrics` endpoint
2. Review Grafana dashboards
3. Check slow query logs

**Solutions:**
1. Review and optimize slow queries
2. Add missing indexes
3. Increase cache TTLs
4. Scale horizontally if needed

#### Issue: High Error Rate

**Symptoms:**
- Error rate >5%
- Error alerts firing

**Diagnosis:**
1. Check Sentry for error details
2. Review application logs
3. Check recent deployments

**Solutions:**
1. Fix code issues
2. Rollback deployment if needed
3. Check external service status
4. Review error patterns

#### Issue: Database Connection Errors

**Symptoms:**
- Database connection timeouts
- "Too many connections" errors

**Diagnosis:**
1. Check connection pool settings
2. Review active connections
3. Check database status

**Solutions:**
1. Increase connection pool size
2. Close idle connections
3. Restart database if needed
4. Review connection leak patterns

#### Issue: Cache Miss Rate High

**Symptoms:**
- Cache hit rate <50%
- High database load

**Diagnosis:**
1. Check cache metrics
2. Review cache invalidation
3. Check TTL settings

**Solutions:**
1. Increase cache TTLs
2. Review cache invalidation strategy
3. Warm cache more frequently
4. Check Redis status

---

## Incident Response

### Severity Levels

**P0 - Critical (Immediate)**
- Service completely down
- Data loss risk
- Security breach

**P1 - High (Within 1 hour)**
- Major feature broken
- Performance degradation
- Partial service outage

**P2 - Medium (Within 4 hours)**
- Minor feature broken
- Degraded performance
- Workaround available

**P3 - Low (Next business day)**
- Cosmetic issues
- Non-critical bugs
- Enhancement requests

### Incident Response Process

1. **Detection**
   - Automated alerts
   - User reports
   - Monitoring dashboards

2. **Triage**
   - Determine severity
   - Assign owner
   - Set communication channel

3. **Investigation**
   - Check logs
   - Review metrics
   - Reproduce issue

4. **Resolution**
   - Implement fix
   - Verify solution
   - Deploy fix

5. **Post-Incident**
   - Root cause analysis
   - Update documentation
   - Improve monitoring/alerting

### Communication

- **Slack Channel:** #food-truck-incidents
- **Status Page:** status.foodtruck.com
- **Escalation:** Engineering Lead

---

## Maintenance Procedures

### Regular Maintenance Tasks

#### Daily
- Review alerts and metrics
- Check error logs
- Monitor cache hit rates

#### Weekly
- Review slow queries
- Check dependency updates (Dependabot)
- Review security scan results

#### Monthly
- Performance optimization review
- Capacity planning
- Cost review

### Database Maintenance

```bash
# Analyze tables for query optimization
ANALYZE;

# Vacuum to reclaim space
VACUUM ANALYZE;

# Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

### Cache Maintenance

```bash
# Check Redis memory usage
redis-cli INFO memory

# Clear specific cache keys
redis-cli DEL cache:menu:items

# Check key statistics
redis-cli INFO stats
```

---

## Health Check Procedures

### Manual Health Checks

```bash
# Basic health check
curl https://api.foodtruck.com/health

# Deep health check
curl https://api.foodtruck.com/api/health?deep=true

# Liveness probe
curl https://api.foodtruck.com/health/live

# Readiness probe
curl https://api.foodtruck.com/health/ready
```

### Expected Responses

**Healthy:**
```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy", "responseTime": 10 },
    "redis": { "status": "healthy", "responseTime": 5 }
  }
}
```

**Unhealthy:**
```json
{
  "status": "degraded",
  "checks": {
    "database": { "status": "healthy" },
    "redis": { "status": "unhealthy", "error": "Connection timeout" }
  }
}
```

---

## Emergency Procedures

### Service Restart

```bash
# Vercel (automatic, but can trigger)
vercel --prod

# Manual server restart (if self-hosted)
pm2 restart food-truck-api
```

### Database Rollback

```bash
# Restore from backup
pg_restore -d $DATABASE_URL backup_file.sql

# Rollback specific migration
npx prisma migrate resolve --rolled-back [migration_name]
```

### Cache Clear

```bash
# Clear all caches (use with caution)
redis-cli FLUSHDB

# Clear specific cache
redis-cli DEL cache:menu:items cache:trucks:active
```

---

## Contact Information

- **Engineering Lead:** engineering@foodtruck.com
- **On-Call:** Check PagerDuty
- **Slack:** #food-truck-ops

---

**Last Updated:** January 2026
