# Google Stitch Full Website Generation Prompt For RMF

Copy everything in this document into Google Stitch. The goal is to generate a complete, responsive, production-grade frontend design for the existing Rwanda Market Facilitator codebase. This must look ultra-premium, but every screen must map to the current routes, data models, workflows, and constraints already present in the project.

## 0. Non-Negotiable Product Rules

Design the RMF platform as an operational commerce system, not a generic landing page. The first screen must be the usable buyer marketplace experience. Every dashboard must feel like a real tool with live data, tables, maps, status chips, message workflows, image/video previews, and clear empty/loading/error states.

Use only the implemented route map below. Do not invent primary routes that do not exist. You may include optional future frames only if clearly marked as future design frames.

RMF must not be represented as holding customer funds. Payments, payouts, and refunds are Paypack-operated money movement. RMF only displays order accounting, Paypack references, settlement statuses, payout attempts, and ledger entries. Do not design a wallet where RMF stores spendable customer balances. Where the current route says wallet, design it as a Paypack settlement/accounting ledger.

Product detail pages must use the canonical product URL `/product/[productId]`. Market storefront links must use `/market/[slug]` or the market subdomain pattern. Do not route product detail cards to `/market/[slug]/product/[productId]` unless the current screen is already inside the market context.

All product and market images, seller videos, delivery proof images, chat images, and document uploads must be visible as real media slots. Never hide uploaded images behind abstract icons only.

## 1. Solaris Ivory Design System

Use the Solaris Ivory visual system everywhere.

Colors:
- Primary brand: `#ff6b00`
- Primary hover: `#e05300`
- Primary glow: `rgba(255, 107, 0, 0.08)`
- Secondary rust: `#a63b00`
- Secondary hover: `#7f2b00`
- Secondary light accent: `#ffdbce`
- Accent gold: `#f59e0b`
- Accent hover: `#d97706`
- Accent badge fill: `#fef3c7`
- Logistics blue: `#3b82f6`
- Logistics hover: `#005ac2`
- Logistics highlight: `#d8e2ff`
- Main canvas: `#fbf9f8`
- Surface canvas: `#f5f3f3`
- Card white: `#ffffff`
- Soft border: `#ebdcd0`
- Strong border: `#d2bca8`
- Text primary: `#1b1c1c`
- Text secondary: `#574e47`
- Text muted: `#8e7164`
- White: `#ffffff`
- Success: `#12805c`
- Error: `#ba1a1a`
- Warning: `#f59e0b`
- Info: `#3b82f6`

Visual treatment:
- Main background: warm cream canvas with subtle top-right radial orange glow.
- Cards: white or `rgba(255, 255, 255, 0.85)`, 1px orange-tinted border, soft `0 8px 30px rgba(27,28,28,0.03)` shadow.
- Glass overlays: use restrained translucent panels only on hero images, maps, media, and dashboards.
- Buttons: icon plus label for major actions, icon-only for compact tools where a standard symbol exists.
- Font pairing: Work Sans for body and headings. JetBrains Mono for RWF prices, transaction refs, order numbers, coordinates, verified tags, timestamps, SKU, and status telemetry.
- Motion: 0.3s cubic-bezier transitions on hover, active, tabs, modals, and route state changes.
- Avoid nested cards inside cards. Use full-width bands and clear panels. Keep cards to repeated items, modals, order panels, and tool surfaces.
- Do not use text that blends into the background. Every text/background pair must pass normal readability by sight.
- Cards must be compact enough for data density. No giant repeated market cards on dashboard lists.

## 2. Current Implemented Route Inventory

Public and buyer routes:
- `/`
- `/markets`
- `/market/[slug]`
- `/market/[slug]/product/[productId]`
- `/products`
- `/product/[productId]`
- `/videos`
- `/cart`
- `/checkout`
- `/orders`
- `/orders/[orderId]/tracking`
- `/dashboard`
- `/wallet`
- `/wishlist`
- `/preferences`
- `/settings`
- `/contact`
- `/privacy`
- `/terms`
- `/login`
- `/register`

Seller routes:
- `/seller/onboarding`
- `/seller/dashboard`
- `/seller/products`
- `/seller/products/new`
- `/seller/orders`
- `/seller/orders/[orderId]`
- `/seller/promotions`
- `/seller/videos`
- `/seller/earnings`
- `/seller/analytics`
- `/seller/reviews`
- `/seller/qr`

Rider routes:
- `/rider/register`
- `/rider/setup`
- `/rider/dashboard`
- `/rider/deliveries`
- `/rider/earnings`

Admin routes:
- `/admin`
- `/admin/disputes/[orderId]`
- `/admin/orders/[orderId]`
- `/admin/support`

Backend service clients used by the frontend:
- User/Auth service: `userApi`, port 3001
- Market service: `marketApi`, port 3002
- Product/catalog/promotion/video service: `productApi`, port 3003
- Seller service: `sellerApi`, port 3004
- Rider service: `riderApi`, port 3005
- Order/payment/dispute/chat service: `orderApi`, port 3006
- Settlement/accounting service: `walletApi`, port 3007
- Delivery service: `deliveryApi`, port 3008
- Notification service: port 3009

## 3. Data Contracts To Use In The Design

Use these real fields in labels, table headers, cards, filters, side panels, and empty states.

User and profile:
- `id`, `_id`, `fullName`, `phone`, `email`, `role`
- Roles: `BUYER`, `SELLER`, `RIDER`, `ADMIN`
- Recommendation profile and discovery preferences may influence markets/products.

Market:
- `_id`, `name`, `slug`, `code`, `type`, `ownerId`, `description`, `imageUrl`
- `location.address`, `location.coordinates`
- `operatingHours.open`, `operatingHours.close`, `operatingHours.daysOpen`
- `isActive`, `rating`, `totalSellers`, `activeProducts`, `totalOrders`, `createdAt`
- Display public markets and individual shops with distinct but related card treatments.

Seller profile:
- `userId`, `marketId`, `stallId`, `stallName`, `description`
- `shopDetails.name`, `shopDetails.slug`, `shopDetails.code`
- `shopDetails.logoUrl`, `shopDetails.bannerUrl`, `shopDetails.imageUrl`, `shopDetails.hubImageUrl`
- `shopDetails.tagline`, `shopDetails.description`, `shopDetails.categories`
- `shopDetails.operatingHours.open`, `shopDetails.operatingHours.close`, `shopDetails.operatingHours.daysOpen`
- `isApproved`, `isOnVacation`, `vacationMessage`, `rating`, `totalSales`, `totalOrders`
- Documents: `businessPermitUrl`, `rraCertificateUrl`, `idCardUrl`, `stallPhotoUrl`
- Capabilities: `delivery`, `bulk`, `custom`, `returns`

Product:
- `_id`, `sellerId`, `marketId`, `name`, `description`
- `category`, `categoryId`, `categoryLabel`, `productType`, `attributeSetVersion`
- `price`, `priceUpdatedAt`, `unit`
- `stockType`: `finite`, `infinite`, `on_demand`
- `stockQuantity`, `inStock`
- `images`
- `weight`, `minWeight`, `maxWeight`
- `minPrice`, `maxPrice`
- `attributes`
- `variantAxes`: `key`, `label`, `values`
- `variants`: `sku`, `title`, `options`, `price`, `unit`, `stockType`, `stockQuantity`, `inStock`, `images`, `videoUrl`, `thumbnailUrl`, `attributes`, `isActive`
- `isApproved`, `isActive`, `isMadeInRwanda`, `isNegotiable`, `rating`, `totalOrders`
- Promotions may attach to the whole product or to `variantSku`.

Promotion:
- `sellerId`, `productId`, `variantSku`, `type`, `discount`
- `startDate`, `endDate`, `maxQuantity`, `currentSales`, `promotedPrice`, `isActive`
- Promotion cards must show the base product price plus any variant override, then discount/promoted price.
- Sort promotion displays by highest removed percentage or strongest discount first.

Seller video and stories:
- `sellerId`, `sellerUserId`, `marketId`, `productId`, `variantSku`
- `placement`: `PRODUCT_AD`, `SHOP_AD`, `STORY`
- `categoryId`, `title`, `caption`, `videoUrl`, `thumbnailUrl`, `durationSeconds`, `tags`
- `processingStatus`, `moderationStatus`, `moderationReason`
- `isActive`, `isArchived`, `viewCount`, `likeCount`, `dislikeCount`, `commentCount`, `comments`
- Stories should visually communicate 24-hour freshness where the backend provides story placement. Use dynamic video thumbnails from data.

Order/transaction:
- `orderNumber`
- Buyer: `buyer.userId`, `buyer.fullName`, `buyer.phone`, `buyer.nationalId`, `buyer.deliveryAddress.address`, `buyer.deliveryAddress.coordinates.lat`, `buyer.deliveryAddress.coordinates.lng`
- Seller: `seller.sellerId`, `seller.userId`, `seller.fullName`, `seller.stallId`, `seller.marketId`
- Products: `productId`, `name`, `unitPrice`, `quantity`, `unit`, `category`, `categoryId`, `imageUrl`, `images`, `attributes`, `variantId`, `variantTitle`, `sellerSku`, `priceSnapshotAt`, `weight`, `customization`, `prototypeImage`
- Financials: `subtotal`, `deliveryFee`, `platformCommission`, `gatewayFee`, `totalAmount`, `sellerPayout`, `riderPayout`
- Payment: `method`, `status`, `transactionRef`, `errorMessage`, `paidAt`
- Settlement: `status`, `sellerStatus`, `sellerPayoutRef`, `sellerSettledAt`, `riderStatus`, `riderPayoutRef`, `riderSettledAt`, `platformStatus`, `platformCommissionRef`, `platformSettledAt`, `releaseAvailableAt`, `releaseTriggeredAt`, `payoutBlockedReason`, `lastError`, `updatedAt`
- Refund: `status`, `amount`, `transactionRef`, `reason`, `requestedAt`, `refundedAt`, `error`
- Dispute: `isDisputed`, `reason`, `evidenceUrls`, `raisedAt`, `resolvedAt`, `adminNote`, `resolution`
- Messages: `senderId`, `senderRole`, `channel`, `recipientRole`, `content`, `imageUrl`, `type`, `quoteAmount`, `timestamp`
- Status history: `status`, `changedBy`, `changedAt`, `note`
- Security: `ipAddress`, `deviceInfo`, `isFlagged`, `flagReason`, `reviewedBy`, `reviewedAt`

Order statuses to design:
- `awaiting_quote`, `quote_sent`, `placed`, `confirmed`, `preparing`, `ready_for_pickup`, `picked_up`, `in_transit`, `awaiting_confirmation`, `delivered`, `disputed`, `resolved`, `cancelled`

Payment and settlement states:
- Payment: pending, paid, failed, refunded
- Settlement: pending, escrow_held, release_pending, partial, settled, refunded, failed
- Seller/rider/platform settlement: pending, paid, failed, skipped, pending_rider_assignment
- Remember: "escrow" in UI means Paypack/payment-provider controlled settlement state, not RMF-held funds.

Delivery:
- `orderId`, `orderNumber`
- Rider: `rider.riderId`, `rider.userId`, `rider.fullName`, `rider.phone`, `rider.plateNumber`
- Pickup: `marketId`, `stallId`, `coordinates.lat`, `coordinates.lng`, `qrScannedAt`, `qrVerifiedBy`, `qrPayload`, `pickupPhotoUrl`, `sellerConfirmed`, `riderConfirmed`
- Dropoff: `address`, `coordinates.lat`, `coordinates.lng`, `deliveredAt`
- Route: `distanceKm`, `estimatedMinutes`, `actualMinutes`, `geometry`
- Financials: `deliveryFee`, `baseDeliveryFee`, `searchSurcharge`, `totalAmount`
- Dispatch: `strategy`, `currentRadiusMeters`, `nextRadiusMeters`, `maxRadiusMeters`, `broadcastCount`, `manualRebroadcastCount`, `notifiedRiderIds`, `lastBroadcastAt`, `acceptedAt`
- Tracking: `lat`, `lng`, `recordedAt`
- Status chips must cover assigned, en route, pending handover, picked up, delivered, and related statuses.

Rider profile:
- `userId`, `plateNumber`, `isApproved`, `isActive`
- `currentLocation.lat`, `currentLocation.lng`, `currentLocation.updatedAt`
- `rating`, `totalDeliveries`, `rejectionRate`
- Documents: `licenseUrl`, `vehiclePhotoUrl`, `idCardUrl`, `insuranceUrl`

Review:
- `orderId`, `buyerId`, `targetType`: `seller`, `rider`, `market`, `product`
- `targetId`, `rating`, `comment`, `createdAt`
- Completed orders must expose separate review cards for seller, rider, market, and each product.

Ledger entry:
- `ledgerId`, `userId`, `transactionId`, `type`, `account`, `amount`, `currency`, `description`, `balanceAfter`, `provider`, `externalRef`, `status`, `metadata`, `createdAt`
- This is accounting-only. Label as "Paypack settlement ledger" or "Accounting ledger", not RMF wallet funds.

Profile change request:
- `targetType`, `targetId`, `userId`, `status`, `requestedChanges`, `reviewNotes`, `reviewedBy`, `reviewedAt`, `appliedAt`, `auditTrail`

Support ticket:
- `name`, `email`, `phone`, `userId`, `subject`, `message`, `status`, `resolvedBy`, `resolvedAt`, `createdAt`

## 4. Category Taxonomy Requirements

All category UIs must use the current robust taxonomy model, not old static categories.

Core data shape:
- L1 category: `id`, `label`, `defaultUnit`
- L2 subcategory: `id`, `label`, `defaultUnit`, `parentId`
- L3 product type: `id`, `label`, `defaultUnit`, `productType`
- Attribute fields: key, label, type, options/values
- Variant axes: key, label, values

Top-level category keys to show:
- `grocery` - Groceries and Fresh Produce
- `food` - Food and Beverage
- `bakery` - Bakery and Patisserie
- `fashion` - Fashion and Apparel
- `shoes` - Shoes and Footwear
- `sportswear` - Sportswear, Fitness and Outdoor
- `hardware` - Hardware, Tools and Construction
- `handicrafts` - Handicrafts and Rwandan Artisanship
- `home` - Home, Furniture and Kitchen
- `electronics` - Electronics and Tech
- `cosmetics` - Cosmetics, Beauty and Health
- `automotive` - Automotive, Moto and Transport
- `education` - Stationery, Books, Toys and Learning
- `agriculture` - Agriculture and Farming
- `services` - Services and Professional Tasks
- `events` - Events, Rentals and Entertainment
- `property` - Real Estate and Property
- `pets` - Pets and Animal Care
- `solar-energy` - Solar, Renewable Energy and Clean Water
- `office-business` - Office and Business Supplies
- `finance` - Financial Products and Insurance
- `other` - General and Other

Smart unit rules:
- If product type default unit is kg, the buying unit and price computation must visually read as kilogram-based.
- If a seller selects carrots, root vegetables, dry beans, cereals, meat, or other kg-based types, show kg controls and avoid "pieces" language.
- If a product has `minWeight`/`maxWeight`, show a range picker or range label.
- If a product has `minPrice`/`maxPrice`, show a negotiable price range.
- If shoes have a custom size variant, route the buyer into negotiation/availability-check flow.

## 5. Global Components

Header:
- Sticky top header with RMF logo, live platform tag, search input, category suggestions, location badge, basket button with orange count, language selector EN/FR/KIN, and role/profile switcher.
- Header must adapt between platform host and market subdomain context. Leaving a market returns to `localhost:3000` root, not a slug route.

Cards:
- Market card: cover image, verified badge, open/closed state, type, seller/product/order counts, location, rating, highest promotion percent, explore button.
- Product card: image, name, category, unit, price, promoted price if active, Made in Rwanda badge, negotiable/on-demand badge, rating, seller/market, add/cart/negotiation affordance.
- Order card: product thumbnail, order number, status, payment status, total amount, seller/rider names where available, primary action.
- Delivery card: pickup/dropoff, rider, route, fee, status, QR/proof indicators.

Maps:
- Use Leaflet-style panels for market maps, rider tracking, pin-drop checkout, and admin live operations.
- Map containers must be visually stable and not reused by multiple instances in one DOM panel.

Chat:
- Role-colored bubbles: buyer charcoal/neutral, seller orange, rider blue, admin dark/green.
- Always show channel (`ORDER`, `DELIVERY`, `DISPUTE`) if it matters.
- Quote message blocks show RWF amount, delivery fee context, accept/counter/decline controls for buyer.
- Closed orders lock message inputs with a clear security explanation.
- Attachments render as image previews inside message bubbles.

Tables:
- Dense but readable rows, sticky headers on long panels, monospace refs, compact status chips, clear empty state.

Forms:
- Use stepper or segmented controls for product stock type, market type, payment method, recurring order, status filters, and approval tabs.
- Upload fields must preview the actual uploaded media/document.

## 6. Route-By-Route Screen Specifications

### `/` Buyer Home And Exploration

Data:
- Markets from `/markets?activeOnly=true`
- Product recommendations from `/products/recommendations/for-me?limit=24`
- Public stats from `/orders/public/stats`
- Seller videos from `/seller-videos?limit=8`
- User profile/preferences when logged in

Design:
- Sticky global navigation.
- Hero section: "Trusted markets delivered to you." Use real market/produce imagery, ambient orange glow, search, "Explore Stalls", "Start Selling", and a live activity map.
- Platform pulse row: Active Sellers, Live Deliveries, Orders Today, Avg Delivery Time.
- Rwanda's Market Hubs grid with dynamic Market cards.
- Trending products grid using Product card fields.
- Made in Rwanda section limited to a curated dynamic category shelf. Do not render hundreds of category bubbles. Use 8 to 12 visible chips plus "View all".
- Market stories shelf: dynamic `SellerVideo` story/ad thumbnails with live/view count cues.
- Side panels: featured markets, most bought products, trust indicators.
- Empty states: no active markets, no products, videos unavailable, API offline.

Mobile:
- Header collapses cleanly.
- Hero search first, map below.
- Horizontal story shelf and category chips.
- Product and market cards in one-column or two-column compact grid.

### `/markets` Explore Markets Directory

Data:
- Markets, product recommendations, catalog facets, catalog categories, promotions.
- Query inputs: `search`, `location`, `lat`, `lng`, product category, attribute filters, price range, market type.

Design:
- Hero showing count of markets displayed.
- Filter panel with search, price range, market type, top-level taxonomy chips, facet attribute selectors.
- Product result section appears when product filters are active. It must state which markets the displayed products come from.
- Promotional markets shelf sorted by strongest discount.
- Recommended, New Markets, Most Bought From, Top Rated shelves using compact market cards at roughly 70 percent of the current oversized visual footprint.
- Marketplace directory grid with accurate `0 results` empty state when applicable.
- Map explorer at bottom with mapped hubs and live rider layer.

States:
- Live markets offline warning.
- Product fetch offline warning.
- Location filter active.
- Loading skeletons.

### `/market/[slug]` Market Detail And Stalls

Data:
- Market by slug.
- Products by market.
- Promotions by market.
- Catalog facets by market.
- Seller videos by market.
- Market reviews.

Design:
- Panoramic market cover using `imageUrl` or seller/shop banner image. Market logo must use logo image where present.
- Top badges: verified, open/closed, rating, operating hours, delivery ETA, total sellers, product count, active promotion percent.
- Under the hero, immediately show the market ad/video spotlight if available. This must be prominent enough for buyers to see without scrolling far.
- Tabs: Shop Products, Seller Videos, About the Market, Reviews and Feedback.
- Shop tab:
  - Left taxonomy/category/filter accordion.
  - Right product rails: promotions, most bought, filtered all products.
  - Market stories dynamic rail.
  - Top rated seller mini cards.
- Videos tab: seller video feed.
- About tab: description, operational facts, location map.
- Reviews tab: market reviews with verified buyer look.

Important copy:
- Do not say RMF holds escrow funds. Use "Paypack-protected payment flow" or "provider-protected settlement".

### `/product/[productId]` And `/market/[slug]/product/[productId]` Product Detail

Data:
- Product by ID.
- Product reviews.
- Market and seller from populated `marketId` and `sellerId`.
- Variants, attributes, promotion, stock, negotiable ranges.

Design:
- Multi-image carousel with thumbnails, zoom/lightbox, variant image switching.
- Breadcrumbs: Home, Markets, Market, Product.
- Product info panel:
  - Category breadcrumb and category label.
  - H1 product name.
  - Seller/market identity.
  - Badges: Made in Rwanda, negotiable, on demand, verified origin.
  - Stock type, stock quantity, in-stock indicator.
  - Unit and weight controls.
  - Price: base price plus selected variant override. If promotion active, show crossed original and promoted price.
  - Variant picker with SKU, title, option values, variant image, stock, unit, and price delta.
  - Price range and weight range if `minPrice/maxPrice` or `minWeight/maxWeight` exist.
  - Customization textarea for on-demand and custom shoe size.
  - Standard item action: quantity stepper plus Add to Cart.
  - Negotiable/on-demand/custom shoe action: Negotiate or Check Availability, opening quote order and redirecting to `/orders?open=ID`.
- Review section:
  - Rating summary, distribution bars, verified buyer reviews, merchant response placeholder.

States:
- Product unavailable.
- Sold out.
- On-demand.
- Negotiable.
- Custom shoe size.
- Promotion expired or active.

### `/products` Product Discovery

Data:
- Product catalog and recommendation results.
- Catalog taxonomy and facets.

Design:
- Search-and-filter product grid.
- Product cards must show category, unit, variant awareness, promotion, seller/market, Made in Rwanda, negotiable, and stock state.
- Use compact filters, not a huge side rail on mobile.

### `/videos` Public Seller Video Feed

Data:
- Seller videos.
- Optional filters for market, seller, product, story.

Design:
- Video-first marketplace feed with thumbnails, title, caption, seller, market, placement, views, likes, comments, tags.
- Story placement looks time-sensitive.
- Product ad and shop ad placements include CTA to product/market.
- Moderation/processing unavailable states.

### `/cart`

Data:
- Cart context items with product image, product title, category, unit, variant, quantity, price, subtotal, seller/market.

Design:
- Itemized checkout table:
  - Image
  - Item title
  - Category badge
  - Selected variant/weight/unit
  - Quantity stepper
  - Subtotal in RWF
  - Trash icon action
- Summary panel with subtotal, estimated delivery, service/gateway fee preview, checkout button.
- Group items by seller if useful because checkout creates separate orders per seller.
- Empty cart state routes to `/markets`.

### `/checkout`

Data:
- Cart context.
- Market coordinates from first item market.
- Delivery fee from `/deliveries/fee`.
- Order creation via Paypack payment prompt through `/orders`.

Design:
- Four-step checkout:
  1. Delivery Location
  2. Payment and Details
  3. Schedule Delivery
  4. Summary Receipt Board
- Delivery Location:
  - Pin-drop map.
  - Coordinates display.
  - "Location Pinned" status.
  - Delivery fee updates as coordinates move.
- Payment:
  - Radio cards: MTN MoMo, Airtel Money, Tigo Cash.
  - Fields: mobile money phone, delivery notes, National ID when total > 50000 RWF.
  - NID description: "By law, orders over 50,000 RWF require a valid Rwandan National ID for verification."
- Schedule:
  - Recurring order toggle.
  - Frequency: Weekly, Monthly.
  - Delivery day selector Monday through Sunday.
- Summary:
  - Subtotal, Delivery Fee, 2 percent gateway/service fee, Grand Total.
  - Button states: Confirm and Pay, Processing, Awaiting Payment.
  - Explain payment prompt is sent to the phone.

### `/orders`

Data:
- Buyer orders by buyer ID.
- Optional `open=ID` parameter opens receipt/chat modal.
- Delivery cache per delivery ID.

Design:
- Order history list with product thumbnail, order number, status, first product, seller, created date, total paid, tracking link, receipt action.
- Auto-refresh every 10 seconds visual cue.
- Receipt modal uses the shared receipt view and negotiation chat where applicable.
- Empty state: no orders yet, CTA to Explore Markets.

### `/orders/[orderId]/tracking`

Data:
- Order by ID with messages, status, payment, financials.
- Delivery by delivery ID.
- Live order and delivery sockets.
- Reviews for completed order.

Design:
- Authorization-aware tracking workspace.
- Header with order number, status, payment status, receipt action.
- Timeline with all order statuses and current step.
- Map area switches between broadcast map, rider tracking map, and delivered/resolved complete state.
- Chat area:
  - Segmented control to choose Seller or Rider.
  - Seller chat uses `ORDER` channel and quote controls.
  - Rider chat uses `DELIVERY` channel and unlocks after dispatch.
  - Closed delivered/resolved/cancelled orders lock message input.
- Rider controls:
  - Pickup photo upload.
  - Stall QR scanner/payload field.
  - Verify pickup with QR.
  - Confirm item handover.
  - Mark delivered.
- Buyer controls:
  - Confirm receipt during `awaiting_confirmation`.
  - Raise dispute after delivered.
- Review panel:
  - Separate cards for seller, rider, market, and each product.
  - Each can be submitted independently.

### `/dashboard` Buyer Dashboard

Data:
- User profile, active orders, wishlist, recent ledger/order activity if available.

Design:
- Greeting banner with avatar and buyer profile.
- Active orders count, wishlist count, recent purchases, open disputes, pending reviews.
- Quick action cards: continue shopping, orders, wishlist, preferences, support.
- Use the Paypack accounting language if showing financial history.

### `/wallet`

Data:
- Ledger entries and payout/settlement history.

Design:
- Rename conceptually in UI to "Paypack Settlement Ledger" or "Accounting Ledger".
- Display balance only as accounting/reserve/settlement summary, not stored customer funds.
- Table columns:
  - Date
  - Ledger ID
  - Transaction ID
  - Type: debit/credit
  - Account
  - Amount RWF
  - Provider
  - External Ref
  - Status
  - Balance After
- Include clear notice: "Money movement is processed by Paypack. RMF records accounting entries only."

### `/wishlist`

Data:
- Wishlist product IDs and populated products where available.

Design:
- Saved products grid with product image, seller/market, price, promotion, stock, add/remove actions.
- Empty state with market browsing CTA.

### `/preferences`

Data:
- Discovery preferences, selected markets/categories, recommendation profile.

Design:
- Preference center with category interests, preferred markets, distance/location preference, notification toggles.
- Show how preferences improve recommendation rows on `/markets` and `/`.

### `/settings`

Data:
- User profile and role-specific settings.

Design:
- Account settings, contact details, notification preferences, security summary.
- Role switcher callouts for seller/rider/admin where available.

### `/contact`

Data:
- Support ticket fields: name, email, phone, subject, message.

Design:
- Contact admin form with support status explanation.
- Include logged-in user context if present.
- Confirmation state after ticket creation.

### `/login` And `/register`

Design:
- Premium auth forms using the same Solaris Ivory visual identity.
- Role selection in register: buyer, seller, rider.
- Login states: loading, error, success redirect.
- Register states: seller/rider onboarding continuation CTAs.

### `/privacy` And `/terms`

Design:
- Legal text layouts with readable headings and anchored sections.
- Payment language must be Paypack/provider-based.
- Mention National ID only as required for high-value order verification.

## 7. Seller Routes

### `/seller/onboarding`

Data:
- Seller profile submission fields and document uploads.
- Market/shop info and approval status.

Design:
- Multi-step onboarding:
  - Shop identity: name, slug, tagline, description, categories.
  - Market assignment/location.
  - Operating hours.
  - Media: logo, banner, image/hub image.
  - Documents: business permit, RRA certificate, ID card, stall photo.
  - Capabilities: delivery, bulk, custom, returns.
  - Agreement/contract.
- If profile exists and `isApproved=false`, show "Application received, under review" state. Do not ask to refill approval details.
- If approved, route-oriented CTA to seller dashboard.

### `/seller/dashboard`

Data:
- Seller profile.
- Products by seller.
- Active orders.
- Paypack/accounting summary.
- Seller analytics.

Design:
- Seller status header with shop image/logo, stall ID, approval state, vacation state.
- KPI cards:
  - Daily/monthly revenue from completed orders.
  - Active product listings.
  - Pending orders needing action.
  - Rating and reviews.
  - Paypack settlement amount/status, not RMF wallet.
- Pending order queue with actions:
  - Send quote
  - Mark preparing
  - Ready for pickup
  - Open order
- Performance panel: fulfillment rate, repeat buyer rate, average prep time.
- Quick links: products, promotions, videos, earnings, reviews, QR.

### `/seller/products`

Data:
- Seller product list.

Design:
- Inventory table/grid with image, name, category, unit, stock type, stock quantity, price, min/max price, variants count, approval state, active state, total orders, rating.
- Actions: edit, pause/activate, delete/archive, add product.
- Filters: category, approval, stock type, active, negotiable.

### `/seller/products/new`

Data:
- Catalog categories from `/products/catalog/categories`.
- Product form fields and image upload.

Design:
- Product editor with Single Listing and Bulk Import tabs.
- Category drilldown picker L1/L2/L3.
- Smart attribute fields from selected category.
- Unit auto-set from selected product type default unit.
- Price, min/max price for negotiable, stock type, quantity, weight/min/max weight.
- Images preview grid with real uploaded images.
- Variants editor:
  - Axes and options.
  - SKU, title, option values, price delta, unit, stock, images, video thumbnail.
- Bulk import:
  - Template download.
  - CSV/Excel upload.
  - Import results: total, successful, failed, error logs.

### `/seller/orders`

Data:
- Seller orders by seller user ID/status.

Design:
- Order management list with filters by status, payment, settlement, date.
- Show buyer, products, total, delivery state, quote state, unread messages.
- Bulk readable but compact.

### `/seller/orders/[orderId]`

Data:
- Single order, delivery, messages, financials, status history.

Design:
- Seller operations dossier:
  - Header with order number, initialized date, payment status.
  - Shared receipt action.
  - Negotiation/client conversation panel using `OrderChat`.
  - Buyer details and order notes.
  - Items ordered table with image, SKU/product ID, valuation, quantity, total.
  - Financial reconciliation: subtotal, delivery, total, seller payout, platform commission, gateway fee.
  - Logistics handover protocol:
    - Rider assignment.
    - Dispatch broadcasts.
    - Confirm handover.
    - Rider scan and merchant confirmation status.
  - Fulfillment timeline.
- If order is closed/resolved/cancelled, messaging and status actions lock.

### `/seller/promotions`

Data:
- Products and variants.
- Promotions.

Design:
- Create/edit promotion form:
  - Product selector.
  - Variant selector with unique display key using `variant.sku`, `variant.id`, and index fallback.
  - Apply to whole product option.
  - Type, discount, date range, max quantity.
  - Computed original price: base product price plus selected variant override.
  - Computed promoted price.
- Promotion list sorted by highest discount impact.
- State warnings for expired, inactive, sold out, duplicate variant SKU.

### `/seller/videos`

Data:
- Seller videos/stories.

Design:
- Seller video management:
  - Upload video, thumbnail, title, caption, placement, product, variantSku, categoryId, tags.
  - Status chips: processing, moderation, active, archived.
  - Metrics: views, likes, dislikes, comments.
  - Story placement highlights 24-hour freshness if applicable.

### `/seller/earnings`

Data:
- Ledger entries, settled orders, Paypack payout references.

Design:
- Paypack settlement earnings page.
- Do not show RMF-held wallet copy.
- Show:
  - Available settled amount from accounting.
  - Pending settlement.
  - Seller payout refs.
  - Failed payout retry status.
  - Table of order, subtotal, commission, gateway fee, seller payout, Paypack ref, status.

### `/seller/analytics`

Data:
- Seller dashboard analytics and chart data.

Design:
- Sales, fulfillment, product performance, promotion impact, conversion, customer repeats, time filters.

### `/seller/reviews`

Data:
- Reviews targeting seller and products.

Design:
- Rating summary, filter by target type, review cards, merchant response placeholder.

### `/seller/qr`

Data:
- Seller stall QR credential.

Design:
- Printable QR credential page for pickup verification.
- Include stall ID, shop name, market, verification instructions, last generated timestamp.

## 8. Rider Routes

### `/rider/register`

Data:
- Rider application fields and document uploads.

Design:
- Registration with plate number, license, vehicle photo, ID card, insurance.
- Submit state and under-review state.

### `/rider/setup`

Design:
- Post-approval setup checklist:
  - Permissions for location.
  - Online status readiness.
  - Document status.
  - Test map/location panel.

### `/rider/dashboard`

Data:
- Rider profile.
- Rider stats.
- Active deliveries.
- Available deliveries.
- Current location.
- Paypack/accounting summary.

Design:
- Rider console:
  - Online/location status.
  - Earnings, completion rate, rating, total deliveries.
  - Live delivery map.
  - Available deliveries list with pickup/dropoff, fee, accept action.
  - Active delivery panel with current order, dropoff, delivery fee, tracking link.
  - Queued deliveries.
- Location heartbeat visual and stale-location warning.

### `/rider/deliveries`

Data:
- Rider delivery history and active deliveries.

Design:
- Delivery table/cards with order number, pickup, dropoff, distance, ETA, fee, status, proof/QR state.
- Filters by active, completed, failed, disputed.

### `/rider/earnings`

Data:
- Rider payout/ledger entries.

Design:
- Paypack rider payout history with delivery fee split, payout ref, status, dates.
- Do not call it RMF-held balance.

## 9. Admin Routes

### `/admin`

Data:
- Analytics, operations overview, fraud alerts, pending sellers/riders/products, disputes, orders, markets, payouts, profile change requests, taxonomy, accounting.

Design:
- Admin left navigation tabs:
  - Analytics
  - Operations
  - Live Map
  - Sellers
  - Products
  - Riders
  - Approvals
  - Disputes
  - Markets
  - Taxonomy
  - Accounting
  - Payouts
  - Profile Changes
  - Fraud Watch
- Top readiness strip:
  - Paypack cash-in configured
  - Paypack webhook configured
  - Settlement MoMo configured
  - SMS
  - WhatsApp
  - SMTP
  - Mapbox/OpenCage geocoder
- Analytics:
  - GMV, commission, gateway fees, seller payout, rider payout, active orders, dispute exposure.
- Operations:
  - Queue cards by status.
  - Dispatch health.
  - Service readiness.
- Approvals:
  - Seller document panels and approve/decline.
  - Rider document panels and approve/decline.
  - Profile change requests approve/reject.
- Products:
  - Pending product approval table with product media and category.
- Markets:
  - Market creation/edit modal with image upload and location.
- Taxonomy:
  - Category governance, form fields, attributes JSON/axes JSON, warnings.
- Accounting:
  - Order financial report with export CSV.
  - Paypack settlement refs.
  - Dispute/refund status.
- Payouts:
  - Paypack payout approvals/status, not wallet withdrawals.
- Fraud:
  - Fraud alerts with severity, actor, reason, linked orders, next step.

### `/admin/disputes/[orderId]`

Data:
- Single disputed order with order, delivery, messages, dispute evidence, refund status.

Design:
- Full single dispute review page:
  - Horizontal three-panel order views: buyer/client view, seller view, rider view.
  - Each panel shows that role's timeline, messages, proof images, QR events, payment/settlement view, and responsibilities.
  - Evidence gallery from `dispute.evidenceUrls`, chat attachments, delivery pickup photo.
  - Admin resolution actions:
    - Refund buyer through Paypack refund/reversal.
    - Redeliver.
    - Release/settle where allowed.
    - Reject dispute.
  - BPF reserve accounting panel only as internal ledger, not real fund holding.
  - Immutable audit notes.

### `/admin/orders/[orderId]`

Data:
- Single order dossier.

Design:
- Admin order review with all fields:
  - Buyer, seller, rider, product lines, delivery, payment, settlement, refund, dispute, messages, status history, security.
  - Controls for operational override with confirmation.
  - Read-only Paypack refs and provider state.

### `/admin/support`

Data:
- Support tickets.

Design:
- Support inbox:
  - Name, email, phone, user, subject, message, status, created date.
  - Resolve/close actions.
  - Filters by OPEN, IN_PROGRESS, RESOLVED, CLOSED.

## 10. Security, Payment, Refund, And Settlement UX

Payment:
- Buyers pay via Paypack with MTN MoMo, Airtel Money, or Tigo Cash.
- UI must show phone prompt and "Awaiting Payment" state.
- Use `payment.transactionRef` and `payment.paidAt` as provider telemetry.

Payout:
- On confirmation, Paypack payout split:
  - Seller receives subtotal minus RMF commission.
  - Rider receives delivery payout.
  - RMF commission/gateway/service accounting is recorded.
- Display seller/rider/platform settlement refs and statuses.

Refund:
- Approved disputes call Paypack refund/reversal to buyer MoMo number.
- Display `refund.status`, `refund.amount`, `refund.transactionRef`, `refund.reason`, `refund.requestedAt`, `refund.refundedAt`, `refund.error`.
- BPF is an internal accounting reserve only. Do not show it as a spendable wallet.

Closed orders:
- Delivered, resolved, completed, closed, and cancelled orders must show all completed steps and lock messages/actions that are no longer allowed.
- Provide a clear security notice: "This order is closed. Messages are locked for security."

National ID:
- Orders over 50,000 RWF require a 16-digit Rwandan NID input on checkout.

## 11. Responsive And State Coverage

For every route, include desktop, tablet, and mobile layouts.

Every major screen must include:
- Loading skeleton
- Empty state
- Error/offline state
- Auth-required state where relevant
- Permission denied state for protected order tracking
- Active/live socket connected state
- API retry or stale data state where useful

Map safety:
- Each map panel must have stable dimensions and a unique container context.
- Do not render multiple live maps inside one reused DOM container.

Accessibility:
- Buttons have clear labels.
- Icon-only controls have hover tooltip text.
- Forms have labels.
- Tables remain readable on mobile through cards or horizontal scroll.

## 12. Final Output From Google Stitch

Generate the complete website design frames for all implemented routes listed in section 2.

For each frame, annotate:
- Route path.
- Primary data objects used.
- Key states included.
- Desktop and mobile behavior.

Do not output a generic marketing site. Output a full RMF operational commerce design system that can be implemented directly in the current Next.js frontend.
