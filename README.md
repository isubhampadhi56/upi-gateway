# UPI Gateway

A Node.js web application that generates UPI payment links with QR codes, app-specific deeplinks, IP-based access control, and webhook-driven status updates.

## Features

- Generate payment links with UPI intent URLs
- QR code and app-specific deeplinks (GPay, PhonePe, Paytm, CRED, BHIM)
- IP-based access restriction (comma-separated allowed IPs)
- Configurable timeout with countdown timer on payment page
- Webhook endpoint for payment status updates with HMAC-SHA256 checksum verification
- Callback URL redirects on success, failure, or timeout
- OpenAPI/Swagger documentation (dev only)

## Tech Stack

- Node.js + TypeScript
- Express 5
- TypeORM + SQLite (better-sqlite3)
- MVC architecture

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install --legacy-peer-deps
```

### Configuration

Create a `.env` file in the project root:

```
WEBHOOK_SECRET=your-webhook-secret-here
DB_NAME=database.sqlite
NODE_ENV=development
```

### Development

```bash
npm run dev
```

Server starts at `http://localhost:3000`.

API docs available at `http://localhost:3000/api-docs` (only when `NODE_ENV=development`).

### Build & Production

```bash
npm run build
npm start
```

### Run Tests

```bash
npm test
```

### Docker

```bash
docker build -t upi-gateway .
docker run -p 3000:3000 -e WEBHOOK_SECRET=secret -e NODE_ENV=production upi-gateway
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/create` | HTML form to create a payment link |
| POST | `/create` | Create a new payment link |
| GET | `/pay/:id` | Payment page with QR, deeplinks, countdown |
| GET | `/status/:id` | Get payment status (used for polling) |
| POST | `/updatePayment` | Webhook to update payment status |

### POST /create

```json
{
  "intentURL": "upi://pay?pa=merchant@upi&am=100",
  "allowedIP": "192.168.1.10, 10.0.0.5",
  "orderId": "ORD-12345",
  "timeout": 300,
  "callbackUrl": {
    "successCallbackUrl": "https://example.com/success",
    "failureCallbackUrl": "https://example.com/failure",
    "pendingCallbackUrl": "https://example.com/pending"
  }
}
```

### POST /updatePayment

Requires `x-checksum` header (HMAC-SHA256 of body with `WEBHOOK_SECRET`):

```json
{
  "id": "payment-link-uuid",
  "status": "success",
  "errorMessage": "Optional error message for failures"
}
```

## Project Structure

```
src/
├── app.ts                  # Express app setup
├── index.ts                # Server entry point
├── config/
│   ├── database.ts         # TypeORM data source
│   └── psp-app-data.json   # PSP app seed data
├── controllers/
│   └── paymentController.ts
├── docs/
│   └── openapi.json        # OpenAPI 3.0 spec
├── models/
│   ├── PaymentLink.ts
│   └── PSPAppsUrl.ts
├── routes/
│   └── index.ts
├── utils/
│   └── deeplinkGen.ts
└── views/
    ├── create.html
    ├── createView.ts
    ├── pay.html
    └── payView.ts
```

## License

ISC
