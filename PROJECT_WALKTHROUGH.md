# RMF Project Walkthrough

## 1. Product Identity

RMF means Rwandan Market Facilitator. It is a marketplace platform for real physical Rwandan markets, individual shops, verified sellers, buyers, riders, and administrators. The product is not only a normal online shop. It is meant to connect offline market commerce to a digital ordering, payment, negotiation, delivery, review, and payout system.

The platform is built around four main user groups:

- Buyers browse markets, products, videos, promotions, recommendations, carts, orders, tracking, wallets, wishlist, reviews, and preferences.
- Sellers onboard into a physical market or individual shop, list products, manage variants, upload bulk inventory, negotiate quotes, publish promotions, publish video ads, handle orders, and request payouts.
- Riders register, get approved, receive delivery broadcasts, accept jobs, update location, upload pickup proof, complete handovers, and track earnings.
- Admins supervise trust, approvals, markets, products, taxonomy, disputes, fraud alerts, payouts, support tickets, accounting, and platform analytics.

The intention is trust-first local commerce:

- Make physical market sellers discoverable online.
- Preserve buyer trust through verified sellers, reviews, order tracking, escrow-like payment stages, and auditable handovers.
- Make delivery accountable with rider assignment, GPS tracking, pickup proof, QR/handover events, and payout separation.
- Let local products be categorized deeply enough for search, filters, variants, bulk import, and recommendations.
- Let sellers advertise visually through product and shop video ads.

## 2. Technical Architecture

The repository is a JavaScript/TypeScript monorepo with a Next.js frontend and multiple NestJS-style microservices.

### Main Applications

| App | Port | Responsibility |
| --- | --- | --- |
| `apps/frontend` | `3000` | Next.js web application, public marketplace, dashboards, role portals |
| `apps/user-service` | `3001` | Auth, registration, user profile, settings, discovery preferences, wishlist, recommendation signals |
| `apps/market-service` | `3002` | Physical/individual markets, market slugs, market images, active contract/agreement, penalties |
| `apps/product-service` | `3003` | Products, taxonomy, attributes, variants, stock, bulk upload/template, promotions, seller videos, recommendations |
| `apps/seller-service` | `3004` | Seller onboarding, approval, documents, seller profile, stall QR, seller setting change requests |
| `apps/rider-service` | `3005` | Rider registration, approval, status, live location, nearby rider lookup, rider setting change requests |
| `apps/order-service` | `3006` | Orders, quote negotiation, payment callback, disputes, order status, delivery address, order chat images |
| `apps/wallet-service` | `3007` | Wallet balances, deposits, ledger entries, payout requests, payout completion/failure |
| `apps/delivery-service` | `3008` | Delivery fee, available jobs, rider assignment, handover, pickup photos, delivery status, tracking socket events |
| `apps/notification-service` | `3009` | SMS, email, in-app notifications, unread counts, read states |
| `apps/review-service` | `3010` | Product, seller, and market reviews |
| `apps/admin-service` | `3011` | Platform analytics, seller analytics, accounting, fraud alerts, support tickets |

### Shared Packages And Data

The shared database package exposes core MongoDB schemas:

- `User`: auth identity, role, profile, settings, discovery preferences, recommendation signals, wishlist.
- `Market`: market name, slug, district/location, coordinates, images, status, type, operating hours, seller/product counters.
- `SellerProfile`: seller identity, market, stall/shop details, MoMo payout details, approval status, documents.
- `RiderProfile`: rider identity, vehicle, plate number, live location, approval status.
- `Product`: product name, seller, market, category/taxonomy, attributes, variants, images, stock, status, approval, recommendation metrics.
- `TaxonomyCategory`: parent-child product category tree, aliases, attributes, variant axes, governance state.
- `Transaction`: order, buyer, seller, products, financial snapshots, payment, status history, chat messages, dispute, delivery link.
- `Delivery`: rider assignment, pickup/drop-off, proof photos, status, location and handover events.
- `Wallet`, `LedgerEntry`, `PayoutRequest`: balances, money movements, payout workflow.
- `Promotion`: seller/product discounts and active deals.
- `SellerVideo`: product ads and shop ads, video URL, thumbnail, reactions, comments, placement.
- `Review`: target type and target id, rating, comment, buyer metadata.
- `NotificationLog`: in-app/email/SMS notification audit.
- `SupportTicket`: help center requests.
- `AuditLog`: immutable security and operational events.
- `ProfileChangeRequest`: seller/rider profile edits awaiting admin approval.

## 3. Main Business Processes

### Buyer Discovery

1. Buyer lands on `/`.
2. Frontend loads active markets, recommendation products, and public order stats.
3. If logged in, buyer profile preferences influence product recommendations.
4. Buyer can search globally, choose location, browse markets, products, videos, promotions, Made in Rwanda items, or preferences.
5. Product interactions can be sent to the recommendation system so future results improve.

### Account Creation And Preferences

1. User chooses buyer, seller, or rider on `/register`.
2. Buyers can be sent to `/preferences` to choose liked categories and markets.
3. Preferences are stored by user-service and used by product-service recommendation endpoints.
4. Later browsing and product interactions update recommendation signals.

### Seller Onboarding

1. Seller starts at `/seller/onboarding`.
2. Seller chooses public market or individual shop structure.
3. Seller enters shop/stall info, market, MoMo/payment info, documents, and agreement acceptance.
4. Seller profile is submitted to seller-service.
5. Admin reviews seller approvals in `/admin`.
6. Approved sellers can list products, receive orders, publish videos, and request payouts.

### Product Listing And Categorization

1. Seller opens `/seller/products/new`.
2. Product-service provides catalog categories from `/products/catalog/categories`.
3. Website uses a parent-child-grandchild drilldown picker so sellers start from a broad parent and select the exact child category.
4. After category selection, category-specific attributes and variant axes appear.
5. Seller adds images, price, unit, stock type, Made in Rwanda flag, negotiable flag, description, variants, variant images/video URL, and inventory.
6. Product data is sent to product-service.
7. Admin can approve products, manage taxonomy, inspect governance reports, and run migration/backfill.

### Bulk Product Import

1. Seller or admin downloads `/products/bulk/template`.
2. Template is designed for category-aware data entry.
3. Seller uploads CSV/XLSX to `/products/bulk-upload`.
4. Product-service validates rows, category fields, attributes, variants, prices, stock, and seller ownership.
5. Import result shows success/failure counts and row errors.

### Product Purchase

1. Buyer views product detail at `/market/[slug]/product/[productId]`.
2. Buyer chooses quantity and variant if available.
3. Add-to-cart stores the exact variant, not only the parent product.
4. Checkout collects delivery details, computes delivery fee, and creates an order.
5. Product/order data uses price snapshots so later price changes do not alter the order.

### Negotiation And Quote Orders

1. If a product is negotiable, buyer creates a quote request instead of immediate checkout.
2. Order starts in `awaiting_quote`.
3. Seller sees it in seller dashboard/orders.
4. Seller sends quote; order moves to `quote_sent`.
5. Buyer accepts by moving it to `placed` and then starts payment.
6. Buyer may counter-offer, returning the order to `awaiting_quote`.
7. Buyer may reject the quote, cancelling the order.
8. Payment must not confirm a quote order before it is accepted and placed.

### Payment And Escrow-Like Handling

1. Standard orders start payment after order creation.
2. Quote orders only start payment after accepted quote.
3. Payment callback updates payment status.
4. Paid orders move to `confirmed`.
5. Seller is not paid immediately at checkout.
6. Seller payout is triggered at rider pickup/handover.
7. Rider payout is triggered after delivery confirmation.
8. Disputes can pause or redirect resolution toward refund, redelivery, or rejection.

### Delivery And Rider Flow

1. When seller marks an order ready for pickup, delivery-service creates or exposes a delivery job.
2. Riders see available jobs on rider dashboard.
3. Rider accepts, updates live location, and proceeds to pickup.
4. Handover can be verified by QR, seller/rider confirmation, and pickup photo.
5. Buyer tracks the order on `/orders/[orderId]/tracking`.
6. Rider marks delivery progress and complete.
7. Buyer can confirm delivery or dispute.

### Admin Governance

Admin portal handles:

- Platform analytics and accounting.
- Seller approval and decline.
- Rider approval and rejection.
- Product approval and removal.
- Market creation/editing and imagery sync.
- Taxonomy category creation/editing/removal.
- Catalog governance reports and migration backfill.
- Fraud alerts and dispute resolution.
- Payout approvals.
- Support tickets.
- Seller/rider setting change requests.

## 4. Web Design System

The current design is an orange trust-commerce identity. Some legacy variables are still named `green`, but the actual brand color is orange.

### Core Color Tokens

| Purpose | Token | Hex |
| --- | --- | --- |
| Primary brand orange | `--rmf-green`, `primary.DEFAULT` | `#ff6b00` |
| Primary hover / deep orange | `--rmf-green-dark`, `primary.hover` | `#e05300` |
| Soft orange background | `--rmf-green-light`, `primary.light` | `#ffedd5` |
| Amber accent | `--rmf-gold`, `accent.DEFAULT` | `#ff9f1c` / `#f59e0b` |
| Amber hover | `accent.hover` | `#d97706` |
| Charcoal text | `--rmf-charcoal` | `#1b1c1c` |
| Deep text | `text.primary` | `#17201a` |
| Muted text | `--rmf-text-muted`, `text.secondary` | `#574e47` |
| Secondary muted text | `text.muted` | `#80756c` |
| Warm page background | `--rmf-cream`, `background.main` | `#fdfaf7` |
| Surface/card | `background.card` | `#ffffff` |
| Muted warm surface | `background.muted` | `#f5ebe4` |
| Main border | `--rmf-border`, `border.DEFAULT` | `#ebdcd0` |
| Strong border | `--rmf-border-strong`, `border.dark` | `#d2bca8` |
| Error | `status.error` | `#ba1a1a` |
| Info | `status.info` | `#3B82F6` |

### Visual Language

- Layout: operational e-commerce, not a marketing-only landing page.
- Surfaces: warm cream background, white cards, orange call-to-action buttons, thin beige borders.
- Corners: mostly `4px` to `12px`, larger only for storefront hero panels or immersive sections.
- Typography: Inter/system sans, bold headings, compact uppercase metadata labels.
- Buttons: orange primary buttons, white/outlined secondary buttons, icon-first controls where possible.
- Cards: compact product cards, market cards with real imagery, seller/video cards, analytics cards.
- Trust signals: verified badges, buyer protection, secure checkout, market/seller status, reviews.
- Motion: subtle reveal, hover lift, loading skeletons, horizontal rails/carousels where dense content would stack too much.

## 5. Frontend Routes And Data Displayed

### Public And Buyer Routes

| Route | Purpose | Data Displayed | Main Data Sources |
| --- | --- | --- | --- |
| `/` | Landing and marketplace gateway | Header, search, language, location selector, hero, active markets, seller/product highlights, order stats, recommended products, Made in Rwanda/trending sections, video/trust/footer content | user profile, `/markets?activeOnly=true`, `/products/recommendations/for-me?limit=24`, `/orders/public/stats`, order socket |
| `/markets` | Market and product discovery | Search/filter panel, active markets, map layer, promotions, product grid, category/facet filters, recommendation-aware products, loading/offline states | `/users/profile`, `/markets?activeOnly=true`, product recommendation/products query, `/products/catalog/facets`, `/promotions/active`, order socket |
| `/market/[slug]` | Individual market storefront | Market hero, image, location, open/closed status, seller/product counts, rating, market ad video, products, promotions, most bought, highly reviewed, filters, seller videos, about, map, reviews | `/markets/slug/:slug`, `/reviews/target/market/:id`, product recommendations by market, promoted products, facets, `/seller-videos` |
| `/market/[slug]/product/[productId]` | Product detail | Product image gallery/video, price, unit, stock, variants, variant images/video, category attributes, seller/market info, reviews, wishlist, add to cart, negotiate/order actions | `/products/:id`, `/reviews/target/product/:id`, order creation |
| `/products` | Full product discovery | Recommended product list, search, filters, empty/loading states | `/products/recommendations/for-me` |
| `/videos` | TikTok-like seller video feed | Vertical seller/product videos, search, market/product labels, likes, dislikes, comments, tags | `/seller-videos`, video reaction/comment endpoints |
| `/preferences` | Recommendation setup | Category choices, market choices, saved buyer discovery preferences | `/products/catalog/categories`, `/markets?activeOnly=true`, `/users/preferences/discovery` |
| `/cart` | Buyer cart | Cart items, exact variants, quantities, totals, remove/update actions | cart context/local state |
| `/checkout` | Order placement | Delivery address, market location lookup, delivery fee, order summary, payment method, checkout submission, status socket | cart context, `/markets/:id`, `/deliveries/fee`, `/orders`, order socket |
| `/orders` | Buyer order history | Buyer orders, statuses, receipts, delivery lookup, open receipt/order state | `/orders?buyerId=:id`, `/deliveries/:id` |
| `/orders/[orderId]/tracking` | Live buyer tracking | Order timeline, map/tracking, rider info, delivery chat, QR/handover controls, confirm delivery, dispute form | `/orders/:id`, `/deliveries/:id`, delivery/order sockets |
| `/dashboard` | Buyer account overview | Active orders, wallet summary, recent transactions, recommended products | `/orders`, `/wallets/me`, `/wallets/me/transactions`, product recommendations |
| `/wallet` | Buyer wallet | Balance, ledger, deposit, payout/withdrawal actions | wallet endpoints |
| `/wishlist` | Saved products | Wishlist products and removal | user wishlist/local wishlist, `/products?ids=...` |
| `/settings` | User settings | Notification settings, language/contact preferences, account settings, seller/rider profile change requests when relevant | `/users/settings`, seller/rider change request endpoints, notifications |
| `/login` | Authentication | Email/password login, Google option, redirects by role, preference onboarding checks | `/auth/login`, `/auth/me`, `/users/preferences/discovery` |
| `/register` | Account creation | Buyer/seller/rider role selection, profile fields, discovery category loading | `/users/register`, `/products/catalog/categories` |
| `/contact` | Support contact | Support form and contact details | frontend support route/API |
| `/privacy` | Legal | Privacy content | static |
| `/terms` | Legal | Terms content | static |
| `/robots.txt`, `/sitemap.xml` | SEO | Public route metadata, dynamic market/product URLs | market/product service fetches |

### Seller Routes

| Route | Purpose | Data Displayed | Main Data Sources |
| --- | --- | --- | --- |
| `/seller/onboarding` | Seller application | Market selector, active agreement, shop/stall details, documents, payout/MoMo info, onboarding status | `/markets?type=public&isActive=true`, `/contracts/active`, `/sellers/me`, `/sellers/onboard` |
| `/seller/dashboard` | Seller command center | Profile, wallet, products count, pending orders, analytics, live order socket status, revenue/order cards | seller profile, products, orders, wallet, admin seller analytics, order socket |
| `/seller/products` | Inventory management | Product table/cards, search/category filters, totals, edit/delete, bulk template/upload, category loading | `/products?sellerId=:id`, `/sellers/me`, `/products/catalog/categories`, bulk endpoints |
| `/seller/products/new` | Add/edit product | Product form, images, category drilldown, category attributes, variants, bulk import mode | `/products/catalog/categories`, `/products/:id`, `/products`, `/products/bulk-upload` |
| `/seller/orders` | Seller order list | Orders, statuses, buyer summary, filter/search, link to detail | `/orders?sellerId=:id` |
| `/seller/orders/[orderId]` | Seller order detail | Items, financials, payout schedule, buyer dossier, fulfillment timeline, order chat, quote controls, delivery handover | `/orders/:id`, `/deliveries/:id`, status/quote/message/handover endpoints |
| `/seller/promotions` | Promotions manager | Seller products, active deals, create/delete promotions | `/promotions?sellerId=:id`, `/products?sellerId=:id` |
| `/seller/videos` | Seller video ads | Seller products, upload video, publish product ad or shop ad, video metadata | `/sellers/me`, `/products?sellerId=:id`, `/seller-videos/upload`, `/seller-videos` |
| `/seller/earnings` | Seller money view | Wallet, ledger, payout request, receipt lookup | `/wallets/me`, `/wallets/me/transactions`, `/sellers/me`, payout/order endpoints |
| `/seller/analytics` | Seller performance | Sales overview, revenue trend, top products, store health, rating | seller profile, admin seller analytics, review summary |
| `/seller/reviews` | Seller reviews | Seller review list and rating summaries | `/sellers/me`, `/reviews/target/seller/:id` |
| `/seller/qr` | Stall QR | Stall/profile QR and seller identity | `/sellers/me` |

### Rider Routes

| Route | Purpose | Data Displayed | Main Data Sources |
| --- | --- | --- | --- |
| `/rider/register` | Rider application | Vehicle/plate/info form, rider profile status | `/riders/me`, `/riders/register` |
| `/rider/setup` | Rider setup shortcut | Registration/setup form | `/riders/register` |
| `/rider/dashboard` | Rider live work hub | Rider profile, stats, active deliveries, available jobs, wallet, live location button, accept job | `/riders/me`, `/riders/stats/:id`, `/deliveries/rider/:id`, `/deliveries/available`, `/wallets/me`, rider location/socket |
| `/rider/deliveries` | Rider delivery history/current | Active/history deliveries, profile, search | `/deliveries/rider/:id`, `/riders/me` |
| `/rider/earnings` | Rider money view | Wallet, ledger, rider profile, payout request, receipt lookup | wallet, rider, order endpoints |

### Admin Routes

| Route | Purpose | Data Displayed | Main Data Sources |
| --- | --- | --- | --- |
| `/admin` | Admin portal with tabs | Analytics, accounting, live map, seller approvals, markets, product approvals, rider approvals, taxonomy, disputes, fraud, payouts, profile change approvals | admin analytics, sellers, riders, products, markets, orders, deliveries, wallet, taxonomy endpoints |
| `/admin/support` | Support inbox | Support tickets and status controls | `/admin/support`, `/admin/support/:id` |

## 6. Admin Tab Details

The `/admin` page is a tabbed operations console:

- Analytics: GMV, revenue, orders, users, revenue trend, order status distribution.
- Accounting: transactions, total GMV, platform revenue, payouts, net position.
- Live Operations: real-time rider/market map and active operations.
- Seller Approvals: pending and approved sellers, approve/decline actions.
- Markets Directory: market list, create/edit market, sync imagery.
- Product Approvals: seller selector, pending products, approve/reject, bulk upload.
- Rider Approvals: pending riders, approve/reject.
- Taxonomy: create category, parent categories, attributes, variant axes, governance, migration/backfill.
- Disputes and Refunds: disputed orders and resolution actions.
- Fraud Alerts: flagged security issues and suspicious orders/riders.
- Payouts: seller/rider payout requests and completion/failure.
- Settings Change Requests: seller/rider profile edits requiring admin approval.

## 7. Mobile App Relationship

The mobile app is intended to mirror the website feature set with mobile-native navigation. Recent mobile ideas that are also reflected on web include:

- Orange RMF color system.
- Role-aware navigation.
- Mobile-friendly search.
- Market/product/category discovery.
- Category drilldown for product listing.
- Order and negotiation access for buyers.
- Video ads and product discovery.
- Real data from microservices, no static core commerce data.

## 8. Security And Trust Intentions

The project includes or aims to enforce:

- JWT access tokens and refresh tokens.
- Role-aware portals for buyer, seller, rider, and admin.
- Seller/rider approval before full operational access.
- Seller/rider settings changes routed to admin approval.
- Product approval before marketplace visibility.
- Payment replay checks.
- Payment/order status transition validation.
- Order price snapshots.
- Audit logs for critical changes.
- Buyer/seller authorization checks on orders, quote messages, disputes, and delivery details.
- Soft-delete/product log preservation patterns.
- Fraud alerts for distance, payment replay, delivery anomalies, and rider stagnation.

## 9. System Intent In One Sentence

RMF is designed to make Rwandan physical market commerce searchable, trustworthy, payable, negotiable, deliverable, auditable, and recommendable across web and mobile, while keeping sellers, riders, buyers, and admins inside clear role-specific workflows.
