---
name: rmf-research-method
description: Structured research workflow for RMF covering how to formulate research questions, route requests through rmf-research-intelligence, evaluate sources, translate findings into implementation notes, and save results for future use.
---

# RMF Research Method Skill

## When to Use

Apply this skill when:

- Any worker agent needs external knowledge before implementing
- A payment provider API's behavior needs verification
- Legal or regulatory requirements need to be confirmed
- Competitor analysis is needed before designing a feature
- UX benchmarks or design patterns need to be grounded in real examples
- A previous research result needs to be re-verified (information may be stale)

## Agents That Should Use This Skill

- `rmf-worker-research` — primary user; this skill defines the full research workflow
- `rmf-research-intelligence` — primary research executor; follow this skill's output format
- `rmf-master-orchestrator` — reference when deciding whether to deploy research before a task

---

## Research Routing Path

All external research follows this path:

```
Requesting agent (backend, frontend, integration, security, QA, UX, etc.)
  ↓
rmf-worker-research (translates the request into a precise research question)
  ↓
rmf-research-intelligence (executes online research, verifies sources)
  ↓
rmf-worker-research (translates findings into implementation-ready notes)
  ↓
Requesting agent (receives actionable guidance, not raw research)
```

Workers never research directly. `rmf-worker-research` is the routing layer.

---

## Step 1: Check Project Files First

Before triggering online research, always:

1. Check `.claude/skills/` for an existing skill that answers the question
2. Check `.claude/research-knowledge-base/` for prior research on the topic
3. Check `docs/` for existing architecture decisions, API docs, or setup guides
4. Check the codebase itself — the answer may be in an existing implementation

If found: use the existing knowledge. Verify it is current (check dates and commit history).
If not found or stale: proceed to Step 2.

---

## Step 2: Formulate a Precise Research Question

A vague research request produces vague results. Before querying `rmf-research-intelligence`, define:

| Field | Example |
|---|---|
| **What to find out** | "Does MTN MoMo v2 API require idempotency keys on Request-to-Pay?" |
| **Why it matters for RMF** | "We need to prevent duplicate charges when client retries a failed request" |
| **What decision it informs** | "Whether to generate UUID v4 per request or per order" |
| **Relevant context** | "Current implementation uses X-Reference-Id = orderId; is this correct?" |
| **How current does it need to be** | "Must be 2024–2025 — API changed in v2" |

Do not say: "Research MTN MoMo." Say: "Verify whether MTN MoMo v2 Request-to-Pay idempotency requires a new UUID per retry or can reuse the original X-Reference-Id."

---

## Step 3: Conduct Research (rmf-research-intelligence executes this step)

Research prioritization:

1. **Official documentation** — provider portals, government sites, OWASP — highest trust
2. **Respected engineering publications** — Martin Fowler, Google, Stripe engineering blog, etc.
3. **Reputable industry resources** — Smashing Magazine, CSS-Tricks (for UX/frontend), Stack Overflow (for specific technical questions with high-score answers)
4. **News and regional sources** — for Rwanda market context, local tech news
5. **Open-source projects** — review for patterns, not for copying code

**Reliability flags:**
- Sources older than 18 months: flag as "potentially outdated" for API and regulatory topics
- Single-source claims: always look for a second confirmation
- Community forums without official citation: use only as a starting point, verify with official docs

---

## Step 4: Filter and Translate

`rmf-research-intelligence` produces raw research. `rmf-worker-research` must translate it:

**Raw research output → Implementation-ready notes**

| Raw finding | Translation |
|---|---|
| "MTN MoMo requires X-Reference-Id to be UUID v4 and unique per request" | "Generate a new UUID v4 for every payment initiation call. Do not reuse order IDs as the reference. Store this UUID in the payment record for idempotency checking." |
| "OWASP says payment amounts should not be trusted from client" | "Do not accept `amount` from the request body in POST /payments. Recalculate from order items + delivery fee on the server before calling MTN MoMo API." |
| "Jumia users report delivery fee revealed too late as the #1 cause of cart abandonment" | "Show delivery fee on the cart screen and on the product detail page — not only at checkout payment step." |

The output to the requesting agent must be actionable, concrete, and RMF-specific. Not a summary of the web.

---

## Step 5: Save Useful Findings

When research produces findings that other agents or future conversations will need:

1. Save to `.claude/research-knowledge-base/` with a dated, descriptive filename
2. Format: Markdown with clear section headers, source citations, and date
3. Note what the finding was used for (so future agents know its context)

**Files to maintain:**
- `.claude/research-knowledge-base/01-payment-providers.md` — MTN MoMo, Airtel Money API details
- `.claude/research-knowledge-base/02-competitor-analysis.md` — Jumia, Vuba Vuba, Kapiten pain points
- `.claude/research-knowledge-base/03-rwandan-legal-context.md` — Data Protection Law, RURA, RRA
- `.claude/research-knowledge-base/04-design-references.md` — Design patterns, UX benchmarks

---

## Source Quality Checklist

Before citing a source in research findings:

- [ ] Source is identifiable (has a named author, organization, or official body)
- [ ] Publication date is visible — if > 18 months old, explicitly flag it
- [ ] Source is relevant to RMF's context (Rwanda, mobile money, marketplace, or explicitly comparable)
- [ ] For regulatory/legal claims: source must be the official government or regulatory body
- [ ] For API behavior claims: source must be the official developer documentation, not a blog
- [ ] Critical decisions supported by at least 2 independent sources

---

## When NOT to Research

Do not trigger research for:
- Questions answerable by reading the codebase
- Questions already answered in existing skills or research notes
- Implementation details that are RMF-internal conventions (ask `rmf-master-orchestrator` or read the code)
- General programming syntax (these are not Rwanda-specific or provider-specific)

Research is expensive in time. Use it when external grounding is genuinely needed.

---

## Checklist (Quick Reference)

**Before submitting research request:**
- [ ] Checked existing skills and research notes first
- [ ] Question is precise (what, why, what decision it informs)
- [ ] Stated how current the information needs to be

**Before delivering research output:**
- [ ] All claims have a cited source
- [ ] Outdated sources flagged
- [ ] Findings translated to RMF-specific, actionable notes
- [ ] Findings saved to research knowledge base if reusable

---

## Output Format

`rmf-worker-research` delivers findings in this format:

```
## Research Result: [Topic]

### What Was Looked Up
[Precise question that was researched]

### Key Findings (Implementation-Ready)
1. [Actionable finding 1 — specific to RMF]
2. [Actionable finding 2]
3. [...]

### Sources
- [Source name] — [URL] — [date] — reliability: high / medium / low
- ...

### Outdated or Uncertain
[Any findings older than 18 months or not independently confirmed]

### What NOT to Do (based on findings)
[Anti-patterns or mistakes identified]

### Files to Create or Update
[If findings should be saved to research knowledge base]
```

---

## What Not to Do

- Do not deliver raw web search results to the requesting agent — translate them
- Do not rely on memory for current API documentation — always verify with source
- Do not cite a blog post as authoritative for regulatory or payment security claims
- Do not present a single source as definitive for critical decisions (payments, legal, security)
- Do not skip saving findings that will be needed again — future agents will thank you

---

## RMF-Specific Rules

- All payment provider findings must cite the official MTN MoMo or Airtel Money developer portal
- All Rwanda regulatory findings must cite the official government, RURA, or RRA source
- Competitor analysis must be grounded in actual user reviews, documentation, or news — not assumptions
- Research findings for payment or security must be verified from at least 2 independent sources
- Never give implementation advice for payment callbacks without verifying the official callback signature method
