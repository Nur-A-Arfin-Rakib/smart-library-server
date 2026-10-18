# Smart Library - Server

Backend API for the **Smart Library System**: a university library platform where students book study seats, borrow books, and track attendance, librarians handle check-ins and returns, and admins manage users, zones, books, notices, and analytics.

Built with **Node.js, Express, TypeScript, and MongoDB**.

Frontend repo: [smart-library-client](https://github.com/Nur-A-Arfin-Rakib/smart-library-client)

---

## Features

### Authentication
- Email/password registration and login (JWT in cookies)
- Google OAuth login
- Profile view and update
- Role-based access control: `student`, `librarian`, `admin`

### Seat Booking
- Study zones with real-time seat availability
- Book a seat for a time slot (overlap-safe)
- Cancel bookings
- QR-code check-in
- Automatic no-show detection

### Books
- Search and browse the catalog
- Borrow, renew, and return books
- Overdue fines with Stripe checkout payment
- Book reviews and wishlist
- Book reservations

### Attendance
- OTP-based attendance verification (sent by email)
- Personal attendance history

### Librarian Tools
- Manual check-in for bookings
- Process book returns
- Mark fines as paid
- Daily summary

### Admin Panel
- User management (list, change role, delete)
- Zone and seat management
- Book management (create, update, delete)
- Notice board management
- Analytics: overview, occupancy trend, popular zones

### Background Jobs (node-cron)
| Job | Schedule |
|---|---|
| No-show sweep | Every 5 minutes |
| Booking reminders | Every minute |
| Overdue sweep | Daily at midnight |
| Due-date reminders | Daily at 9:00 AM |

---

## Tech Stack

| Area | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 4 |
| Language | TypeScript |
| Database | MongoDB + Mongoose |
| Auth | JWT, bcryptjs, Google Auth Library |
| Payments | Stripe |
| Email | Nodemailer (Gmail) |
| Scheduling | node-cron |
| QR codes | qrcode |

---

## Project Structure

```
src/
  config/        Database connection
  controllers/   Request handlers (auth, books, bookings, admin, ...)
  interfaces/    TypeScript interfaces
  middleware/    Auth and role guards
  models/        Mongoose schemas
  routes/        Express routers
  utils/         Cron jobs, email, fines, Stripe, token helpers
  server.ts      App entry point
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A MongoDB database (Atlas or local)

### 1. Clone and install

```bash
git clone https://github.com/Nur-A-Arfin-Rakib/smart-library-server.git
cd smart-library-server
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/smart-library
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
NODE_ENV=development

# Optional
GOOGLE_CLIENT_ID=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EMAIL_USER=
EMAIL_APP_PASSWORD=
```

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret for signing tokens |
| `CLIENT_URL` | Yes | Frontend origin allowed by CORS |
| `GOOGLE_CLIENT_ID` | No | Enables Google login |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | No | Enables fine payments |
| `EMAIL_USER`, `EMAIL_APP_PASSWORD` | No | Enables email OTP and reminders (Gmail App Password) |

### 3. Run

```bash
npm run dev      # development with auto-reload
npm run build    # compile TypeScript
npm start        # run compiled build
```

Server starts at **http://localhost:5000**. Health check: `GET /`.

---

## API Overview

All routes are prefixed with `/api`.

| Prefix | Purpose | Access |
|---|---|---|
| `/auth` | Register, login, Google login, logout, profile | Public / Authenticated |
| `/books` | Search, borrow, renew, reserve, review, wishlist, pay fine | Authenticated |
| `/bookings` | Zones availability, create/cancel booking, QR check-in | Authenticated |
| `/attendance` | Send/verify OTP, attendance history | Authenticated |
| `/notices` | List notices | Authenticated |
| `/payments` | Stripe checkout session, webhook | Authenticated |
| `/librarian` | Manual check-in, returns, mark fine paid, daily summary | Librarian / Admin |
| `/admin` | Users, zones, seats, books, notices, analytics | Admin |

---

## Roles

| Role | Can do |
|---|---|
| **Student** | Book seats, borrow/renew books, pay fines, review, wishlist, attendance |
| **Librarian** | Manual check-in, returns, fine marking, daily summary |
| **Admin** | Full access: users, zones, seats, books, notices, analytics |

---

## Security Notes

- Never commit your `.env` file (it is already in `.gitignore`).
- Use a long random `JWT_SECRET` in production.
- The Stripe webhook route uses the raw request body to verify signatures.

---

## Author

**Nur-A-Arfin Rakib** - [@Nur-A-Arfin-Rakib](https://github.com/Nur-A-Arfin-Rakib)