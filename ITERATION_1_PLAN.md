# Iteration 1: Improvement Plan
**Date:** January 2026  
**Based on:** ITERATION_1_ASSESSMENT.md  
**Target:** Fix all CRITICAL issues and highest-impact HIGH priority issues

---

## Plan Overview

This plan addresses **12 CRITICAL** and **5 HIGH** priority issues identified in the assessment. The focus is on:
1. Fixing critical bugs that prevent proper operation
2. Implementing missing security controls
3. Optimizing performance bottlenecks
4. Enhancing reliability mechanisms

**Estimated Effort:** 8-12 hours  
**Expected Outcome:** System score improvement from 78/100 to 88/100

---

## Task Breakdown

### Phase 1: Critical Bug Fixes (Priority: CRITICAL)

#### Task 1.1: Fix Order Creation Race Condition
**Issue:** Multiple concurrent orders can oversell items (stock goes negative)  
**Location:** `server.js:1889-1955`  
**Impact:** Data integrity violation, customer dissatisfaction  
**Effort:** 2 hours

**Solution:**
1. Wrap order creation in Prisma transaction
2. Use `SELECT FOR UPDATE` to lock rows during stock check
3. Add database-level constraint: `CHECK (stock >= 0)`
4. Implement optimistic locking with version field

**Implementation:**
```javascript
// Use Prisma transaction with row-level locking
const order = await prisma.$transaction(async (tx) => {
  // Lock menu items for update
  for (const orderItem of items) {
    const menuItem = await tx.menuItem.findUnique({
      where: { id: orderItem.menuItemId },
      // Add row-level lock
    });
    
    if (menuItem.stock < orderItem.quantity) {
      throw new Error(`Insufficient stock for ${menuItem.name}`);
    }
    
    // Update stock atomically
    await tx.menuItem.update({
      where: { id: menuItem.id },
      data: { stock: { decrement: orderItem.quantity } },
    });
  }
  
  // Create order
  return await tx.order.create({ ... });
}, {
  isolationLevel: 'Serializable', // Highest isolation
  timeout: 10000, // 10 second timeout
});
```

**Validation:**
- Unit test: Concurrent order creation
- Integration test: Stock never goes negative
- Load test: 100 concurrent orders

---

#### Task 1.2: Fix JWT Secret Validation
**Issue:** Hardcoded fallback secret allows production deployment with weak security  
**Location:** `server.js:98-99`  
**Impact:** Security vulnerability if env var missing  
**Effort:** 30 minutes

**Solution:**
1. Fail fast if secrets not provided in production
2. Add validation on startup
3. Generate secure secrets if missing in development only

**Implementation:**
```javascript
// Validate JWT secrets on startup
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === 'your-refresh-secret-key-change-in-production') {
    throw new Error('JWT_REFRESH_SECRET must be set in production');
  }
  
  // Validate secret strength
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
}
```

**Validation:**
- Test: Server fails to start without secrets in production
- Test: Server starts with weak secrets in development (warning only)

---

#### Task 1.3: Apply Circuit Breakers to Database Queries
**Issue:** Database failures can cascade without circuit breaker protection  
**Location:** All Prisma queries  
**Impact:** System-wide failures  
**Effort:** 3 hours

**Solution:**
1. Create database query wrapper with circuit breaker
2. Apply to all critical database operations
3. Add fallback responses where appropriate

**Implementation:**
```javascript
// middleware/reliability.js - Add database wrapper
async function executeWithCircuitBreaker(fn, fallback = null) {
  return await circuitBreakers.database.execute(fn, fallback);
}

// Usage in server.js
const menuItems = await executeWithCircuitBreaker(
  () => prisma.menuItem.findMany({ ... }),
  () => [] // Fallback: return empty array
);
```

**Validation:**
- Test: Circuit opens after 5 failures
- Test: Fallback used when circuit open
- Test: Circuit closes after recovery

---

### Phase 2: Security Enhancements (Priority: CRITICAL)

#### Task 2.1: Implement Account Lockout
**Issue:** No protection against brute force attacks beyond rate limiting  
**Impact:** Accounts can be compromised  
**Effort:** 2 hours

**Solution:**
1. Track failed login attempts per email
2. Lock account after 5 failed attempts
3. Unlock after 15 minutes or admin action
4. Store in Redis with TTL

**Implementation:**
```javascript
// middleware/security.js
async function checkAccountLockout(email) {
  const key = `account:lockout:${email}`;
  const attempts = await getRedisClient().get(key);
  
  if (attempts && parseInt(attempts) >= 5) {
    throw new Error('Account locked. Too many failed attempts.');
  }
}

async function recordFailedLogin(email) {
  const key = `account:lockout:${email}`;
  const attempts = await getRedisClient().incr(key);
  
  if (attempts === 1) {
    await getRedisClient().expire(key, 900); // 15 minutes
  }
  
  return attempts;
}
```

**Validation:**
- Test: Account locks after 5 failed attempts
- Test: Account unlocks after 15 minutes
- Test: Admin can unlock account

---

#### Task 2.2: Add CSRF Protection
**Issue:** State-changing operations vulnerable to CSRF attacks  
**Impact:** Unauthorized actions possible  
**Effort:** 1.5 hours

**Solution:**
1. Generate CSRF tokens for authenticated sessions
2. Validate tokens on POST/PUT/DELETE requests
3. Store tokens in Redis with session

**Implementation:**
```javascript
// middleware/security.js
const csrf = require('csurf');
const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  }
});

// Apply to state-changing routes
app.post('/api/orders', authenticateToken, csrfProtection, createOrder);
```

**Validation:**
- Test: CSRF token required for POST requests
- Test: Invalid token rejected
- Test: Token refreshed on each request

---

### Phase 3: Performance Optimizations (Priority: HIGH)

#### Task 3.1: Fix N+1 Query Problem in Analytics
**Issue:** Multiple queries for order items instead of single query  
**Location:** `server.js:1604-1621`  
**Impact:** Slow dashboard loads  
**Effort:** 1 hour

**Solution:**
1. Use Prisma `include` to fetch relations in single query
2. Optimize aggregation queries
3. Add database indexes if missing

**Implementation:**
```javascript
// Before: N+1 queries
const orders = await prisma.order.findMany();
for (const order of orders) {
  const items = await prisma.orderItem.findMany({ where: { orderId: order.id } });
}

// After: Single query
const orders = await prisma.order.findMany({
  include: {
    orderItems: {
      include: {
        menuItem: {
          select: { name: true, price: true }
        }
      }
    }
  }
});
```

**Validation:**
- Test: Dashboard loads in <500ms with 1000 orders
- Test: Query count reduced from N+1 to 1

---

#### Task 3.2: Fix Cache Invalidation on Stock Updates
**Issue:** Menu cache not invalidated when stock changes  
**Location:** `server.js:1951`  
**Impact:** Stale menu data shown  
**Effort:** 30 minutes

**Solution:**
1. Call `invalidateMenuCache()` after stock updates
2. Invalidate on order creation, menu updates
3. Add cache versioning for partial invalidation

**Implementation:**
```javascript
// After stock update in order creation
await prisma.menuItem.update({
  where: { id: menuItem.id },
  data: { stock: { decrement: orderItem.quantity } },
});

// Invalidate cache
await invalidateMenuCache();
```

**Validation:**
- Test: Menu cache invalidated after order
- Test: Fresh data returned after invalidation

---

#### Task 3.3: Configure Database Connection Pooling
**Issue:** No connection pool limits configured  
**Impact:** Connection exhaustion under load  
**Effort:** 1 hour

**Solution:**
1. Configure Prisma connection pool
2. Set appropriate limits based on load
3. Add connection monitoring

**Implementation:**
```javascript
// utils/prisma.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool configuration
  __internal: {
    engine: {
      connectTimeout: 10000,
      queryTimeout: 20000,
    },
  },
});

// In DATABASE_URL, add connection pool params:
// postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
```

**Validation:**
- Test: Connection pool limits enforced
- Test: No connection exhaustion under load

---

### Phase 4: Input Validation (Priority: HIGH)

#### Task 4.1: Add Comprehensive Input Validation
**Issue:** Missing validation on order items, customizations  
**Impact:** Invalid data can break system  
**Effort:** 2 hours

**Solution:**
1. Create Zod schemas for all inputs
2. Validate at middleware level
3. Return clear error messages

**Implementation:**
```javascript
// shared/src/order.ts
import { z } from 'zod';

export const OrderItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive().max(100),
  customizations: z.array(z.object({
    name: z.string(),
    priceModifier: z.number().optional(),
  })).optional(),
  specialInstructions: z.string().max(500).optional(),
});

export const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1).max(50),
  deliveryAddress: z.string().max(500).optional(),
  pickupLocation: z.string().max(500).optional(),
  contactPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  specialInstructions: z.string().max(1000).optional(),
  paymentIntentId: z.string().optional(),
});
```

**Validation:**
- Test: Invalid inputs rejected with clear errors
- Test: All edge cases handled (negative, zero, too large)

---

## Implementation Order

1. **Critical Bug Fixes** (Tasks 1.1, 1.2, 1.3) - **6.5 hours**
2. **Security Enhancements** (Tasks 2.1, 2.2) - **3.5 hours**
3. **Performance Optimizations** (Tasks 3.1, 3.2, 3.3) - **2.5 hours**
4. **Input Validation** (Task 4.1) - **2 hours**

**Total Estimated Time:** 14.5 hours

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes in order creation | Medium | High | Comprehensive testing, feature flag |
| Performance regression | Low | Medium | Load testing before/after |
| Security vulnerability introduction | Low | High | Security review, penetration testing |
| Cache invalidation bugs | Medium | Medium | Thorough testing, monitoring |

---

## Rollback Strategy

1. **Feature Flags:** Use environment variables to enable/disable new features
2. **Database Migrations:** All migrations reversible
3. **Code Deployment:** Gradual rollout (10% → 50% → 100%)
4. **Monitoring:** Alert on error rate increases

---

## Success Criteria

- ✅ All CRITICAL issues fixed
- ✅ All HIGH priority issues addressed
- ✅ Test coverage maintained at >95%
- ✅ No performance regressions
- ✅ Security audit passes
- ✅ System score improves to 88/100+

---

## Dependencies

- Prisma 7.0.0+ (transaction support)
- Redis (for account lockout, CSRF tokens)
- Zod 3.23.8+ (validation)
- csurf package (CSRF protection)

---

**Plan Created:** January 2026  
**Status:** Ready for Critique
