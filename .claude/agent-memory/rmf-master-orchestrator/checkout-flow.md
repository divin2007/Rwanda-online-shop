---
name: checkout-flow
description: Confirmed RMF buyer checkout architecture, contracts, and design-vs-reality notes (2026-06-06)
metadata:
  type: project
---

Buyer checkout flow, confirmed by inspection on 2026-06-06.

- Entry: `apps/frontend/src/app/cart/page.tsx` → `/checkout`.
- Checkout UI: `apps/frontend/src/app/checkout/page.tsx` wraps `CheckoutContent.tsx`. CheckoutContent is the single client component holding all checkout state/logic.
- Delivery fee contract: `POST /deliveries/fee` (delivery-service, `@Public()`) body `{from, to, weightFactor?}` → `{success:true, data:{fee,...}}`. FE calls via `deliveryApi`. Fee = ceil(distanceKm/5)*500 RWF.
- Order create: `POST /orders` (order-service) via `orderApi`; FE reads `res.data.data._id` and `order.payment.status` ('pending'|'failed'). One order POST per unique seller (multi-seller cart splits).
- Real-time success: FE subscribes Socket.IO `order:{orderId}:status`; `order.gateway.ts` emits that channel with `{status}`. Success statuses watched: confirmed/paid/PAID/picked_up/in_transit/delivered. IMPORTANT: payment success must be driven only by this socket event, never by a client timer.
- Payment methods shown on checkout UI: MTN_MOMO / AIRTEL_MONEY / TIGO_CASH (NOT labeled PayPack in the UI even though PayPack is the backend gateway). Changing method handling = payment logic = out of scope for UI missions.

Design-vs-reality gap (watch for this):
- Live theme primary is ORANGE `#ff6b00` (`--rmf-green` var is misnamed; design-system.ts `primary.DEFAULT=#ff6b00`). The `rmf-frontend-design-system` SKILL doc says primary green `#00A859` — that is aspirational, NOT live. Match the live orange theme for consistency.
- Real semantic Tailwind tokens come from `apps/frontend/src/styles/design-system.ts`: text-text-primary, text-text-muted, bg-primary, accent-premium, border-border-light, bg-background-surface, bg-primary-cinematic. Utility classes (rmf-input, rmf-container, rmf-btn-primary) defined in `globals.css`.
- Checkout summary card uses `bg-primary-cinematic` + heavy `cinematic-shadow` and cart page uses gradients/glassmorphism + off-white `#fdfaf7` bg — both violate the white-bg/no-gradient/subtle-shadow rules. Pre-existing tech debt; a future restyle pass is warranted.
- Cart stepper uses banned jargon ("Verification", "Escrow Release"); checkout stepper (added 2026-06-06) uses plain words (Cart/Delivery/Payment/Confirm). Align cart later.

**Why:** Future checkout/UI missions must reuse these exact contracts and the orange theme, and avoid re-touching payment-method logic.
**How to apply:** Edit only `CheckoutContent.tsx` for buyer-checkout UI work; never alter the /orders or /deliveries/fee contracts or the socket channel. See [[stack-confirmed]] and [[agent-roster]].
