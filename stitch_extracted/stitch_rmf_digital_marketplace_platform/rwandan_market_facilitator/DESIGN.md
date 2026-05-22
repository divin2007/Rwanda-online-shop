---
name: Rwandan Market Facilitator
colors:
  surface: '#fbf9f8'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e3e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#5a4136'
  inverse-surface: '#303030'
  inverse-on-surface: '#f2f0f0'
  outline: '#8e7164'
  outline-variant: '#e2bfb0'
  surface-tint: '#a04100'
  primary: '#a04100'
  on-primary: '#ffffff'
  primary-container: '#ff6b00'
  on-primary-container: '#572000'
  inverse-primary: '#ffb693'
  secondary: '#a63b00'
  on-secondary: '#ffffff'
  secondary-container: '#fc671d'
  on-secondary-container: '#561b00'
  tertiary: '#005ac2'
  on-tertiary: '#ffffff'
  tertiary-container: '#5f97ff'
  on-tertiary-container: '#002f6b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#ffdbce'
  secondary-fixed-dim: '#ffb598'
  on-secondary-fixed: '#370e00'
  on-secondary-fixed-variant: '#7f2b00'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e3e2e2'
typography:
  headline-lg:
    fontFamily: Work Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Work Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Work Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  table-data:
    fontFamily: Work Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

The design system is engineered for the **Rwandan Market Facilitator (RMF)**, targeting a diverse ecosystem of traders, logistics providers, and regulatory bodies. The brand personality is grounded, reliable, and deeply rooted in commerce. It avoids the ethereal tropes of modern SaaS in favor of a **Corporate Modern** aesthetic with a high-utility, "boots-on-the-ground" feel.

The emotional response should be one of **immediate trust and operational clarity**. We achieve this through a tactile, card-based interface that prioritizes information density over white space. The style is strictly flat and functional, utilizing clear borders and a warm, earth-toned palette that reflects local Rwandan contexts without resorting to clichés. Reliability is reinforced through high-contrast typography and explicit status indicators (e.g., verified badges and escrow timelines).

## Colors

The palette is driven by "RMF Orange," a high-visibility hue associated with energy and commerce, balanced by deep neutrals and warm surfaces.

- **Primary & Action:** `#ff6b00` is used for primary calls-to-action and critical interactive states. `#e05300` provides depth for hover states and active buttons.
- **Surface & Background:** The application uses a "Soft Background" (`#fdfaf7`) to reduce eye strain, while "White Cards" (`#ffffff`) and "Warm Orange Surfaces" (`#ffedd5`) create clear content containment.
- **Typography:** "Ink Text" (`#1b1c1c`) ensures maximum legibility for body and data, while "Muted Brown-Gray" (`#574e47`) is reserved for secondary metadata.
- **Functional:** `#3b82f6` is used exclusively for logistics, mapping, and route tracking. `#ba1a1a` signals errors and urgent regulatory alerts.

## Typography

This design system utilizes **Work Sans** as the primary typeface due to its professional, grounded, and highly legible characteristics across various optical sizes. For technical data, transaction IDs, and timestamps, **JetBrains Mono** provides a precise, developer-friendly utility that reinforces the "secure and technical" aspect of the platform.

- **Headlines:** Set with tight tracking and heavy weights to establish a strong hierarchy.
- **Data Density:** Body styles are optimized for compact layouts. `table-data` is specifically tuned for high-density information grids.
- **Localization:** Typography must maintain legibility in Kinyarwanda, English, and French. Ensure line heights are generous enough to accommodate diacritics without clipping.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy on desktop (1280px max-width) and a **Fluid Grid** on mobile to maximize screen real estate for complex data. 

- **Grid:** A 12-column grid is used for desktop, 8-column for tablet, and 4-column for mobile.
- **Density:** Spacing is tight (4px increments) to support a "data-first" approach. Gutters are kept at 16px to allow for more content columns in tables and lists.
- **Mobile-First:** Navigation and primary actions must be within thumb-reach (bottom-oriented for mobile apps). Lists should use full-bleed separators to maximize horizontal space.

## Elevation & Depth

This design system rejects deep shadows and complex blurs in favor of **Tonal Layers and Bold Outlines**. 

- **Surface Tiers:** Hierarchy is established through background color shifts (e.g., a white card on a `#fdfaf7` background).
- **Outlines:** All containers, inputs, and cards use a 1px solid border (`#ebdcd0`). This "Ghost Border" technique creates structure without adding visual weight.
- **Active State:** Only the most critical floating elements (e.g., Modals, Bottom Sheets) may use a very subtle, low-opacity neutral shadow to indicate they sit above the primary interface.
- **Flatness:** Avoid all gradients. Depth is strictly 2D, achieved through stacking and framing.

## Shapes

The shape language is **Soft** but disciplined. 

- **Standard Elements:** Buttons, input fields, and small cards use a 0.25rem (4px) corner radius. This provides a professional touch without feeling overly "consumer-soft" or "playful."
- **Containers:** Larger dashboard cards and modal containers may use the `rounded-lg` (8px) setting to distinguish structural layout blocks from interactive components.
- **Icons:** Should follow a "Stroke" style (2px weight) with slightly rounded terminals to match the UI's geometry.

## Components

- **Buttons:** Primary buttons use `primary_color_hex` with white text. No gradients. Secondary buttons use a 1px border of `primary_color_hex` with an orange label. High-priority "Trade" or "Pay" buttons should be full-width on mobile.
- **Chips & Badges:** Used for status (e.g., "Verified," "In Transit"). Use `label-md` typography. "Verified" badges should pair a checkmark icon with `#3b82f6`.
- **Cards:** Compact and scannable. Card headers should use `#ffedd5` as a subtle background tint to group metadata or titles.
- **Input Fields:** 1px border (`#ebdcd0`) that turns `primary_color_hex` on focus. Labels must always be visible (no floating labels that disappear).
- **Data Tables:** Dense rows (32px - 40px height). Use zebra-striping with `#fdfaf7` for readability. Action icons (edit, view, delete) should be grouped in the final column.
- **Trust Indicators:** Incorporate a "Secure Payment" label near any transaction trigger. Escrow timelines should be visualized with a simple horizontal step-indicator.