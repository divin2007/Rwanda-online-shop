# Mobile Design QA

final result: passed

Reference source:
- Stitch Solaris Ivory marketplace package: `C:/Users/mahor/Downloads/stitch_solaris_ivory_marketplace_platform (2).zip`
- Stitch project URL provided by user: `https://stitch.withgoogle.com/projects/17284394433733616142`

Checked viewport:
- Mobile browser viewport: 390 x 844
- Local app: `http://localhost:19000`

Screens checked:
- Home: Solaris image hero, quick actions, market/product sections, five-item bottom nav.
- Discover: product grid uses the Solaris Ivory card system and active Discover tab.
- Hub Explorer: market directory now matches the Stitch hub explorer structure with search, chips, list/map toggle, live data row, and hub cards.
- Orders: tabbed mobile route with search/status grouping and empty authenticated state.
- Inbox: duplicate root notifications route removed; `/notifications` resolves to the tabbed Inbox route with bottom navigation.
- Profile: improvised Solaris profile with role-specific workspace links.
- Riders: new buyer-facing approved rider directory with review, premium, system pickup, and direct call affordances.
- Product detail and cart: Add Product to Cart navigates to Secure Checkout and keeps the cart item.

Verification:
- `npm.cmd run typecheck` passed in `mobile-app`.
- Browser console errors: none during the checked mobile route pass.
- Cart flow: first product added to cart, `/cart` loaded with one cart item.

Follow-up error pass:
- Fixed root stack warning from a stale `notifications` screen registration.
- Fixed Orders hook-order crash by keeping all hooks before early returns.
- Added video discovery controls: persistent search, product/shop/deal/grocery/market chips, no-result state, and clickable video hashtags.
- Verified Orders, Inbox, Videos, and Riders in a fresh mobile browser tab with zero console errors.
- Verified video search input and Products chip interaction with zero console errors.

Second replica/error pass:
- Product detail now follows the Stitch product-detail reference: image stage, tags, seller row, base price/minimum order, variant grid, quantity stepper, specification grid, review block, and fixed Negotiate/Add to Cart bar.
- Header bell now routes to `/notifications` and selects the Inbox tab, not Orders.
- Notification taps now route by role/channel so seller messages open seller order context and rider/delivery notifications open rider deliveries.
- Order detail now separates seller/buyer order chat from rider delivery chat.
- Rider active-delivery screen now exposes rider delivery chat and sends messages as `RIDER` on the `DELIVERY` channel.
- Map preview now uses a web iframe renderer with initial Leaflet points and opens Google Maps directly on web.
- Verified product detail and bell routing in the in-app browser.
- `npm.cmd run typecheck` passed in `mobile-app`.

Remaining notes:
- Authenticated Inbox category filters appear after sign-in; guest state intentionally shows the sign-in card.
- Person pickup booking still routes into the protected market/order path because mobile does not yet expose a dedicated person-pickup creation form.
