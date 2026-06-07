---
name: rmf-frontend-design-system
description: RMF design tokens, component patterns, typography, color palette, spacing, and UI conventions for building clean, trustworthy, mobile-first marketplace screens.
---

# RMF Frontend Design System Skill

## When to Use

Apply this skill when:

- Building any new page or component for RMF
- Reviewing existing UI for design consistency
- Choosing colors, spacing, shadows, or typography
- Deciding how to style cards, buttons, forms, or navigation
- Resolving design inconsistencies between screens

## Agents That Should Use This Skill

- `rmf-worker-frontend` — primary user; apply to every frontend task
- `rmf-ux-analyst` — reference when evaluating visual design quality

---

## Design Philosophy

RMF should look and feel like a **clean, premium, trustworthy marketplace** — not a flashy app.

The design language is:
- **Minimal**: remove everything that does not serve the user
- **Trustworthy**: professional, stable, predictable
- **Mobile-first**: designed at 375px, enhanced for larger screens
- **Restrained**: few colors, used with purpose

Think of the cleanest version of a market stall — organized, honest, easy to navigate.

---

## Color Palette

Use this palette. Do not introduce additional colors without strong justification.

| Role | Name | Value | Usage |
|---|---|---|---|
| Background | White | `#FFFFFF` | Page backgrounds, card fills |
| Surface | Off-white | `#F8F9FA` | Section backgrounds, alternate rows |
| Border | Subtle gray | `#E5E7EB` | Card borders, dividers, input borders |
| Text primary | Near-black | `#111827` | Headings, product names, key labels |
| Text secondary | Medium gray | `#6B7280` | Descriptions, metadata, timestamps |
| Text disabled | Light gray | `#9CA3AF` | Placeholder text, disabled inputs |
| Primary action | RMF Green | `#00A859` | Primary buttons, links, verified badges, success states |
| Primary hover | Dark green | `#008A47` | Hover state for primary buttons |
| Danger / CTA | Accent red | `#DC2626` | Errors, dispute alerts, critical actions |
| Warning | Amber | `#F59E0B` | Pending states, warnings |
| Info | Blue | `#2563EB` | Informational alerts only |
| Status: confirmed | Green | `#16A34A` | Order confirmed, delivery complete |
| Status: pending | Orange | `#EA580C` | Pending payment, rider assigned |
| Status: refund | Red | `#DC2626` | Refunds, disputes |

**Do not:**
- Mix more than 2 accent colors on a single screen
- Use gradients on backgrounds, cards, or buttons
- Use bright or saturated colors for large areas
- Invent new status colors — always use the table above

---

## Typography

Use a single sans-serif font family throughout. **Inter** or **Roboto** are recommended (both widely available and legible on low-resolution screens).

| Element | Size | Weight | Line height | Color |
|---|---|---|---|---|
| Page title / H1 | 24px | 700 | 1.25 | Text primary |
| Section title / H2 | 20px | 600 | 1.3 | Text primary |
| Card title / H3 | 16px | 600 | 1.4 | Text primary |
| Body text | 14px | 400 | 1.5 | Text primary |
| Secondary / meta | 13px | 400 | 1.4 | Text secondary |
| Small label | 12px | 400 | 1.3 | Text secondary |
| Price | 18px | 700 | 1.2 | Text primary |
| Button label | 14px | 600 | 1 | White (on colored button) |

**Rules:**
- Never use more than 2 font weights on a single card
- Price is always bold and larger than description text
- Error messages: 13px, Text danger, always below the relevant field

---

## Spacing System

Use an 8px base grid. All padding, margin, and gap values must be multiples of 4px.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Tight spacing within components |
| `space-2` | 8px | Compact padding, icon gaps |
| `space-3` | 12px | Small padding inside cards |
| `space-4` | 16px | Standard padding, form field spacing |
| `space-5` | 24px | Section padding, generous card padding |
| `space-6` | 32px | Between sections |
| `space-8` | 48px | Page-level top/bottom padding |

---

## Shadows

Use shadows sparingly. Flat + subtle shadow is the RMF aesthetic.

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | Default card, input on focus |
| `shadow-md` | `0 4px 8px rgba(0,0,0,0.08)` | Card hover state |
| `shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` | Modals, bottom sheets |

Never use: `box-shadow: 0 10px 40px rgba(0,0,0,0.3)` or any heavy shadow on content cards.

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4px | Buttons, input fields, tags |
| `radius-md` | 8px | Cards, panels, product images |
| `radius-lg` | 12px | Modals, bottom sheets |
| `radius-full` | 9999px | Avatar circles, pill badges |

Do not use `radius-lg` on product cards — it looks playful, not professional.

---

## Component Patterns

### Product Card

```
┌─────────────────────────────┐  border: 1px solid #E5E7EB
│  [Product Image — 4:3 ratio] │  border-radius: 8px
│                               │  shadow: shadow-sm
│  Product Name (H3)            │  padding: 12px
│  ★★★★☆  4.2  (89)            │  background: white
│  1,500 RWF                    │
│  [Seller Name ✓ Verified]     │  Price: 18px bold
│  [Add to Cart button]         │  Seller: 12px text-secondary
└─────────────────────────────┘
```

- Image aspect ratio: 4:3 (never crop faces or key product details)
- Product name: 2 lines max, truncate with ellipsis
- Price: always bold, always visible without scrolling
- Verified badge: small green checkmark (`✓`) next to seller name
- CTA button: full width of card, green background, white text

### Button Variants

```
Primary:   bg #00A859, text white, padding 12px 24px, radius 4px
Secondary: bg white, border 1px #E5E7EB, text #111827, padding 12px 24px
Danger:    bg #DC2626, text white (for irreversible actions only)
Text link: no background, text #00A859, underline on hover
Disabled:  bg #E5E7EB, text #9CA3AF, cursor not-allowed
```

- One primary button per screen section
- Never place two primary buttons next to each other
- Loading state: replace button text with spinner, disable click

### Form Inputs

```
Input field: border 1px #E5E7EB, radius 4px, padding 10px 12px, bg white
Focus:       border #00A859, shadow-sm
Error:       border #DC2626, error message below in 13px red text
Label:       14px, text-primary, above input, margin-bottom 4px
Placeholder: text-disabled color
```

- Labels always above inputs, never floating
- Error messages always below the specific field
- Required indicator: red asterisk (*) after label, not before

### Status Badges

```
Confirmed:    bg #DCFCE7, text #16A34A, radius full, padding 2px 8px
Pending:      bg #FEF3C7, text #B45309, radius full
In Transit:   bg #DBEAFE, text #1D4ED8, radius full
Disputed:     bg #FEE2E2, text #DC2626, radius full
```

Small pill badges — never use large filled background areas for status.

### Empty States

When a list has no items, always show:
1. A simple icon (not an illustration with many colors)
2. A short, plain-language explanation ("No orders yet")
3. A single suggested action ("Browse products" or "Add your first product")

### Loading States

Use skeleton screens (gray placeholder shapes) for content that loads from API. Never show a blank white screen or a spinning logo in the center of a page.

---

## Mobile-First Layout Rules

- Design at 375px first; test at 414px and 768px before shipping
- All tap targets: minimum 44×44px
- Bottom navigation bar for mobile (buyer: Home / Search / Cart / Orders / Profile)
- Checkout CTA button: sticky at bottom of screen on mobile
- No horizontal scrolling on any page
- Forms: single-column, full-width inputs
- Product grid: 2 columns on mobile (≥375px), 3 on tablet (≥768px), 4 on desktop

---

## Checkout-Specific Rules

1. Step indicator at top: "Cart → Address → Payment → Confirm" — always show current step
2. Delivery fee line item must appear before the payment screen
3. Total is the last line item, always bold, always the largest text on the screen
4. Payment method selector: radio buttons with icon + label + "Most popular" badge on MTN MoMo
5. No secondary actions (links, optional extras) on the payment confirmation screen
6. After payment submit: full-screen loading state with "Processing your payment via MTN MoMo..."

---

## Checklist

**Before shipping any screen:**
- [ ] Only colors from the palette used
- [ ] No gradients on backgrounds or buttons
- [ ] Typography matches the type scale
- [ ] Spacing uses 4px grid
- [ ] All interactive elements meet 44×44px minimum
- [ ] Loading state implemented
- [ ] Empty state implemented
- [ ] Error state implemented
- [ ] Tested at 375px width
- [ ] No horizontal scroll
- [ ] One primary CTA per section

---

## Output Format

When reporting design system compliance issues:

```
Screen: [screen name]
Issue: [specific element violating design system]
Current: [what it is now]
Required: [what it should be per design system]
Severity: low / medium / high
```

---

## What Not to Do

- Do not use gradients on any UI element
- Do not introduce a new color not in the palette
- Do not use more than 1 primary button per screen section
- Do not use heavy shadows that make the UI look dated
- Do not design desktop-first and then try to fit mobile
- Do not use more than 2 font weights on a single card
- Do not hide prices, fees, or commission information below the fold

---

## RMF-Specific Rules

- MTN MoMo must always be the first listed payment option with its logo visible
- Seller verified badge must always appear next to seller name, on every surface where seller name appears
- Commission deduction must be a visible line item in seller earnings views — never hidden
- Market stall number must be accommodatable in address/pickup fields
- All monetary values must include the currency code: "1,500 RWF" not "1,500"
