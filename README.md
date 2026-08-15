# PilatesBackend

REST API backend for the Peps Pilate Studio app (mobile app + admin dashboard). Built with Express and MongoDB.

## Tech stack

- **Runtime**: Node.js (v20+)
- **Framework**: Express 4
- **Database**: MongoDB via Mongoose
- **Auth**: JWT (`jsonwebtoken`) + `bcryptjs` for password hashing
- **File uploads**: Multer + Cloudinary (`multer-storage-cloudinary`)
- **Email**: Brevo (Sendinblue) transactional email API
- **Push notifications**: `expo-server-sdk`

## Getting started

```bash
npm install
npm start
```

The server reads its port from `process.env.PORT`, defaulting to `3001`.

## Environment variables

Create a `.env` file in the project root (never commit it):

| Variable | Description |
|---|---|
| `API_URL` | API path prefix, e.g. `/api/v1` |
| `secret` | JWT signing secret |
| `CONNECTION_STRING` | MongoDB Atlas connection string |
| `BREVO_API_KEY` | Brevo (Sendinblue) transactional email API key |
| `SENDER_EMAIL` | From-address used for outgoing emails |
| `SENDER_NAME` | From-name used for outgoing emails |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `PORT` | Port to listen on (set automatically by Render in production) |

## API routes

All routes are mounted under `API_URL` (e.g. `/api/v1`).

| Base path | Resource |
|---|---|
| `/users` | Registration, login, password reset, profile/image updates, subscriptions purchase/payment |
| `/coaches` | Coach CRUD |
| `/cours` | Course (class type) CRUD |
| `/scheduledSessions` | Scheduled class sessions (planning, weekly views, capacity) |
| `/bookings` | User bookings for scheduled sessions |
| `/abonnements` | Subscription plans |
| `/categories` | Course categories (e.g. Pilates, Yoga, Dance) |
| `/articles` | Blog/news articles |
| `/contacts` | Contact form submissions |
| `/analytics` | Dashboard analytics/stats |

Image uploads (coach photos, course images, user profile pictures) accept `multipart/form-data` with an `image` field and are stored on Cloudinary. Note: Cloudinary's free tier caps uploads at 10MB.

## Notes

- `middleware/jwt.js` defines an `express-jwt`-based auth middleware, but it is currently **not wired into `app.js`** — route-level auth (login/inscription) is handled manually in `routes/user.js` instead.
- Login/registration endpoints are rate-limited (5 requests / 5 minutes per IP).

## Deployment (Render)

- Build command: `npm install`
- Start command: `npm start`
- Set all environment variables from the table above in the Render dashboard (do not upload `.env`).
