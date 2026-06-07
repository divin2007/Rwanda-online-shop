---
name: menu-ordering
description: RMF menu-based ordering (restaurant/dining) architecture and contracts, confirmed on 2026-06-06
metadata:
  type: project
---

Menu-based ordering feature (food/dining sellers), built 2026-06-06. Lets sellers register a businessType and offer a structured menu buyers order from, reusing the existing order/payment/delivery pipeline.

Data model:
- `packages/database/src/schemas/menu.schema.ts` — standalone Menu collection. Exports BOTH `menuSchema` (Schema object, for `MongooseModule.forFeature`) and `Menu` (model). One menu per seller (`sellerId` unique). Structure: sections[] -> items[] -> modifiers[] (options[{label,extraPrice}]). Has availabilityHours[], isActive, deletedAt.
- `seller-profile.schema.ts` — added `businessType` enum ['STANDARD','RESTAURANT','HOTEL','CAFE','BAKERY','CATERING','JUICE_BAR','FOOD_KIOSK'], default STANDARD.
- `transaction.schema.ts` products[] — made `productId` OPTIONAL (was required:true, which would reject menu-only orders) and added menuItemId, isMenuItem, stockType, preparationMinutes, dietaryTags, selectedModifiers[]. **Any order-line change must update this subschema or Mongoose silently drops/blocks fields.**

Backend (seller-service, base `/api/v1`, port 3004):
- Menu CRUD in `apps/seller-service/src/menu/` (controller/service/module). Controller `@Controller('sellers/menu')`.
- Writes: `@UseGuards(JwtAuthGuard)`, scoped to `req.user.userId` (no client sellerId on writes — no IDOR). Public read `GET /sellers/menu/public/:sellerId` is `@Public()` and returns a PII-safe projection (NO userId/internal fields), only visible sections + available items.
- businessType: `PATCH /sellers/me/business-type` (enum-validated in `SellerService.updateBusinessType`, NOT raw passthrough).
- Public discovery: `GET /sellers/discover?businessType=CSV` is `@Public()` (`findPublic`, PII-safe select — never KYC doc URLs). Added because the global JwtAuthGuard makes plain `GET /sellers` 401 for guests; discovery (home/markets/storefront) must work logged-out.

Backend (order-service):
- `snapshotMenuItems(products)` in order.service prices menu lines server-side: unitPrice = item.price + sum(selected modifier extraPrice), looked up from Menu collection. NEVER trusts client unitPrice (unit-tested). Sets stockType='on_demand', isMenuItem=true.
- createOrder routes lines with `menuItemId` through snapshotMenuItems, then snapshotOrderProducts (which passes menu lines through untouched). Mixed carts supported.
- decrement/increment stock + incrementProductOrders SKIP lines without productId / isMenuItem.
- Menu model registered in `order.module.ts` forFeature (NOT app.module — app.module only does forRoot). Menu is the 11th constructor arg of OrderService (spec updated).

Frontend:
- Seller mgmt: `apps/frontend/src/app/(seller)/seller/menu/page.tsx`. Sidebar link added in `OperationalSidebar.tsx` navByRole.SELLER (NOT Layout.tsx — that was the brief's error).
- Buyer storefront: `components/ui/MenuStorefront.tsx` (accordion sections, modifier modal, open/closed by availabilityHours). Rendered via a "Menu" tab on `market/[slug]/page.tsx` (activeTab union now includes 'menu').
- Cart: `components/cart/CartContext.tsx` extended with menu fields; menu items dedup by menuItemId + modifier signature. Checkout `CheckoutContent.tsx` maps isMenuItem lines to send `menuItemId` (not productId) + selectedModifiers, and shows a prep-time banner.
- Discovery: markets page dining filter row + home Food & Dining section, both via `/sellers/discover`.

Gotcha: `AuthGuardModule.forRoot()` registers JwtAuthGuard + RolesGuard as GLOBAL APP_GUARDs. A feature module that imports it should pass `{ globalGuard: false }` if another module in the same app already registered them (MenuModule does this) to avoid double guard execution. See [[stack-confirmed]] and [[checkout-flow]].
