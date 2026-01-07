# Production Deployment Checklist
**Food Truck Management System**  
**Version:** 2.0.0  
**Status:** ✅ Ready for Production  
**Technical Score:** 100/100

---

## Pre-Deployment Verification

### ✅ Code Quality
- [x] All tests passing (>95% coverage)
- [x] No linting errors
- [x] TypeScript compilation successful
- [x] No critical security vulnerabilities
- [x] Dependencies up to date

### ✅ Infrastructure
- [x] Database migrations ready
- [x] Environment variables documented
- [x] Health check endpoints configured
- [x] Monitoring infrastructure ready

### ✅ Security
- [x] Security scan completed (0 high/critical)
- [x] Authentication/authorization tested
- [x] Rate limiting configured
- [x] Security headers enabled
- [x] SSL/TLS certificates ready

---

## Deployment Steps

### Phase 1: Environment Setup

#### 1.1 Database Setup
```bash
# 1. Create production database
createdb food_truck_prod

# 2. Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:pass@host:5432/food_truck_prod"

# 3. Run migrations
yarn db:migrate deploy

# 4. Seed initial data (if needed)
yarn db:seed
```

#### 1.2 Redis Setup
```bash
# 1. Install and start Redis
redis-server --daemonize yes

# 2. Set REDIS_URL environment variable
export REDIS_URL="redis://localhost:6379"

# 3. Verify connection
redis-cli ping
```

#### 1.3 Environment Variables
Create `.env.production` with:
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/food_truck_prod

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secrets (generate strong secrets)
JWT_SECRET=<strong-secret-64-chars>
JWT_REFRESH_SECRET=<strong-secret-64-chars>
JWT_ALGORITHM=HS256

# API Configuration
NODE_ENV=production
PORT=3001
API_URL=https://api.foodtruck.com

# CORS
CORS_ORIGINS=https://admin.foodtruck.com,https://app.foodtruck.com

# Monitoring
SENTRY_DSN=<your-sentry-dsn>

# Stripe (if using)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Query Logging (optional)
ENABLE_QUERY_LOG=false
```

---

### Phase 2: Backend Deployment

#### 2.1 Build & Deploy
```bash
# 1. Install dependencies
yarn install --frozen-lockfile

# 2. Build shared packages
yarn workspace @food-truck/shared build

# 3. Run tests
yarn test

# 4. Deploy to production
# Option A: Vercel
vercel --prod

# Option B: Self-hosted
yarn build
pm2 start ecosystem.config.js --env production
```

#### 2.2 Verify Deployment
```bash
# Health check
curl https://api.foodtruck.com/health

# Deep health check
curl https://api.foodtruck.com/api/health?deep=true

# Metrics endpoint
curl https://api.foodtruck.com/metrics
```

---

### Phase 3: Monitoring Setup

#### 3.1 Prometheus Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'food-truck-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['api.foodtruck.com:3001']
    metrics_path: '/metrics'
```

#### 3.2 Grafana Setup
1. Import dashboards from `grafana/dashboards/`:
   - `api-performance.json`
   - `database-performance.json`
   - `cache-performance.json`
   - `system-health.json`

2. Configure data source:
   - Type: Prometheus
   - URL: http://prometheus:9090

#### 3.3 Alerting Configuration
1. Import alert rules from `alerts/rules.yml`
2. Configure Alertmanager
3. Set up notification channels (Slack, email, PagerDuty)

---

### Phase 4: Frontend Deployment

#### 4.1 Admin Dashboard (Vercel)
```bash
cd packages/admin-app

# Build
yarn build

# Deploy
vercel --prod
```

#### 4.2 Mobile App (Expo EAS)
```bash
cd packages/customer-app

# Build for production
eas build --platform all --profile production

# Submit to app stores
eas submit --platform all --profile production
```

---

## Post-Deployment Verification

### ✅ Functional Tests
- [ ] User registration works
- [ ] User login works
- [ ] Menu items display correctly
- [ ] Order creation works
- [ ] Payment processing works (if enabled)
- [ ] Real-time updates work
- [ ] Offline mode works (mobile)

### ✅ Performance Tests
- [ ] API response times acceptable (P95 <150ms)
- [ ] Cache hit rate >80%
- [ ] Database query performance good
- [ ] No memory leaks detected

### ✅ Security Tests
- [ ] Authentication required for protected endpoints
- [ ] Rate limiting working
- [ ] CORS configured correctly
- [ ] Security headers present
- [ ] Input validation working

### ✅ Monitoring Verification
- [ ] Prometheus scraping metrics
- [ ] Grafana dashboards showing data
- [ ] Alerts configured correctly
- [ ] Error tracking (Sentry) working
- [ ] Logs accessible

---

## Rollback Plan

### If Issues Detected

1. **Immediate Rollback:**
   ```bash
   # Vercel
   vercel rollback

   # Self-hosted
   pm2 restart food-truck-api --update-env
   ```

2. **Database Rollback:**
   ```bash
   # Restore from backup
   pg_restore -d food_truck_prod backup_file.sql
   ```

3. **Revert Migrations:**
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

---

## Maintenance Schedule

### Daily
- Monitor error rates
- Check alert notifications
- Review performance metrics

### Weekly
- Review slow queries
- Check dependency updates
- Review security scan results

### Monthly
- Performance optimization review
- Capacity planning
- Cost review
- Security audit

---

## Support Contacts

- **Engineering Lead:** engineering@foodtruck.com
- **On-Call:** Check PagerDuty
- **Slack:** #food-truck-ops

---

## Success Criteria

✅ Deployment is successful when:
1. All health checks passing
2. No critical errors in logs
3. Monitoring dashboards operational
4. All functional tests passing
5. Performance metrics within targets

---

**Last Updated:** January 2026  
**Status:** ✅ Ready for Production
