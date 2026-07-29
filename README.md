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
```

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