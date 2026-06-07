# Project Identity: Rwanda Market Facilitator (RMF)

## Overview
RMF is a **localized digital commerce and logistics platform** purpose-built for Rwanda. It digitizes physical market hubs (e.g., Nyabugogo, Kimironko) and independent brick-and-mortar stalls, connecting buyers, sellers, riders (couriers), and system admins in a unified marketplace ecosystem.

## Full Name
Rwandan Market Facilitator (RMF)

## Domain
- **Industry:** Localized e-commerce / digital marketplace / last-mile logistics
- **Geography:** Rwanda (Kigali and regional markets)
- **Business Model:** Multi-sided marketplace with escrow-like payments, platform margins, and delivery dispatch

## Core Value Propositions
1. **Local Commerce Digitization:** Physical stalls become searchable and purchasable online.
2. **Trust-Based Payments:** Escrow-like payment stages (MoMo/PayPack) hold funds until rider confirms pickup/delivery.
3. **Accountable Logistics:** Local geographical dispatch with progressive rider scanning and distance-based dynamic pricing.
4. **Immersive Discovery:** TikTok-style snap-scroll video feeds for products and shop ads to mirror physical marketplace energy.
5. **Structured Cataloging:** Multi-tier taxonomy with variant-level tracking (price, stock, media) rather than simple tags.

## Primary User Personas
- **Buyer:** Discovers markets/shops/products, negotiates quotes, places orders, tracks deliveries.
- **Seller:** Digitizes stall, manages inventory/variants, handles orders, receives payouts.
- **Rider:** Accepts nearby delivery jobs, manages pickups/handovers with QR proof, earns per trip.
- **Admin:** Approves sellers/riders, monitors fraud, resolves disputes, manages taxonomy and accounting.

## Tech Stack Summary
- **Monorepo Tool:** Turborepo (npm workspaces)
- **Frontend:** Next.js 16 (App Router), React 18, TypeScript, Tailwind CSS, Leaflet/Mapbox maps, Socket.IO client
- **Backend:** NestJS 11 microservices, TypeScript, Express platform
- **Database:** MongoDB ( Mongoose ODM )
- **Caching:** Redis (optional for some services)
- **Real-Time:** Socket.IO (delivery tracking, notifications)
- **Payments:** PayPack (Rwanda), MTN MoMo, Airtel Money
- **Notifications:** Africa’s Talking (SMS), SendGrid (Email), In-App push
- **Storage:** Google Cloud Storage (primary), S3/R2 fallback
- **Deployment:** Render (Web services + managed MongoDB/Redis via env refs); Docker Compose for local dev
- **Maps/Geocoding:** Google Maps API, Mapbox, OpenCage, custom haversine/location package
- **Auth:** JWT (Passport.js), Google OAuth, bcrypt, role-based guards
