# Deployment Guide - Food Truck Management System

## Prerequisites

- Node.js 24.12.0+
- Yarn 4.12.0+
- PostgreSQL 14+ (or compatible)
- Redis 6+ (or compatible)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd Food-Truck
yarn install
```

### 2. Environment Configuration

Create `.env` file in root:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/foodtruck

# Redis
REDIS_URL=redis://localhost:6379

# JWT (HS256 - default)
JWT_SECRET=your-strong-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-strong-refresh-secret-min-32-chars

# Optional: RS256 JWT (for multi-server)
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem

# Sentry
SENTRY_DSN=your-sentry-dsn

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_API_VERSION=2025-12-15.clover

# CORS
CORS_ORIGIN=https://yourdomain.com

# Admin App
VITE_API_URL=https://api.yourdomain.com
VITE_SENTRY_DSN=your-sentry-dsn

# Customer App
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

### 3. Generate RS256 Keys (Optional)

```bash
mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
```

### 4. Database Setup

```bash
# Generate Prisma client
yarn db:generate

# Run migrations
yarn db:migrate

# Seed database
yarn db:seed
```

### 5. Start Services

**Development:**
```bash
# Terminal 1: Backend
yarn server:dev

# Terminal 2: Admin App
yarn admin:dev

# Terminal 3: Customer App
yarn customer:start
```

**Production:**
```bash
# Build admin app
yarn admin:build

# Start backend (with PM2 or similar)
NODE_ENV=production yarn server:start
```

## Production Deployment

### Backend (Node.js/Express)

**Recommended Platforms:**
- Railway
- Render
- Heroku
- AWS ECS/EC2
- DigitalOcean App Platform

**Environment Variables Required:**
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `NODE_ENV=production`
- `PORT` (auto-assigned on most platforms)

**Health Check Endpoint:**
- `GET /health` (add if needed)

### Database (PostgreSQL)

**Recommended Providers:**
- Heroku Postgres
- AWS RDS
- Railway PostgreSQL
- Render PostgreSQL
- Supabase

**Connection Pooling:**
- Prisma handles connection pooling automatically
- For high traffic, consider PgBouncer

### Redis

**Recommended Providers:**
- Redis Cloud
- AWS ElastiCache
- Railway Redis
- Upstash

**Configuration:**
- Minimum: 256MB
- Recommended: 1GB+ for production

### Admin App (Vite/React)

**Recommended Platforms:**
- Vercel (recommended)
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

**Build Command:**
```bash
yarn admin:build
```

**Output Directory:**
```
packages/admin-app/dist
```

### Customer App (React Native/Expo)

**Build with EAS:**
```bash
cd packages/customer-app
eas build --platform ios
eas build --platform android
```

**Environment Variables:**
- Set in `eas.json` or EAS dashboard
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SENTRY_DSN`

## Monitoring

### Sentry Setup

1. Create Sentry project
2. Get DSN
3. Add to environment variables
4. Errors will auto-track

### Health Checks

Monitor:
- Database connectivity
- Redis connectivity
- API response times
- Error rates

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer:** Use AWS ALB, Cloudflare, or similar
2. **Multiple Instances:** Run multiple Node.js instances
3. **Redis Adapter:** Socket.io Redis adapter enables multi-instance
4. **Database:** Use read replicas for analytics queries

### Performance Tuning

1. **Redis Caching:** Already configured (5-min TTL)
2. **Connection Pooling:** Prisma handles this
3. **CDN:** Use for admin app static assets
4. **Image Optimization:** FastImage in customer app

## Security Checklist

- ✅ JWT tokens with short expiry (15min)
- ✅ Refresh token rotation
- ✅ Token blocklist in Redis
- ✅ Secure storage (expo-secure-store)
- ✅ RS256 signing (optional)
- ✅ Rate limiting
- ✅ CORS configured
- ✅ Input validation
- ✅ SQL injection prevention (Prisma)
- ✅ Password hashing (bcrypt)

## Backup Strategy

1. **Database:** Automated daily backups
2. **Redis:** Persistence enabled (AOF/RDB)
3. **Code:** Git repository
4. **Environment:** Document all variables

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL

# Check Prisma
yarn db:studio
```

### Redis Connection Issues
```bash
# Test connection
redis-cli -u $REDIS_URL ping
```

### Build Issues
```bash
# Clear caches
yarn cache clean
rm -rf node_modules
yarn install
```

## Support

For deployment issues, refer to:
- `UPGRADE_COMPLETE.md` - Implementation details
- `ENGINEERING_REPORT.md` - Architecture documentation
- `DEPLOYMENT.md` - Original deployment guide