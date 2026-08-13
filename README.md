# UPI Gateway

A Node.js web application that generates UPI payment links with QR codes, app-specific deeplinks, IP/CIDR-based access control, and webhook-driven status updates.

## Features

- Generate payment links with UPI intent URLs
- QR code and app-specific deeplinks (GPay, PhonePe, Paytm, CRED, BHIM)
- Configurable UPI apps per payment link
- IP-based access restriction with CIDR support (e.g. `10.0.0.0/8`, `0.0.0.0/0`)
- Configurable timeout with countdown timer on payment page
- Webhook endpoint for payment status updates with HMAC-SHA256 checksum verification
- Callback URL redirects on success, failure, or timeout (with status, orderId, errMsg params)
- Zod request validation
- OpenAPI/Swagger documentation (dev only)
- CI pipeline with GitHub Actions + Docker Hub publish

## Tech Stack

- Node.js + TypeScript
- Express 5
- TypeORM + SQLite (better-sqlite3)
- Zod (request validation)
- MVC architecture
- Jest + Supertest (testing)
- Docker (multi-stage build)

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

```env
WEBHOOK_SECRET=your-webhook-secret-here
DB_NAME=database.sqlite
NODE_ENV=development
PORT=3000
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DB_NAME` | SQLite database filename | `database.sqlite` |
| `NODE_ENV` | Environment (`development` enables Swagger UI) | - |
| `WEBHOOK_SECRET` | Secret key for webhook checksum verification | - |

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
docker run -p 3000:3000 \
  -e WEBHOOK_SECRET=secret \
  -e NODE_ENV=production \
  upi-gateway
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/create` | HTML form to create a payment link |
| POST | `/create` | Create a new payment link (Zod validated) |
| GET | `/pay/:id` | Payment page with QR, deeplinks, countdown |
| GET | `/status/:id` | Get payment status (used for polling) |
| POST | `/updatePayment` | Webhook to update payment status |
| GET | `/upiAppsList` | List all available UPI apps |

### POST /create

Creates a new payment link. Validated with Zod schema.

```json
{
  "intentURL": "upi://pay?pa=merchant@upi&am=100",
  "allowedIP": "192.168.1.0/24, 10.0.0.5",
  "orderId": "ORD-12345",
  "timeout": 300,
  "upiApps": "gpay,phonepe,cred",
  "callbackUrl": {
    "successCallbackUrl": "https://example.com/success",
    "failureCallbackUrl": "https://example.com/failure",
    "pendingCallbackUrl": "https://example.com/pending"
  }
}
```

**Validation rules:**
- `intentURL` — required, must start with `upi://`
- `allowedIP` — required, supports exact IPs, comma-separated, and CIDR notation
- `timeout` — optional, must be a positive number (seconds). Default: 86400 (24h)
- `upiApps` — optional, comma-separated app identifiers. Default: `gpay,phonepe,paytm,cred,bhim`
- `callbackUrl.*` — optional, must be valid URLs

**Response (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "/pay/550e8400-e29b-41d4-a716-446655440000"
}
```

### GET /status/:id

Returns current payment status with callback URLs that have query params appended.

**Response (200):**
```json
{
  "status": "pending",
  "orderId": "ORD-12345",
  "expireAt": "2026-08-11T10:00:00.000Z",
  "successCallbackUrl": "https://example.com/success?status=pending&orderId=ORD-12345",
  "failureCallbackUrl": "https://example.com/failure?status=pending&orderId=ORD-12345",
  "pendingCallbackUrl": "https://example.com/pending?status=pending&orderId=ORD-12345"
}
```

On failure, `failureCallbackUrl` also includes `&errMsg=<encoded message>` if an error message was set.

### POST /updatePayment

Webhook endpoint. Requires `x-checksum` header (HMAC-SHA256 of body with `WEBHOOK_SECRET`).

```json
{
  "id": "payment-link-uuid",
  "status": "success",
  "errorMessage": "Optional error message for failures"
}
```

**Checksum generation:**
```js
const crypto = require('crypto');
const body = JSON.stringify({ id: "...", status: "success" });
const checksum = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
```

### GET /upiAppsList

Returns all registered UPI/PSP apps.

**Response (200):**
```json
[
  {
    "id": "uuid",
    "identifier": "gpay",
    "name": "Google Pay",
    "url": "tez://upi/",
    "logoUrl": "https://..."
  }
]
```

## Payment Page Behavior

The `/pay/:id` page:
1. Verifies the client IP against allowed IPs/CIDRs
2. Records first-click metadata (timestamp, IP, User-Agent)
3. Displays QR code + configured UPI app deeplinks
4. Shows a countdown timer based on the configured timeout
5. Polls `/status/:id` every 5 seconds:
   - On `success` → redirects to `successCallbackUrl`
   - On `failure` → redirects to `failureCallbackUrl`
   - On timeout (countdown reaches 0) → redirects to `pendingCallbackUrl`

## Project Structure

```
src/
├── app.ts                    # Express app setup
├── index.ts                  # Server entry point
├── config/
│   ├── database.ts           # TypeORM data source
│   └── psp-app-data.json     # PSP app seed data
├── controllers/
│   └── paymentController.ts  # Route handlers
├── docs/
│   └── openapi.json          # OpenAPI 3.0 spec
├── middleware/
│   └── validate.ts           # Zod validation middleware
├── models/
│   ├── PaymentLink.ts        # Payment link entity
│   └── PSPAppsUrl.ts         # PSP apps entity
├── routes/
│   └── index.ts              # Express router
├── schemas/
│   └── paymentSchemas.ts     # Zod validation schemas
├── tests/
│   └── api.spec.ts           # API test suite
├── utils/
│   ├── deeplinkGen.ts        # Deeplink generation utility
│   └── ipMatch.ts            # IP/CIDR matching utility
└── views/
    ├── create.html           # Create form template
    ├── createView.ts         # Create page renderer
    ├── pay.html              # Payment page template
    └── payView.ts            # Payment page renderer
```

## CI/CD

GitHub Actions pipeline (`.github/workflows/ci.yml`):
- **build-and-test** — runs on Node 18, 20, 22
- **publish** — builds and pushes Docker image to Docker Hub on push to `main`

Required GitHub secrets:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

## License

ISC
