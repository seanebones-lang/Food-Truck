# ADR-004: JWT Authentication

**Status:** Accepted  
**Date:** 2024-01-01  
**Deciders:** Engineering Team

## Context

We needed to choose an authentication mechanism for our API. Requirements:
- Stateless authentication (scalable)
- Secure token management
- Refresh token support
- Token revocation capability

## Decision

We chose **JWT (JSON Web Tokens)** with the following implementation:

1. **Token Types:**
   - Access token: Short-lived (15 minutes), HS256 algorithm
   - Refresh token: Long-lived (7 days), stored in database

2. **Token Storage:**
   - Access token: Client-side (localStorage/memory)
   - Refresh token: Client-side + server-side blocklist (Redis)

3. **Token Rotation:** Refresh tokens are rotated on use
4. **Revocation:** Token blocklist in Redis for logout/revocation

## Consequences

### Positive
- ✅ Stateless (scalable across instances)
- ✅ No server-side session storage needed
- ✅ Works well with mobile apps
- ✅ Industry standard
- ✅ Token contains user info (reduces DB queries)

### Negative
- ⚠️ Token size (larger than session IDs)
- ⚠️ Cannot revoke access tokens until expiry (mitigated with short TTL)
- ⚠️ Requires secure storage on client

## Alternatives Considered

1. **Session-Based Authentication**
   - Pros: Easy revocation, server-side control
   - Cons: Requires session storage, not scalable

2. **OAuth 2.0**
   - Pros: Industry standard, third-party integration
   - Cons: More complex, overkill for our use case

3. **API Keys**
   - Pros: Simple
   - Cons: No user context, security concerns

## Decision Rationale

JWT provides the scalability we need for a distributed system while maintaining security through short-lived tokens and refresh token rotation. The blocklist mechanism addresses revocation concerns.

---

**Related ADRs:** ADR-003 (Redis Caching Strategy)  
**Supersedes:** None
