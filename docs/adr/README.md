# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records (ADRs) for the Food Truck Management System.

## What are ADRs?

Architecture Decision Records are documents that capture important architectural decisions made in the project, along with their context and consequences.

## ADR Format

Each ADR follows this structure:

```markdown
# ADR-XXX: [Title]

**Status:** [Proposed | Accepted | Deprecated | Superseded]  
**Date:** YYYY-MM-DD  
**Deciders:** [Team/Person]

## Context
[Describe the issue motivating this decision]

## Decision
[State the decision]

## Consequences
[Describe the consequences]

## Alternatives Considered
[Describe alternatives]
```

## Current ADRs

- [ADR-001: Monorepo Architecture](./001-monorepo-architecture.md)
- [ADR-002: Prisma ORM Choice](./002-prisma-orm-choice.md)
- [ADR-003: Redis Caching Strategy](./003-redis-caching-strategy.md)
- [ADR-004: JWT Authentication](./004-jwt-authentication.md)
- [ADR-005: Offline-First Architecture](./005-offline-first-architecture.md)

## Status Legend

- **Proposed:** Decision is under consideration
- **Accepted:** Decision has been made and implemented
- **Deprecated:** Decision has been superseded or is no longer valid
- **Superseded:** Decision has been replaced by a newer ADR

---

**Last Updated:** January 2026
