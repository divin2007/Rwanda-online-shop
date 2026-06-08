# Google Stitch Full Website Generation Prompt For RMF

Copy this full prompt into Google Stitch.

Important instruction for Stitch:

Do not create only 4 overview screens. Do not create only a landing page. Do not create only one screen per portal. Create a complete multi-page web application design with every route, workflow, state, and responsive layout described below.

I need a full high-fidelity website design system and screen set for the entire RMF platform. Treat this as a complete production marketplace application, not a concept mockup.

Generate all pages in groups:

1. Public buyer marketplace pages
2. Buyer account/order pages
3. Seller portal pages
4. Rider portal pages
5. Admin portal pages
6. Authentication/onboarding pages
7. Shared system states such as loading, empty, offline, unauthorized, approval pending, and error states

For every page, create both desktop and mobile responsive versions where the layout changes significantly.

Design enough screens that a developer can implement the whole RMF website from the output. If there are many pages, organize them by section, but still create individual screens for each route listed in this prompt.

## Product Name

Rwandan Market Facilitator, abbreviated as RMF.

## Product Purpose

RMF connects physical Rwandan markets to digital commerce. Buyers discover trusted markets, shops, products, promotions, seller videos, and delivery options. Sellers digitize their physical stalls, manage products, negotiate orders, upload product videos, handle inventory, and receive payouts. Riders accept nearby delivery jobs, track pickups and handovers on maps, and receive earnings. Admins govern the platform, approve sellers/riders/products, manage taxonomy, monitor fraud, resolve disputes, track live operations, and manage payout/accounting workflows.

This must feel like a serious trust-based marketplace, not a generic e-commerce template. The design should communicate local commerce, payment trust, verified vendors, market logistics, and operational clarity.

## Core Design Direction

Use the current RMF orange brand direction across the full product.

Primary colors:

- RMF orange: `#ff6b00`
- Deep orange: `#e05300`
- Warm orange surface: `#ffedd5`
- Amber highlight: `#f59e0b`
- Soft background: `#fdfaf7`
- Ink text: `#1b1c1c`
- Muted brown-gray text: `#574e47`
- Warm border: `#ebdcd0`
- White cards: `#ffffff`
- Error red: `#ba1a1a`
- Map/route blue: `#3b82f6`

Visual tone:

- Warm, trustworthy, professional, local, and commerce-focused.
- Use real market/product imagery whenever possible.
- Avoid heavy green dominance, purple gradients, dark SaaS dashboards, oversized generic hero sections, decorative blobs, and abstract SVG-heavy visuals.
- Cards should be compact, scannable, and useful.
- Buttons should be clear, high-contrast, and action-focused.
- Tables should be dense but readable.
- Mobile layouts should feel like a native shopping and logistics app.

## System Architecture In Plain Language

RMF has four main user worlds:

1. Buyer Marketplace
2. Seller Portal
3. Rider Portal
4. Admin Portal

The system relationships are:

- A user can be a buyer, seller, rider, or admin.
- A market is a physical place with a name, district, coordinates, opening status, sellers, products, videos, reviews, and delivery coverage.
- A seller belongs to a market or operates an independent shop/stall.
- A product belongs to a seller, market, category, and taxonomy branch.
- A product can have variants, such as size, color, weight, fabric, unit, packaging, or material.
- A product variant is the exact purchasable item added to the cart and order.
- A buyer creates orders from products or variants.
- Some products allow negotiation. In that case, the order begins as a quote request.
- Payment is handled through MoMo/Paypack/card-like integrations and is tied to escrow-like order states.
- A rider is assigned after payment/confirmation and delivery readiness.
- Delivery is tracked using maps, rider location, pickup proof, handover proof, and QR confirmation.
- Reviews, likes, video interactions, purchases, and browsing history feed recommendations.
- Admins oversee approvals, taxonomy, disputes, fraud, payouts, accounting, market data, and operational maps.

## Data Objects The Design Must Represent

### Market

Fields shown across the site:

- Market name
- Slug
- District and city
- Coordinates
- Distance from user
- Opening status
- Open hours
- Verified status
- Market type: public market, independent shop, artisan hub, border trade center, logistics hub
- Seller count
- Product count
- Featured products
- Promotions
- Top sellers
- Market videos
- Reviews and rating
- Delivery availability
- Map pin

### Seller

Fields shown across seller-facing and buyer-facing pages:

- Shop name
- Seller name
- Stall code
- Market association
- Verification status
- Rating
- MoMo payout number
- Product count
- Active orders
- Pending quote requests
- Wallet balance
- Seller advertisement video
- Product advertisement videos
- Settings change requests

### Product

Fields shown across product cards, product pages, seller inventory, admin approvals, and checkout:

- Product name
- Product image/video
- Price in RWF
- Seller name
- Market name
- Category branch
- Product attributes
- Variants
- Stock quantity
- Unit of measure
- Availability status
- Rating and review count
- Promotion/deal badge
- Negotiable or fixed price status
- Made in Rwanda status
- Delivery estimate

### Variant

Variants must be visually treated as purchasable options, not hidden metadata.

Variant fields:

- Variant name
- Size, color, material, weight, flavor, pattern, capacity, package, or other category-specific option
- Variant price
- Variant stock
- Variant image
- Optional variant video
- SKU

When a buyer adds a variant to cart, the cart and order must show that exact variant, not only the parent product.

### Order

Fields shown in buyer, seller, rider, and admin screens:

- Order ID
- Buyer
- Seller
- Market
- Items and variants
- Quantity
- Snapshot price
- Total
- Payment status
- Order status
- Negotiation status
- Delivery status
- Rider assignment
- Timeline
- Messages
- Receipt
- Escrow/release/dispute state
- Pickup and handover proof

### Delivery

Fields shown in rider and tracking views:

- Pickup market/shop
- Drop-off location
- Distance
- Fee
- Rider
- Rider status
- Current map position
- Route line
- ETA
- Pickup proof photo
- Handover QR
- Handover confirmation
- Delivery timeline

### Video

Fields shown in video pages and market/shop/product pages:

- Video thumbnail
- Video playback
- Seller/shop name
- Market name
- Product name if attached to product
- Category
- Likes
- Dislikes
- Comments
- CTA to view product/shop/market
- Search terms and tags

## Main Workflows

### Buyer Discovery Workflow

The buyer opens RMF and sees:

1. Global header with RMF logo, search, location, language, notifications, cart, and account.
2. Hero showing trusted local markets and a direct call to browse markets or start selling.
3. Nearby markets based on detected or selected location.
4. Recommended products based on preferences, likes, viewed products, viewed categories, purchases, and market proximity.
5. Promotions and flash deals.
6. Made in Rwanda products.
7. Trending market videos.
8. Map-based market discovery.
9. Trust indicators for escrow, verified sellers, rider tracking, and secure payments.

Search should allow buyers to find markets, sellers, products, categories, product videos, and Made in Rwanda items.

### Location And Distance Workflow

The website should use buyer location when available.

If browser geolocation is allowed:

1. Detect user coordinates.
2. Calculate distance from user to each market.
3. Display nearest open verified markets first.
4. Show distance badges like `1.8 km away`.
5. Estimate delivery availability and delivery fee.
6. Highlight nearby market pins on the map.

If geolocation is denied:

1. Default to Kigali.
2. Show a clear location selector.
3. Let the user choose a district/market area manually.
4. Re-rank markets based on that selected location.

Map behavior:

- Market cards and map pins should be connected.
- Hovering or selecting a market card highlights its map pin.
- Clicking a map pin opens a compact market preview.
- Users can switch between list, grid, and map views.
- On mobile, use a full-width map with a draggable bottom sheet for market cards.

### Product Recommendation Workflow

New buyers should be asked what they like after registration, similar to Pinterest onboarding.

The preference picker should show broad categories and branch categories, for example:

- Food and groceries
- Fresh produce
- Fashion
- Textiles
- Shoes
- Cosmetics
- Beauty and personal care
- Jewelry and bracelets
- Home and living
- Furniture
- Building materials
- Cement and tiles
- Electronics
- Crafts
- Art
- Baby products
- Agriculture
- Tools
- Auto parts
- Services

The system should recommend products and markets using:

- Selected interests
- Viewed products
- Viewed markets
- Search terms
- Added-to-cart events
- Likes on videos
- Likes/dislikes on products
- Purchases
- Category affinity
- Nearby markets
- Seller rating
- Product popularity

Design recommendation surfaces on:

- Home page
- Market page
- Product detail page
- Cart upsells
- Videos page
- Buyer dashboard

### Category And Taxonomy Workflow

RMF needs a robust category system like a large e-commerce marketplace.

Product creation should use a drilldown picker:

1. Choose parent category.
2. Choose child category.
3. Choose deeper child/grandchild category.
4. Stop only when the seller reaches the exact product category.
5. Show category-specific attributes after the final category is selected.

Example:

Home and Building -> Building Materials -> Cement -> Portland Cement

Fashion -> Women -> Shoes -> Sandals

Beauty -> Skincare -> Face Care -> Moisturizer

Crafts -> Jewelry -> Bracelets -> Beaded Bracelets

The design should show:

- Breadcrumb path
- Search within categories
- Recommended categories while typing
- Required attributes
- Optional attributes
- Variant creation section
- Image/video upload section
- Validation state

### Variant Workflow

Products can have variants.

Seller creates:

- Parent product information
- Shared product images
- Shared description
- Category and attributes
- Variant options
- Variant-level stock
- Variant-level price
- Variant-level image
- Optional variant-level video

Buyer sees:

- Product title
- Variant selector
- Variant price
- Variant stock
- Variant image changes when selected
- Add to cart uses selected variant

Cart and order must show:

- Parent product name
- Selected variant
- Variant image
- Variant price snapshot
- Variant quantity

### Negotiation Workflow

Some products are negotiable.

Flow:

1. Buyer clicks negotiate on a product or order.
2. Buyer enters message, requested quantity, location, and optional offer.
3. Order is created in `awaiting_quote`.
4. Seller sees quote request in seller dashboard.
5. Seller sends a quote with price, notes, availability, and expiration.
6. Buyer accepts, rejects, or counters.
7. If accepted, order becomes payable.
8. Buyer pays through MoMo/Paypack/card.
9. Payment creates escrow-like hold and moves order to fulfillment.
10. Seller prepares product.
11. Rider pickup begins when ready.

Design requirements:

- Chat-like negotiation UI.
- Quote cards with price, expiry, and action buttons.
- Buyer and seller views should be different but consistent.
- Timeline should show every state.
- Users should never be sent to another role dashboard accidentally.

### Payment And Escrow Workflow

The payment flow must clearly show trust.

Buyer:

- Reviews items and variants.
- Sees subtotal, delivery fee, service fee, and total.
- Chooses MoMo/Paypack/card option.
- Confirms payment.
- Sees payment pending, confirmed, failed, or retry state.

Escrow-like handling:

- Buyer payment is tracked before seller payout.
- Seller payout is tied to fulfillment and delivery confirmation.
- Rider payout is tied to completed delivery.
- If dispute is opened, payout can be paused.
- Admin can review payment, order, dispute, refund, and payout state.

Design should show:

- Payment trust badges
- Escrow timeline
- Receipt
- Refund/dispute entry point
- Payout release state for sellers

### Rider Dispatch And Distance Pricing Workflow

When an order is ready for delivery:

1. The system searches for riders within 150 meters of the shop or market.
2. Available riders receive a broadcast job card.
3. If no rider accepts, search radius increases by 50 meters at a time.
4. The UI shows the expanding radius to admin and possibly seller.
5. Rider receives pickup, drop-off, distance, ETA, and payout.
6. Once accepted, rider is assigned and live tracking starts.

Delivery fee logic:

- Use a base fee at the start.
- If rider search expands from 1 km to 8 km, add 500 RWF.
- If rider search expands from 8 km to 16 km, add 800 RWF.
- Continue progressive distance-based pricing for farther ranges.
- The design should show fee explanation in checkout, admin live operations, and rider job cards.

Tracking:

- Buyer sees rider map, route, ETA, and timeline.
- Seller sees pickup preparation and pickup confirmation.
- Rider sees pickup pin, drop-off pin, navigation CTA, proof upload, and QR handover.
- Admin sees live map of active riders and deliveries.

### Video Advertisement Workflow

RMF has TikTok-style commerce videos.

Video types:

- Product advertisement video
- Variant product video
- Shop advertisement video, only one main ad per shop
- Market video

Video pages:

- `/videos`: global video feed across markets and shops
- Market page video section: videos only from that market
- Shop page video section: videos only from that shop
- Product page video section: product or variant video

Video behavior:

- Vertical snap scrolling.
- Full-screen or near-full-screen video cards.
- Overlay market name, shop name, product name, price, rating, and CTA.
- Like, dislike, comment, share, save, and view product.
- Search can filter by product, market, shop, category, and tags.
- Search should become more detailed as users type more words, for example `pants black cotton`.

### Seller Settings And Approval Workflow

Sellers should have settings for market/shop information.

Seller can request changes to:

- Shop name
- Stall number
- Business phone
- MoMo number
- Opening hours
- Delivery/pickup preferences
- Shop banner
- Shop logo
- Shop ad video
- Bio/about text
- Product return rules
- Notification preferences

Seller cannot directly change:

- Shop slug
- Verified identity fields without admin approval
- Sensitive payout identity without review

Any sensitive change creates an admin approval request.

### Rider Settings And Approval Workflow

Riders can request changes to:

- Phone
- Vehicle type
- Plate number
- Availability area
- MoMo payout number
- Profile image
- Notification preferences

Sensitive changes go to admin review before approval.

### Admin Governance Workflow

Admins must have screens for:

- Platform analytics
- Accounting
- Live operations map
- Seller approvals
- Rider approvals
- Product approvals
- Market directory
- Product taxonomy manager
- Category attribute governance
- Bulk import/backfill tools
- Fraud alerts
- Dispute and refund queue
- Payout approvals
- Settings change requests
- Support tickets
- Audit logs

Admin design should prioritize:

- Dense tables
- Clear filters
- Active tab highlighting
- Bulk actions
- Detail drawers
- Status chips
- Skeleton loading
- Infinite loading for large lists
- Audit trail visibility

## Pages And Routes To Design

Design all major desktop and mobile screens.

### Public And Buyer Pages

#### `/`

Buyer home.

Data displayed:

- Global search
- Location selector
- Language selector
- Cart
- Account state
- Hero with market image
- Active market stats
- Verified seller stats
- Orders stats
- Nearby markets
- Recommended products
- Promotions
- Made in Rwanda rail
- Trending videos
- Market map preview
- Trust/payment badges
- Footer

#### `/markets`

Market discovery.

Data displayed:

- Search and filters
- Active/open market toggle
- Category chips
- Distance filter
- District filter
- Market type filter
- Market cards
- Map/list toggle
- Market map with pins
- Promotions from markets
- Most bought products
- Featured sellers

#### `/market/[slug]`

Individual market storefront.

Data displayed:

- Market hero
- Market name
- Open/closed status
- Distance
- District
- Seller count
- Product count
- Rating
- Map location
- Featured sellers
- Promotions
- Product grid
- Filters and facets
- Most bought
- Highly reviewed
- Market videos
- Reviews
- Delivery estimate

#### `/products`

Global product listing.

Data displayed:

- Product search
- Category tree filter
- Attribute filters
- Variant-aware cards
- Price filter
- Market filter
- Seller filter
- Distance filter
- Sort by recommended, nearest, most bought, rating, newest, price

#### `/product/[id]` or market product route

Product detail.

Data displayed:

- Product gallery
- Product video
- Variant selector
- Selected variant image/video
- Price
- Stock
- Attributes
- Seller
- Market
- Reviews
- Delivery estimate
- Add to cart
- Negotiate if enabled
- Related products
- Similar videos

#### `/videos`

Global commerce video feed.

Data displayed:

- Vertical video feed
- Search bar
- Filter chips
- Market/shop/product metadata
- Like/dislike/comment actions
- Product CTA
- Shop CTA
- Market CTA

#### `/cart`

Shopping cart.

Data displayed:

- Items
- Variant names
- Variant images
- Quantity
- Price snapshots
- Seller grouping
- Market grouping
- Delivery estimate
- Service fees
- Checkout CTA

#### `/checkout`

Checkout and payment.

Data displayed:

- Buyer contact
- Delivery location
- Map pin confirmation
- Order summary
- Delivery fee explanation
- Payment methods
- Escrow/trust explanation
- Confirm payment

#### `/orders`

Buyer order history.

Data displayed:

- Active orders
- Past orders
- Payment state
- Delivery state
- Negotiation state
- Track order CTA
- Receipt CTA

#### `/orders/[id]/tracking`

Order tracking.

Data displayed:

- Map
- Rider current position
- Pickup and drop-off pins
- Timeline
- Escrow/payment state
- Order items
- Chat
- QR/handover confirmation if needed
- Dispute/refund action

#### `/preferences`

Buyer preference onboarding and editing.

Data displayed:

- Category interest picker
- Selected interests
- Recommended markets/products preview
- Save preferences

#### `/login`

Authentication.

Data displayed:

- Email/phone login
- Password
- Google login if supported
- Forgot password
- Role-aware redirect after login

#### `/register`

Account creation.

Data displayed:

- Role selection: buyer, seller, rider
- Buyer registration
- Seller onboarding redirect
- Rider onboarding redirect
- Preference onboarding after buyer creation

#### Shared Utility Pages

Design:

- 404 page
- Offline/service unavailable state
- Loading skeleton state
- Empty state
- Unauthorized state
- Settings page
- Notifications page
- Wallet page
- Wishlist page
- Help/contact/privacy/terms pages

### Seller Pages

#### `/seller/onboarding`

Seller onboarding.

Data displayed:

- Business identity
- Market/stall selection
- Location pin
- MoMo payout number
- Shop logo/banner
- Opening hours
- Document upload
- Approval status

#### `/seller/dashboard`

Seller home.

Data displayed:

- Wallet balance
- Pending orders
- Pending quotes
- Products listed
- Rating
- Revenue chart
- Active orders
- Quick actions
- Market/shop health

#### `/seller/products`

Inventory.

Data displayed:

- Search
- Filters
- Product list/table
- Category
- Variants
- Stock
- Price
- Status
- Edit
- Soft delete/archive
- Audit state
- Infinite scrolling

#### `/seller/products/new`

Create product.

Data displayed:

- Category drilldown picker
- Product fields
- Attributes by category
- Variants
- Variant image/video
- Stock
- Price
- Negotiation toggle
- Upload media
- Save draft/publish

#### `/seller/products/[id]/edit`

Edit product.

Data displayed:

- Existing data
- Variant editor
- Image/video manager
- Stock editor
- Audit warning for sensitive changes

#### `/seller/orders`

Seller order queue.

Data displayed:

- Awaiting quote
- Payment pending
- Ready to prepare
- Ready for pickup
- Completed
- Search/filter
- Order drawer

#### `/seller/orders/[id]`

Order detail and negotiation.

Data displayed:

- Order timeline
- Items
- Variant details
- Buyer notes
- Chat
- Quote cards
- Send quote
- Prepare order
- Pickup proof
- Receipt
- Escrow state

#### `/seller/promotions`

Promotions.

Data displayed:

- Active deals
- New deal form
- Product selector
- Discount
- Date range
- Performance stats

#### `/seller/videos`

Seller video manager.

Data displayed:

- Shop ad video, one active main video
- Product videos
- Variant videos
- Upload/edit/delete
- Comments/likes
- Performance stats

#### `/seller/earnings`

Earnings and payouts.

Data displayed:

- Wallet balance
- Ledger
- Payout status
- MoMo destination
- Pending payout
- Escrow release state

#### `/seller/settings`

Settings.

Data displayed:

- Shop settings
- Notification settings
- Payout settings
- Change request status
- Admin approval requirement for sensitive updates

### Rider Pages

#### `/rider/register`

Rider onboarding.

Data displayed:

- Identity
- Vehicle type
- Plate number
- Phone
- MoMo payout
- Documents
- Preferred area
- Approval status

#### `/rider/dashboard`

Rider work home.

Data displayed:

- Online/offline toggle
- Earnings
- Completion rate
- Rating
- Live map
- Nearby jobs
- Active delivery
- Queue

#### `/rider/deliveries`

Delivery list.

Data displayed:

- Active jobs
- History
- Pickup
- Drop-off
- Earnings
- Status
- Track CTA

#### `/rider/deliveries/[id]`

Delivery detail.

Data displayed:

- Map
- Route
- Pickup details
- Drop-off details
- Pickup proof upload
- QR handover
- Chat
- Timeline

#### `/rider/earnings`

Rider earnings.

Data displayed:

- Weekly earnings
- Completed deliveries
- Wallet
- Payout history
- Delivery fee breakdown

#### `/rider/settings`

Rider settings.

Data displayed:

- Profile
- Vehicle details
- Payout details
- Notification preferences
- Change request approval status

### Admin Pages

#### `/admin`

Admin shell with tabs/sidebar.

Tabs and data:

- Analytics: GMV, orders, revenue, users, market health, charts
- Accounting: platform revenue, payouts, ledger, fees, payment status
- Live operations: rider map, active orders, expanding rider search radius
- Seller approvals: seller applications, documents, approve/reject
- Rider approvals: rider applications, documents, approve/reject
- Product approvals: products awaiting approval, media, category validation
- Markets directory: market table, edit, sync images, map pin, active state
- Taxonomy manager: category tree, attributes, required fields, synonyms
- Governance reports: missing attributes, bad data, category audit
- Disputes/refunds: dispute queue, order evidence, refund/redelivery actions
- Fraud: suspicious orders, locations, payment/rider flags
- Payouts: seller/rider payout approval
- Settings change requests: seller/rider requested updates
- Support: user tickets and admin notes
- Audit logs: actions taken by admins and system

Admin UX:

- Sticky sidebar with active state.
- Dense data tables.
- Filters on top.
- Detail drawer for row inspection.
- Bulk actions.
- Skeleton loading.
- Infinite loading for large datasets.
- Clear status chips.

## Scroll And Interaction Patterns

### Home Page

- Desktop: hero plus useful side panels, then compact sections.
- Mobile: search first, location second, then horizontal rails.
- Use carousels for recommended products, Made in Rwanda, promotions, and videos.
- Do not stack too many huge sections vertically.

### Market Pages

- Desktop: map/list split where useful.
- Mobile: map with bottom sheet or product rails.
- Sticky filters should collapse on mobile.
- Product cards should be compact and readable.

### Product Pages

- Desktop: media left, purchase panel right.
- Mobile: media carousel first, sticky add-to-cart/negotiation action at bottom.
- Variant selection should be visible and easy.

### Seller/Admin Tables

- Use infinite scroll or lazy pagination.
- Show skeleton rows while loading more data.
- Keep actions visible but not visually noisy.

### Videos Page

- Vertical snap scroll.
- Video fills the main viewport area.
- Metadata and actions overlay the video.
- Comments open in a side drawer on desktop and bottom sheet on mobile.

### Tracking Pages

- Map should be central.
- Timeline should be clear.
- Chat should be available but not dominate the map.
- Rider proof and QR actions should be obvious.

## Required States

Design each important screen with:

- Loading skeleton
- Empty state
- Error state
- Offline services state
- Unauthorized state
- Pending approval state
- Rejected approval state
- Payment pending
- Payment failed
- Payment confirmed
- Quote pending
- Quote accepted
- Quote expired
- Rider search expanding
- No rider found
- Dispute active
- Payout pending
- Payout approved

## Security And Trust Cues

The design must show role separation clearly:

- Buyers must never see seller dashboard controls.
- Sellers must only manage their own shop, products, and orders.
- Riders must only see assigned or available delivery jobs.
- Admins must see audit trails and approval controls.

Trust cues:

- Verified seller badges
- Verified market badges
- Secure payment labels
- Escrow timeline
- Buyer protection
- Pickup proof
- Handover QR
- Admin-reviewed changes
- Audit log indicators

## Navigation Model

### Public Buyer Navigation

Header:

- RMF logo
- Search
- Location selector
- Language
- Notifications
- Cart
- Account

Main nav:

- Markets
- Products
- Videos
- Made in Rwanda
- Deals

### Seller Navigation

Sidebar:

- Dashboard
- Products
- Orders
- Promotions
- Videos
- Earnings
- Analytics
- Reviews
- Settings

### Rider Navigation

Sidebar or bottom nav:

- Dashboard
- Deliveries
- Earnings
- Settings

### Admin Navigation

Sidebar:

- Analytics
- Accounting
- Live Operations
- Approvals
- Markets
- Products
- Taxonomy
- Disputes
- Fraud
- Payouts
- Settings Requests
- Support
- Audit Logs

## Mobile Design Requirements

Mobile should feel native and iOS-first.

Rules:

- Header search should take most of the header width.
- Cart belongs in the header, not the bottom nav.
- Bottom nav should be role-aware.
- If no user is logged in, do not show seller/rider-only bottom nav.
- Buyer bottom nav can include Home, Markets, Videos, Orders, Account.
- Seller bottom nav can include Dashboard, Products, Orders, Videos, Settings.
- Rider bottom nav can include Dashboard, Jobs, Active, Earnings, Settings.
- Use bottom sheets for filters, comments, map details, and quick actions.
- Use large tap targets.
- Avoid dense desktop tables on mobile; use cards.

## Design Deliverable Required From Stitch

Generate a complete high-fidelity website and responsive mobile web design for RMF.

Do not design only the landing page.
Do not summarize each portal into one generic screen.
Do not stop at four screens.
Do not create decorative concept art instead of working application pages.

Create this as a full route-by-route product design. Each route below should become its own designed page or screen group:

Public and buyer:

- `/`
- `/markets`
- `/market/[slug]`
- `/products`
- `/product/[id]`
- `/videos`
- `/cart`
- `/checkout`
- `/orders`
- `/orders/[id]/tracking`
- `/preferences`
- `/wishlist`
- `/wallet`
- `/settings`
- `/notifications`
- `/login`
- `/register`
- `/forgot-password`
- `/help`
- `/contact`
- `/privacy`
- `/terms`
- `404`
- `offline/service unavailable`

Seller:

- `/seller/onboarding`
- `/seller/dashboard`
- `/seller/products`
- `/seller/products/new`
- `/seller/products/[id]/edit`
- `/seller/orders`
- `/seller/orders/[id]`
- `/seller/promotions`
- `/seller/videos`
- `/seller/earnings`
- `/seller/analytics`
- `/seller/reviews`
- `/seller/qr`
- `/seller/settings`

Rider:

- `/rider/register`
- `/rider/dashboard`
- `/rider/deliveries`
- `/rider/deliveries/[id]`
- `/rider/earnings`
- `/rider/settings`

Admin:

- `/admin?tab=analytics`
- `/admin?tab=accounting`
- `/admin?tab=live-map`
- `/admin?tab=seller-approvals`
- `/admin?tab=rider-approvals`
- `/admin?tab=product-approvals`
- `/admin?tab=markets`
- `/admin?tab=taxonomy`
- `/admin?tab=governance`
- `/admin?tab=disputes`
- `/admin?tab=fraud`
- `/admin?tab=payouts`
- `/admin?tab=settings-requests`
- `/admin?tab=support`
- `/admin?tab=audit-logs`

For complex pages, include secondary states as separate frames:

- loading skeleton
- empty state
- data loaded state
- network/offline failure
- unauthorized/role mismatch
- pending approval
- rejected approval
- payment pending
- payment failed
- quote pending
- quote accepted
- rider search expanding
- no rider found
- dispute active

Design:

- Buyer marketplace
- Market discovery
- Market storefront
- Product detail
- Videos feed
- Cart and checkout
- Order tracking
- Buyer preferences
- Seller portal
- Rider portal
- Admin portal
- Auth pages
- Settings pages
- Loading, empty, offline, and error states

Include reusable components:

- Header
- Role-aware sidebar
- Mobile bottom nav
- Product card
- Variant selector
- Market card
- Seller card
- Video card
- Order card
- Quote card
- Payment summary
- Escrow timeline
- Delivery timeline
- Map panel
- Filter drawer
- Category drilldown picker
- Admin data table
- Status chip
- Skeleton loader
- Empty state
- Toast/notification
- Modal and drawer

The final design should make RMF feel like a complete trust-commerce platform for Rwandan physical markets, with strong orange branding, local market imagery, map-driven discovery, escrow clarity, role-specific workflows, and compact professional e-commerce layouts.
