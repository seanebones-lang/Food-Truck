# ADR-003: Redis Caching Strategy

**Status:** Accepted  
**Date:** 2024-01-01  
**Deciders:** Engineering Team

## Context

We needed a caching strategy to improve performance and reduce database load. The system has several frequently accessed data types:
- Menu items (read-heavy)
- Truck locations (read-heavy, updates frequently)
- Analytics data (expensive to compute)
- User profiles (read-heavy)

## Decision

We implemented **Redis caching** with the following strategy:

1. **Cache Layer:** Redis for distributed caching
2. **Cache Keys:** Namespaced keys (e.g., `menu:items`, `trucks:active`)
3. **TTL Strategy:**
   - Menu items: 5 minutes (invalidate on updates)
   - Trucks: 2 minutes (frequent location updates)
   - Analytics: 5 minutes (expensive computation)
   - User profiles: 10 minutes (less frequently updated)

4. **Invalidation:** Explicit cache invalidation on writes
5. **Fallback:** Graceful degradation if Redis is unavailable

## Consequences

### Positive
- ✅ Significant performance improvement (sub-millisecond cached responses)
- ✅ Reduced database load
- ✅ Better scalability
- ✅ Distributed caching (works with multiple instances)

### Negative
- ⚠️ Additional infrastructure (Redis server)
- ⚠️ Cache invalidation complexity
- ⚠️ Potential stale data if invalidation fails

## Alternatives Considered

1. **In-Memory Caching (Node.js)**
   - Pros: No external dependency
   - Cons: Not shared across instances, lost on restart

2. **Database Query Caching**
   - Pros: No additional infrastructure
   - Cons: Less flexible, database overhead

3. **CDN Caching**
   - Pros: Edge caching
   - Cons: Not suitable for dynamic data

## Decision Rationale

Redis provides the best balance of performance, scalability, and flexibility. It supports our multi-instance deployment and provides the caching granularity we need.

---

**Related ADRs:** ADR-002 (Prisma ORM Choice)  
**Supersedes:** None
