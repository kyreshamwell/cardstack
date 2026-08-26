# ADR-001: Manual scaffold over create-next-app

**Date:** 2026-05-27  
**Status:** Accepted

## Context

Starting a new Next.js project, there are two paths: run `npx create-next-app` (automated) or write every file by hand. This is both a portfolio project and a learning exercise, so the goal is to understand the codebase deeply enough to explain every file in an interview.

## Decision

Write all config and source files manually.

## Consequences

**Easier:**
- Deep understanding of what each config file does (`tsconfig.json`, `postcss.config.mjs`, etc.)
- No boilerplate to delete or explain away
- Deliberate choices about what's included (e.g. chose Tailwind 4 CSS-first instead of older config style)

**Harder:**
- Slower start, since exact dependency versions and config shapes have to be looked up
- No auto-generated `next-env.d.ts` (Next.js generates this on first `npm run dev`)

**Trade-off accepted:** The slower start is worth it for the learning objective. This is a portfolio project, not a production sprint.
