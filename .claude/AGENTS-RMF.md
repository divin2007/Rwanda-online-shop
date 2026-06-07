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

> Brainstorm -> Requirements -> Architecture -> Approval -> Implementation

Use `rmf-product-strategist` when you have a raw idea and need help turning it into a proper mission.

Example:

```txt
Use rmf-product-strategist.

Idea:
I want RMF to support menu-based ordering for restaurants, hotels, cafes, and food vendors.

Talk with me first. Help me refine the idea, identify affected users, decide which agents
should be involved, and create the correct command for rmf-master-orchestrator.

Do not implement code yet.
```

---

### 1. `rmf-master-orchestrator`

The engineering manager and gatekeeper of the RMF AI development team.

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

* Deploys Architecture Lead before worker assignment (medium/large/huge tasks)
* Batches very large missions before assigning any worker
* Breaks each batch into worker tasks with precise file ownership
* Assigns work to exact worker agents -- no invented names
* Enforces file ownership -- no two workers edit the same file simultaneously
* Reviews actual changed files, not only worker reports
* Detects conflicts between workers and resolves them before approving
* Sends issues back for correction with exact fix briefs
* Runs the Bug Fix Loop -- bugs from validation agents become worker tickets
* Requires independent retest before marking any bug RESOLVED
* Requires QA/security/simulation before final approval
* Enforces the Production Done Contract before any worker is APPROVED
* Produces the Final Mission Report

The orchestrator is the only agent that gives final approval for serious work. It never approves based on worker reports alone -- it reads actual changed files and requires independent QA/simulation retest before resolving bugs.

---

### 1.5. `rmf-architecture-lead`

File: `.claude/agents/rmf-architecture-lead.md`

The technical architect who inspects the real codebase before implementation work begins.

Use this agent for medium, large, and huge missions -- invoked by `rmf-master-orchestrator` after pre-flight research and before worker assignment.

Responsibilities:

* Inspects actual project structure, services, schemas, components, and APIs
* Identifies what already exists vs. what must be created
* Prevents duplicate systems and redundant implementations
* Creates a precise file ownership map (which worker edits which file)
* Issues SIZE WARNINGs when missions must be batched
* Produces implementation tickets per worker with exact file lists and constraints
* Flags breaking changes, migration requirements, and architecture risks

The Architecture Lead does not write code. It produces tickets that workers execute.

`rmf-master-orchestrator` must wait for the Architecture Lead report before assigning any implementation worker.

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

### `rmf-architecture-lead`

File: `.claude/agents/rmf-architecture-lead.md`

Invoked by `rmf-master-orchestrator` before any implementation begins on medium/large/huge tasks. Inspects the real codebase, produces file ownership tickets, prevents duplicate systems, issues SIZE WARNINGs when missions must be batched.

**Does not write code.** Produces architecture reports and worker tickets only.

---

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
User / Product Owner
  -> rmf-product-strategist       (clarify idea, prepare mission)
  -> rmf-master-orchestrator      (engineering manager -- assigns, reviews, approves)
  -> rmf-architecture-lead        (inspect codebase, produce file ownership map)
  -> specialist workers           (implement assigned files only)
  -> rmf-user-simulation-lab      (practical role-based flow testing)
  -> rmf-ux-analyst               (emotional friction, trust, design quality)
  -> rmf-qa-commander             (formal testing, release readiness verdict)
  -> rmf-worker-security          (security review)
  -> Bug Fix Loop                 (bugs -> worker tickets -> fix -> retest)
  -> rmf-master-orchestrator      (final release review)
  -> User Approval
```

**`rmf-product-strategist`** turns raw ideas into structured missions. Does not implement.

**`rmf-master-orchestrator`** is the engineering manager. Assigns work, reviews actual code, runs the Bug Fix Loop, enforces the Production Done Contract, and gives final approval.

**`rmf-architecture-lead`** inspects the real codebase before workers start. Produces file ownership tickets. Issues SIZE WARNINGs. Prevents duplicate systems.

**Specialist workers** implement only their assigned files. They report honestly including what was NOT implemented.

**`rmf-user-simulation-lab`** tests practical role-based usage as buyer, seller, rider, and admin.

**`rmf-ux-analyst`** evaluates emotional friction, trust, clarity, design quality, and user confidence.

**`rmf-qa-commander`** performs formal testing, regression, payment testing, and release readiness checks.

**Bug Fix Loop** -- bugs from QA/simulation/UX/security go back to the orchestrator as worker tickets. Workers fix. QA retests. Orchestrator approves only after retest passes.

---

## Normal Workflow

Use this workflow for significant work:

0. **Idea clarification**: If the user has an unclear idea, use `rmf-product-strategist` first to refine it and prepare the orchestrator mission.
1. **Task received**: User gives a task. Orchestrator classifies it as small/medium/large/huge.
2. **Batching**: If the task is very large or covers multiple features, the orchestrator splits it into production batches and presents the plan to the user. User confirms which batch to run first.
3. **Pre-flight research**: If the task involves payments, legal rules, external APIs, or unknown territory, orchestrator deploys `rmf-worker-research` first.
4. **Architecture inspection**: For medium/large/huge tasks, orchestrator deploys `rmf-architecture-lead` to inspect the real codebase and produce file ownership tickets.
5. **Worker assignment**: Orchestrator assigns workers using the file ownership map from the Architecture Lead. No file is assigned to two workers simultaneously.
6. **Parallel execution**: Independent workers run in parallel (based on file ownership). Dependent workers run sequentially.
7. **Workers inspect then edit**: Workers read assigned files before editing. Workers implement only assigned files.
8. **Worker reports**: Workers submit honest reports including what was NOT implemented and tests NOT run.
9. **Orchestrator review**: Orchestrator reads actual changed files, not only reports. Checks the Production Done Contract for every worker.
10. **Corrections**: Workers receiving NEEDS_CORRECTION fix exactly what was flagged -- no scope creep.
11. **Validation wave**: After all implementation workers are approved, orchestrator deploys `rmf-user-simulation-lab`, then `rmf-ux-analyst` and `rmf-qa-commander` in parallel.
12. **Security review**: `rmf-worker-security` runs a final cross-cutting review.
13. **Bug Fix Loop**: Bugs from validation agents become worker tickets. Workers fix. QA retests. Orchestrator approves only after retest passes.
14. **Final approval**: Orchestrator issues Final Mission Report only when all verdicts are PASS or PASS WITH FIXES and Production Done Contract is satisfied.
15. **User approval**: User reviews Final Mission Report and gives final sign-off.

---

## Research Routing

Workers must not guess from memory when external knowledge is needed.

Use this route:

```txt
worker agent
  -> rmf-worker-research
  -> rmf-research-intelligence
  -> implementation-ready findings
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
* restrained color palette (maximum 3-4 colors total)
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

## Worker Bypass Protection Rule

If a user gives a medium, large, or huge task directly to a worker agent (skipping `rmf-master-orchestrator` and `rmf-architecture-lead`), the worker must refuse to start implementation and instead recommend the correct routing:

**A task is medium/large/huge if it:**
- Touches more than one service
- Requires changes to more than 3 files
- Crosses multiple domains (e.g., backend + frontend, or schema + API + UI)
- Involves payments, auth, RBAC, or database migrations

**When a worker receives such a task directly, it must respond with:**
> "This task is [medium/large/huge] and requires routing through `rmf-master-orchestrator` and `rmf-architecture-lead` first. Direct assignment skips codebase inspection, file ownership mapping, and batching decisions, which leads to conflicts, duplicate systems, and partial implementations. Please route this through the orchestrator."

Workers may only begin implementation when:
1. The task was assigned by `rmf-master-orchestrator` with an explicit file ownership ticket, OR
2. The task is genuinely small (single file, single bug, clearly scoped, no cross-domain impact)

---

## Worker Report Standard

Every worker must report back to `rmf-master-orchestrator` using this exact format:

1. Worker name
2. Task assigned
3. Files inspected (read before editing)
4. Files changed (with specific change summary per file)
5. What was implemented
6. **What was NOT implemented** -- explicit list; "nothing" must be justified
7. Tests/builds run and results
8. **Tests NOT run and why** -- explicit; "not applicable" must be justified
9. Remaining risks
10. Recommendation: **COMPLETE** | **NEEDS_REVIEW** | **BLOCKED**

**Definitions:**
- `COMPLETE` -- all assigned work done, Production Done Contract satisfied
- `NEEDS_REVIEW` -- work done but has open questions or risks
- `BLOCKED` -- cannot proceed; state exactly what is needed to unblock

**Workers must never:**
- Approve their own work as final (that is the orchestrator's job)
- Report COMPLETE when user-visible features were left out
- Leave field 6 empty when skipping loading states, error handling, or tests
- Report tests as run when they were not run

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

## Production Done Contract

A task is NOT complete until all applicable items in this contract are satisfied. The orchestrator checks this before giving final approval. Workers must check this before recommending COMPLETE.

- [ ] Backend behavior exists and is reachable via API
- [ ] Database schema / migration supports it when the feature requires persistent data
- [ ] Frontend exposes it to the correct user role (if the feature is user-facing)
- [ ] Permissions / RBAC are correct -- the right roles can access it, wrong roles cannot
- [ ] Loading states exist for async operations (skeleton, spinner, or equivalent)
- [ ] Empty states exist for lists and dashboards with no data
- [ ] Error states exist and show human-readable messages (not raw API codes)
- [ ] Fake / mock fallback data is removed (unless the data is test-only)
- [ ] Relevant tests pass (unit, integration, or E2E as applicable)
- [ ] Frontend build and TypeScript typecheck pass (if frontend was changed)
- [ ] QA or User Simulation has verified the real user flow end-to-end
- [ ] Remaining risks and gaps are explicitly listed (not hidden)

Any item marked NO requires a correction. The orchestrator must not ship a feature with silent omissions.

---

## Bug Fix Loop

When QA Commander, User Simulation Lab, UX Analyst, or Security Worker reports bugs:

1. Each bug becomes a worker ticket on the task board (status: BUG_FIX)
2. The orchestrator assigns each bug to the correct worker based on domain and files
3. The worker brief must include: exact bug, affected files, reproduction steps, acceptance criteria, confirming test
4. The worker fixes ONLY the assigned bug -- no scope changes
5. The worker reports back with files changed, what changed, and the test that proves the fix
6. The same validation agent that found the bug retests the specific flow
7. The retesting agent also runs regression checks on related flows
8. The orchestrator approves only after the retest returns PASS or PASS WITH FIXES
9. If the retest finds new bugs, restart the loop from step 1

**Critical rule**: A bug is not RESOLVED until an independent validation agent confirms it. The fixing worker cannot confirm their own fix. A fix that passes but introduces a regression is rejected.

---

## Batching Guidance

When a user gives a very large or mixed request covering multiple features, the orchestrator must split it into production batches.

A production batch is a self-contained unit that can be implemented, tested, and verified independently. Workers in one batch do not depend on unfinished work from another batch.

Example batching for a large sprint:
- Cart and navigation persistence
- Seller wallet, earnings, and disputes
- Rider cancellation and rebroadcast
- Rider pickup marketplace
- Premium rider and seller monetization
- Search ranking and sponsored placement
- Product quality grades, disputes, and refunds
- MTN-only payment cleanup
- Messages and notifications

The orchestrator presents the batch plan to the user and gets confirmation before running any batch. Running all batches simultaneously causes conflicts, incomplete implementations, and impossible QA.

---

## Final Approval Rule

No feature is considered complete until:

* Architecture Lead inspection was completed (for medium/large/huge tasks)
* Worker reports are reviewed AND actual changed files are read
* Production Done Contract is fully satisfied (all applicable items YES)
* Production Readiness Matrix is filled and all rows show YES or N/A
* Critical/high issues are resolved (not just accepted -- accepted risks must be documented and user must confirm)
* Relevant tests pass
* Security-sensitive areas are reviewed by `rmf-worker-security`
* QA Commander gives **PASS** verdict (not PASS WITH FIXES -- that means bugs remain)
* User Simulation Lab gives **PASS** verdict (not PASS WITH FIXES)
* UX Analyst reviews affected flows when needed
* Bug Fix Loop is complete (every reported bug has a PASS retest, not just PASS WITH FIXES)
* Orchestrator gives final approval
* User gives sign-off

**PASS WITH FIXES is NOT final approval.** It means bugs remain. Those bugs must either be fixed and retested (preferred), or the user must explicitly accept each remaining risk before a conditional final report is issued. A conditional report must list every unfixed bug and the user's risk acceptance statement.

**FAIL from any agent blocks all further approval steps.** There is no path from FAIL to conditional approval. All FAIL items must be fixed and retested.

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
- `rmf-user-simulation-lab` -- practical role-based flow testing
- `rmf-ux-analyst` -- UX quality and emotional friction evaluation
- `rmf-qa-commander` -- formal E2E, regression, and release readiness
- `rmf-worker-frontend` -- verifying rendered UI after implementation
- `rmf-worker-qa` -- targeted browser-based bug reproduction and regression
- `rmf-worker-performance` -- real browser load time and interaction measurement

All browser testing prefers `http://localhost:3000`. Real payment credentials and production accounts must not be used without explicit approval.

---

## Final Rule

When unsure, do not guess.

Inspect the code, use the correct agent, route research properly, protect security, write tests, and report findings in task-ready format.
