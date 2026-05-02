# Rwandan Market Facilitator - API Documentation

## Auth Service (Port 3001)
* `POST /api/v1/auth/login`
* `POST /api/v1/users/register`
* `GET /api/v1/users/profile` (Requires JWT)

## Market Service (Port 3002)
* `POST /api/v1/markets`
* `GET /api/v1/markets`
* `GET /api/v1/markets/slug/:slug`
* `GET /api/v1/contracts/active`

## Product Service (Port 3003)
* `POST /api/v1/products`
* `GET /api/v1/products`
* `POST /api/v1/promotions`

## Seller Service (Port 3004)
* `POST /api/v1/sellers/onboard`
* `GET /api/v1/sellers/stall/:stallId/qr`

## Rider Service (Port 3005)
* `POST /api/v1/riders/register`
* `PUT /api/v1/riders/user/:userId/status`

## Order Service (Port 3006)
* `POST /api/v1/orders`
* `POST /api/v1/orders/:id/dispute`

## Wallet Service (Port 3007)
* `POST /api/v1/wallets/transaction`
* `POST /api/v1/wallets/user/:userId/payout`

## Delivery Service (Port 3008)
* `POST /api/v1/deliveries/fee`
* `POST /api/v1/deliveries/:id/pickup` (Requires `photoUrl` and `qrData`)

## Review Service (Port 3010)
* `POST /api/v1/reviews`
