# RMF Claude Code Agent System

## Purpose

RMF uses a multi-agent Claude Code setup for building, testing, researching, reviewing, and improving the **Rwandan Market Facilitator** platform.

RMF is a marketplace for Rwandan public markets where sellers/vendors add products, buyers order products, riders deliver orders, and admins manage the system.

This file explains how the RMF agent team works, when to use each agent, how agents report problems, how research is routed, how file ownership is protected, and when a feature is considered complete.

The goal is to make RMF development:

* secure
* organized
* research-backed
* testable
* user-friendly
* scalable
* easy for future Claude Code sessions to understand

---

## Core Agents

### 0. `rmf-product-strategist`

The idea discussion and pre-orchestrator agent.

Use this agent when the user has an idea but the requirements are not fully clear yet. It talks with the user, brainstorms the idea, identifies affected users and systems, decides which agents should be involved, then creates a structured mission for `rmf-master-orchestrator`.

It should not implement code directly. Its default workflow is:

> Brainstorm → Requirements → Architecture → Approval → Implementation

Use `rmf-product-strategist` when you have a raw idea and need help turning it into a proper mission.

Example:

```txt
Use rmf-product-strategist.

Idea:
I want RMF to support menu-based ordering for restaurants, hotels, cafés, and food vendors.

Talk with me first. Help me refine the idea, identify affected users, decide which agents
should be involved, and create the correct command for rmf-master-orchestrator.

Do not implement code yet.
```

---

### 1. `rmf-master-orchestrator`

The boss/senior engineering lead of the RMF AI development team.

Use this agent for:

* large feature builds
* multi-domain work
* payment integrations
* delivery/rider architecture
* RBAC/auth changes
* database schema changes
* security-sensitive changes
* full refactors
* release approval

Responsibilities:

* Breaks large tasks into worker tasks
* Assigns work to exact worker agents
* Enforces file ownership
* Reviews worker reports
* Detects conflicts between workers
* Sends issues back for correction
* Requires QA/security before final approval
* Produces the final mission report

The orchestrator is the only agent that gives final approval for serious work.

---

### 2. `rmf-research-intelligence`

The external research and verification agent.

Use this agent for:

* Rwanda market context
* competitor analysis
* payment provider documentation
* MTN MoMo and Airtel Money behavior
* legal/regulatory context
* privacy and data protection research
* delivery platform research
* marketplace pain points
* source-backed implementation recommendations

Responsibilities:

* Searches for current information
* Compares sources
* Checks reliability
* Summarizes findings
* Extracts RMF-relevant risks and opportunities
* Produces source-backed recommendations

This agent should be used before implementing features that depend on real-world rules, provider behavior, pricing, competitors, laws, or current documentation.

**Skills:** `rmf-research-method`

---

### `rmf-user-simulation-lab`

The practical role-based user testing agent.

Use this agent after a feature, infrastructure change, or architecture proposal is produced. It acts as buyer, seller, rider, and admin where relevant, then tests whether the system is actually usable by those roles.

It reports blocked flows, confusing flows, missing states, permission issues, payment/delivery issues, and task-ready problems to `rmf-master-orchestrator`.

Position in the chain: after worker agents finish implementation, before `rmf-ux-analyst` and `rmf-qa-commander`.

---

### 3. `rmf-ux-analyst`

The human UX analyst.

Use this agent after UI changes, major user-flow changes, or before release.

Responsibilities:

* Tests buyer flows
* Tests seller flows
* Tests rider flows
* Thinks like real Rwandan users
* Tracks emotional friction
* Scores flows
* Finds trust problems
* Finds confusing screens
* Finds mobile usability issues
* Reports task-ready UX problems to `rmf-master-orchestrator`

The UX analyst should evaluate how users feel during the experience, not only whether buttons technically work.

**Skills:** `rmf-marketplace-ui-ux`, `rmf-frontend-design-system`

---

### 4. `rmf-qa-commander`

The testing gatekeeper.

Use this agent after features are implemented, before releases, after critical fixes, or when a bug/security concern is flagged.

Responsibilities:

* Coordinates testing specialists
* Finds bugs, regressions, and edge cases
* Tests security-sensitive flows
* Tests payments
* Tests delivery/rider flows
* Tests auth/RBAC
* Converts findings into task-ready reports
* Gives release readiness verdict: PASS, PASS WITH FIXES, or FAIL

No important feature should be considered finished until QA has reviewed the relevant flows.

**Skills:** `rmf-payment-testing`, `rmf-delivery-rider-testing`, `rmf-api-contract-testing`, `rmf-security-review`

---

## Worker Agents

The `rmf-master-orchestrator` dispatches tasks using exact worker agent names.

### `rmf-worker-research`

File: `.claude/agents/rmf-worker-research.md`

Use this worker when a coding, QA, UX, security, DevOps, integration, or documentation task needs external knowledge. It routes research through `rmf-research-intelligence` and converts findings into implementation-ready notes.

**Skills:** `rmf-research-method`

---

### `rmf-worker-backend`

File: `.claude/agents/rmf-worker-backend.md`

Use this worker for NestJS APIs, services, controllers, DTOs, guards, RBAC, auth/session logic, order logic, payment logic, delivery logic, error handling, audit logs, and backend business rules.

---

### `rmf-worker-frontend`

File: `.claude/agents/rmf-worker-frontend.md`

Use this worker for Next.js pages, React components, Tailwind UI, buyer/seller/rider/admin dashboards, forms, checkout screens, product browsing, order tracking UI, loading states, empty states, error states, and responsive design.

**Skills:** `rmf-marketplace-ui-ux`, `rmf-frontend-design-system`, `rmf-performance-mobile-first`

---

### `rmf-worker-database`

File: `.claude/agents/rmf-worker-database.md`

Use this worker for Mongoose/MongoDB schema, indexes, relations, migrations, seed data, data integrity, snapshots, audit logs, stock consistency, refresh token storage, and query correctness.

---

### `rmf-worker-security`

File: `.claude/agents/rmf-worker-security.md`

Use this worker for threat modeling, auth security, RBAC review, payment security, webhook/callback security, upload security, location privacy, abuse prevention, secret scanning, log safety, and vulnerability review.

**Skills:** `rmf-security-review`

---

### `rmf-worker-qa`

File: `.claude/agents/rmf-worker-qa.md`

Use this worker for targeted QA tasks, test planning, unit tests, integration tests, E2E tests, regression checks, bug reproduction, acceptance criteria, test reports, and release readiness support. For broad testing campaigns, coordinate through `rmf-qa-commander`.

**Skills:** `rmf-payment-testing`, `rmf-delivery-rider-testing`, `rmf-api-contract-testing`

---

### `rmf-worker-devops`

File: `.claude/agents/rmf-worker-devops.md`

Use this worker for Docker, Docker Compose, CI/CD, Render, Vercel, environment variables, MongoDB Atlas, Google Cloud Storage, Cloudflare, logs, monitoring, health checks, and production readiness.

---

### `rmf-worker-documentation`

File: `.claude/agents/rmf-worker-documentation.md`

Use this worker for README updates, architecture docs, API documentation, setup guides, deployment guides, developer guides, user guides, changelogs, ADRs, and documenting agent findings.

---

### `rmf-worker-integration`

File: `.claude/agents/rmf-worker-integration.md`

Use this worker for MTN MoMo, Airtel Money, Google Cloud Storage, maps, directions, SMS, email, push notifications, webhooks, provider clients, retry logic, and external API error handling.

This worker must use `rmf-worker-research` before implementing or changing external provider integrations.

**Skills:** `rmf-payment-testing`, `rmf-security-review`

---

### `rmf-worker-performance`

File: `.claude/agents/rmf-worker-performance.md`

Use this worker for API performance, database query performance, frontend loading speed, image optimization, caching, pagination, search performance, checkout speed, rider assignment speed, admin dashboard performance, and load behavior.

**Skills:** `rmf-performance-mobile-first`

---

## Correct RMF Agent Chain

```txt
User
  → rmf-product-strategist
  → rmf-master-orchestrator
  → worker agents / research / implementation
  → rmf-user-simulation-lab
  → rmf-ux-analyst
  → rmf-qa-commander
  → rmf-master-orchestrator final review
  → user approval
```

`rmf-user-simulation-lab` tests practical role-based usage as buyer, seller, rider, and admin where needed.

`rmf-ux-analyst` evaluates emotional friction, trust, clarity, design quality, and user confidence.

`rmf-qa-commander` performs formal testing and release readiness checks.

---

## Normal Workflow

Use this workflow for significant work:

0. If the user has an unclear idea or early concept, use `rmf-product-strategist` first to refine the idea and prepare the orchestrator mission.
1. User gives a task.
2. If the task is large, use `rmf-master-orchestrator`.
3. Orchestrator classifies the task size.
4. Orchestrator assigns worker agents using exact names.
5. If external knowledge is needed, assign `rmf-worker-research`.
6. Workers inspect code before editing.
7. Workers respect file ownership.
8. Workers submit reports.
9. Orchestrator reviews reports.
10. Orchestrator checks conflicts, security, correctness, and compatibility.
11. Orchestrator requests corrections if needed.
12. QA Commander tests relevant flows.
13. UX Analyst checks real user experience when needed.
14. Security review happens before final approval.
15. Orchestrator gives the final mission report.

---

## Research Routing

Workers must not guess from memory when external knowledge is needed.

Use this route:

```txt
worker agent
  → rmf-worker-research
  → rmf-research-intelligence
  → implementation-ready findings
```

Research is required before features involving:

* payments
* external APIs
* legal/privacy rules
* delivery/rider logic
* market/vendor workflows
* competitor-inspired features
* pricing/cost decisions
* UX benchmarks
* security-sensitive decisions
* provider documentation
* current technical standards

`rmf-worker-research` is responsible for turning raw research into practical notes that workers can use safely.

---

## Skills Layer

Reusable RMF skills live in:

```txt
.claude/skills/
```

Agents should use relevant skills when available. Skills provide tested checklists, workflows, output formats, and RMF-specific rules that agents should follow rather than reinvent.

Available skill documents:

```txt
.claude/skills/rmf-marketplace-ui-ux/SKILL.md
.claude/skills/rmf-frontend-design-system/SKILL.md
.claude/skills/rmf-security-review/SKILL.md
.claude/skills/rmf-payment-testing/SKILL.md
.claude/skills/rmf-delivery-rider-testing/SKILL.md
.claude/skills/rmf-api-contract-testing/SKILL.md
.claude/skills/rmf-performance-mobile-first/SKILL.md
.claude/skills/rmf-research-method/SKILL.md
```

Research notes and source documentation:

```txt
.claude/skills/RESEARCH-NOTES.md
```

When a relevant skill exists, agents should apply it instead of relying only on generic reasoning.

---

## UI/UX Design Preference

RMF should feel clean, modern, trustworthy, mobile-first, and easy to use.

Preferred design direction:

* mostly white background
* restrained color palette (maximum 3–4 colors total)
* subtle borders
* clean cards
* clear hierarchy
* good spacing (8px grid)
* readable typography
* simple buttons
* mobile-first layouts
* clear forms
* strong checkout clarity
* clear delivery status
* simple seller/rider actions

Avoid:

* too many colors mixed together
* messy color fusion
* unnecessary linear gradients
* flashy sections that hurt clarity
* copying competitor designs directly
* hiding prices or delivery fees
* confusing user flows

The UX and frontend agents may research similar marketplace and delivery apps, but they must extract patterns and pain points, not copy designs. RMF should have its own original, clean, trustworthy design.

Full design token and component specifications: `.claude/skills/rmf-frontend-design-system/SKILL.md`

---

## Problem Reporting Standard

Every agent must convert problems into task-ready reports for `rmf-master-orchestrator`.

Every problem report must include:

1. Problem title
2. Severity: critical, high, medium, or low
3. Affected user: buyer, seller, rider, admin, developer, or system
4. Affected flow
5. Evidence or reproduction steps
6. Expected result
7. Actual result
8. Files or modules likely involved
9. Suggested worker agent to fix it
10. Security, privacy, payment, or business impact
11. Acceptance criteria
12. Test that should prove the fix

The report must be clear enough that `rmf-master-orchestrator` can immediately assign it to the correct worker agent without asking for clarification.

---

## Worker Report Standard

Every worker must report back to `rmf-master-orchestrator` using this format:

1. Worker agent name
2. Task assigned
3. Files inspected
4. Files changed
5. What was implemented
6. Problems found
7. Security/privacy/payment concerns
8. Tests run
9. Tests still needed
10. Remaining risks
11. Recommendation: approve, needs correction, or blocked

Workers must not approve their own work as final. Final approval belongs to `rmf-master-orchestrator`.

---

## Severity Rules

### Critical

Critical issues must be escalated immediately.

Examples:

* payment loss
* duplicate charging
* fake payment success
* unauthorized access
* private data leak
* location privacy leak
* broken checkout
* order corruption
* admin privilege bypass
* exposed secrets

### High

Examples:

* broken seller/rider flow
* wrong stock updates
* wrong commission
* failed delivery assignment
* broken authentication
* serious mobile layout issue

### Medium

Examples:

* confusing UI
* weak error messages
* missing loading state
* incomplete validation
* slow page or API

### Low

Examples:

* minor design issue
* typo
* spacing issue
* non-blocking UX improvement

---

## File Ownership Rule

The orchestrator must avoid assigning the same file to multiple workers at the same time.

If two workers need the same file, the orchestrator must:

1. coordinate the order of edits
2. define which worker owns which part
3. merge carefully
4. check conflicts
5. rerun relevant tests
6. require updated reports before approval

Workers must not overwrite each other's work.

---

## Final Approval Rule

No feature is considered complete until:

* worker reports are reviewed
* critical/high issues are resolved or explicitly accepted
* relevant tests pass
* security-sensitive areas are reviewed
* QA Commander gives a release verdict when needed
* UX Analyst reviews affected user flows when needed
* orchestrator gives final approval

---

## Recommended Commands

Use:

```txt
/agents
```

to view and manage agents.

Recommended usage:

```txt
Use rmf-master-orchestrator for large features.
Use rmf-qa-commander before release.
Use rmf-ux-analyst after UI/user-flow changes.
Use rmf-research-intelligence for grounded research.
Use rmf-worker-research before external-provider or market-dependent implementation.
```

---

## Browser Testing

RMF agents can use Playwright MCP when configured. Browser testing should be used for user-facing flows including buyer, seller, rider, admin, checkout, delivery, menu ordering, dashboards, and onboarding.

Browser-capable agents:
- `rmf-user-simulation-lab` — practical role-based flow testing
- `rmf-ux-analyst` — UX quality and emotional friction evaluation
- `rmf-qa-commander` — formal E2E, regression, and release readiness
- `rmf-worker-frontend` — verifying rendered UI after implementation
- `rmf-worker-qa` — targeted browser-based bug reproduction and regression
- `rmf-worker-performance` — real browser load time and interaction measurement

All browser testing prefers `http://localhost:3000`. Real payment credentials and production accounts must not be used without explicit approval.

---

## Final Rule

When unsure, do not guess.

Inspect the code, use the correct agent, route research properly, protect security, write tests, and report findings in task-ready format.
