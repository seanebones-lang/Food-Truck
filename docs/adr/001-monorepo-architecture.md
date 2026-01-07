# ADR-001: Monorepo Architecture

**Status:** Accepted  
**Date:** 2024-01-01  
**Deciders:** Engineering Team

## Context

The Food Truck Management System consists of multiple applications:
- Customer mobile app (React Native)
- Admin web dashboard (React)
- Backend API server (Node.js/Express)
- Shared types and utilities

We needed to decide on the project structure to manage these components effectively.

## Decision

We chose a **monorepo architecture** using Yarn Workspaces to manage all packages in a single repository.

**Structure:**
```
Food-Truck/
├── packages/
│   ├── customer-app/    # React Native mobile app
│   ├── admin-app/       # React web dashboard
│   └── shared/          # Shared TypeScript types
├── server.js            # Backend API server
├── middleware/         # Shared middleware
├── utils/              # Shared utilities
└── prisma/             # Database schema
```

## Consequences

### Positive
- ✅ Single source of truth for shared types
- ✅ Easier code sharing between packages
- ✅ Simplified dependency management
- ✅ Atomic commits across packages
- ✅ Single CI/CD pipeline
- ✅ Easier refactoring across packages

### Negative
- ⚠️ Larger repository size
- ⚠️ Requires understanding of monorepo tooling
- ⚠️ Can be slower for large teams

## Alternatives Considered

1. **Separate Repositories**
   - Pros: Clear separation, independent versioning
   - Cons: Harder to share code, more complex CI/CD, version drift

2. **Nx Monorepo**
   - Pros: Advanced tooling, better caching
   - Cons: More complex setup, steeper learning curve

3. **Lerna**
   - Pros: Mature tooling
   - Cons: More configuration, Yarn Workspaces is simpler

## Decision Rationale

Yarn Workspaces provides the right balance of simplicity and functionality for our needs. It integrates well with our existing tooling and doesn't require additional build steps.

---

**Related ADRs:** None  
**Supersedes:** None
