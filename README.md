# JanSetu Backend

The backend is the shared API layer for the JanSetu system. It powers the citizen app, admin panel, field admin app, and the operational workflows that connect them.

## What It Does

- Accepts and stores citizen complaints and supporting media
- Tracks report status, assignment, and completion history
- Calculates priority and helps route reports to the right team
- Sends OTP, email, SMS, push, and WhatsApp notifications
- Supports admin, field admin, social, message, report, user, and priority workflows
- Integrates with Cloudinary, Firebase Admin, Redis, PostgreSQL, and third-party messaging services

## Tech Stack

- Node.js
- Express 5
- PostgreSQL
- Sequelize
- Redis
- Cloudinary
- Multer
- JWT
- Nodemailer
- Firebase Admin
- Twilio
- Axios and third-party AI or messaging helpers

## Main Modules

- `controllers/` - request handlers for admin, field admin, messages, OTP, priority, reports, social, and users
- `routes/` - REST endpoints for the platform features
- `services/` - notification, AI, media, Redis, SMS, email, WhatsApp, and priority helpers
- `db/` - database connection helpers and utilities
- `middlewares/` - upload and request middleware
- `Public/` - local image and temp asset storage
- `config/` - service account and runtime configuration

## Key Features

- OTP authentication and user verification
- Complaint intake and lifecycle management
- Report prioritization and category handling
- Field assignment and progress tracking
- Notification fan-out across channels
- Media upload and storage management
- Social and messaging support
- Health and status endpoints for operational monitoring

## Routes At A Glance

- `admin.routes.js`
- `fieldAdmin.routes.js`
- `health.routes.js`
- `messages.routes.js`
- `notifications.routes.js`
- `otp.routes.js`
- `priority.routes.js`
- `reports.routes.js`
- `social.routes.js`
- `users.routes.js`

## Environment Variables

Create a local `.env` and provide the runtime values used by the services:

```env
PORT=4000
DATABASE_URL=postgres://username:password@host:port/database?sslmode=require
PG_CA_PATH=./certs/ca.pem

CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token

# Meta WhatsApp Cloud API (set these on the backend host, never in the mobile app)
WHATSAPP_PHONE_NUMBER_ID=your_meta_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_meta_access_token
WHATSAPP_GRAPH_API_VERSION=v26.0
WHATSAPP_RESOLVED_TEMPLATE=jansetu_report_resolved
WHATSAPP_IMAGE_TEMPLATE=jansetu_resolution_photo
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_REPORT_UPDATES_ENABLED=false
```

### WhatsApp report notifications

The backend sends opted-in report resolution updates through Meta's WhatsApp Cloud API. The feature flag defaults off; while it is off no WhatsApp messages are sent. It does not use the `wa/` WhatsApp Web gateway, a QR code, or a linked-device session. Add the variables above to the **deployed Backend's** secret environment (and to `Backend/.env` only for local development). Never put the access token in the Expo app or commit it.

Before deploying the opt-in field, apply `Backend/migrations/20261104_add_whatsapp_updates_to_reports.sql` to the Backend PostgreSQL database. Existing reports get `whatsapp_updates = false`. To activate WhatsApp later, complete the Meta setup below, turn on the app's `WHATSAPP_REPORT_UPDATES_AVAILABLE` constant, and set `WHATSAPP_REPORT_UPDATES_ENABLED=true` in the Backend environment. The reporter must opt in when creating each report; opting out leaves normal in-app notifications unchanged.

One-time Meta setup:

1. Create or use a Meta Business portfolio and a WhatsApp Business Account, add/verify a phone number in WhatsApp Manager, and complete the required business/payment setup.
2. In Meta for Developers, create an app with the WhatsApp product. Get its **Phone Number ID** and a production access token with `whatsapp_business_messaging` permission; use a system-user token for a long-running deployment rather than the temporary test token.
3. In WhatsApp Manager, create and get approval for an English **UTILITY** template named `jansetu_report_resolved`, with body `Jan Setu report update: {{1}}`. The service supplies the report update as parameter 1.
4. Create and get approval for an English **UTILITY** template named `jansetu_resolution_photo`, with an **image header** and body `Resolution photo: {{1}}`. The service supplies the public HTTPS image URL in the header and the photo caption as parameter 1.
5. Set the Phone Number ID, token, and exact approved template names/language in the backend environment, then deploy/restart the Backend.

Recipients must have opted in to receive WhatsApp messages from JanSetu. The WhatsApp number must be registered with the Cloud API and cannot simultaneously remain registered as a normal WhatsApp/WhatsApp Business app number unless Meta's supported coexistence setup is enabled. Real-recipient messaging requires the Meta account/number to be live; Meta's test number only reaches configured test recipients. Check the Cloud API response and Meta delivery status webhooks when diagnosing delivery: an accepted API request is not a delivery receipt.

## Database SSL Notes

The connection layer supports managed PostgreSQL providers that require a CA bundle.

- Put the provider certificate in `Backend/certs/ca.pem`
- Point `PG_CA_PATH` to that file in production
- Keep the insecure development fallback out of production environments

## Local Development

```bash
npm install
npm run dev
```

The server entrypoint is `server.js` and the production start command is `npm start`.

## Related Docs

- `DEPLOYMENT_GUIDE.md`
- `DYNAMIC_PRIORITY_SYSTEM.md`
- `PRIORITY_SUMMARY.md`
- `STATUS_SYNCHRONIZATION.md`
- `REDIS_VERCEL_FIX.md`
- `FIX_SUMMARY.md`
