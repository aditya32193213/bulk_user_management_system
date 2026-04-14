# Bulk User Management System

A scalable backend API built with **Node.js + Express + MongoDB** that supports bulk creation and bulk updating of users with full validation, error handling, and performance optimization.

---

## Tech Stack

- **Runtime** — Node.js ≥ 18.0.0 (ES Modules)
- **Framework** — Express v5
- **Database** — MongoDB via Mongoose v9
- **Tools** — dotenv, cors, helmet, nodemon

---

# 🌐🚀 Live Deployment
- 🔗 Backend API
👉 **[https://bulk-user-management-system-jgg8.onrender.com/](https://bulk-user-management-system-jgg8.onrender.com/)**

---

## Project Structure

```
bulk-user-management/
├── config/
│   └── db.js                 # MongoDB connection
├── controllers/
│   └── userController.js     # Business logic (insertMany, bulkWrite)
├── db_backup/                # mongodump BSON export (generated)
│   ├── users.bson
│   └── users.metadata.json
├── middleware/
│   └── errorHandler.js       # Global error handler + 404
├── models/
│   └── User.js               # Mongoose schema + indexes
├── routes/
│   └── userRoutes.js         # Route definitions
├── scripts/
│   └── seed.js               # Generates & inserts 5,000 test users
├── validators/
│   └── userValidators.js     # Pre-DB validation middleware
├── .env
├── .env.example
├── .gitignore
├── app.js                    # Express application setup
├── Bulk_User_Management.postman_collection.json
├── package-lock.json
├── package.json
├── README.md
├── server.js                 # Entry point — starts DB + HTTP server
└── users.json                # mongoexport JSON export (generated)
```

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/aditya32193213/bulk_user_management_system.git
cd bulk-user-management
```

### 2. Install dependencies

```bash
npm install
```

> **Node.js ≥ 18 required.** `seed.js` uses the native `fetch` global which is only available from Node 18 onwards. The `engines` field in `package.json` enforces this.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/bulk_user_db
NODE_ENV=development

# Set this to your actual client origin in production.
# Leaving it unset fails safe — only localhost can reach the API.
ALLOWED_ORIGIN=http://localhost:5000
```

### 4. Start MongoDB

Make sure MongoDB is running locally:

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Ubuntu / WSL
sudo systemctl start mongod

# Windows
net start MongoDB
```

### 5. Start the server

```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

Server will run at `http://localhost:5000`

---

## API Reference

### POST `/api/users/bulk-create`

Bulk insert users. Uses `insertMany()` with `ordered: false` for partial failure support.

**Request Body** — JSON array of user objects:

```json
[
  {
    "fullName": "Aditya Sharma",
    "email": "aditya.sharma@gmail.com",
    "phone": "9876543210",
    "walletBalance": 1500.50,
    "kycStatus": "Approved",
    "isBlocked": false,
    "deviceInfo": {
      "ipAddress": "192.168.1.1",
      "deviceType": "Mobile",
      "os": "Android"
    }
  }
]
```

| Status | Meaning |
|--------|---------|
| `201`  | All records inserted successfully |
| `207`  | Partial success — some duplicates skipped |
| `400`  | Body is not an array, is empty, or exceeds 10,000 records |
| `422`  | Validation failed — errors listed per record |
| `500`  | Unexpected server error |

---

### PUT `/api/users/bulk-update`

Bulk update users by email. Uses `bulkWrite()` — never `save()` in a loop.

**Request Body** — JSON array. `email` is the match key (case-insensitive — normalised to lowercase before matching). Include any fields to update:

```json
[
  {
    "email": "aditya.sharma@gmail.com",
    "kycStatus": "Rejected",
    "walletBalance": 0
  }
]
```

| Status | Meaning |
|--------|---------|
| `200`  | All updates applied |
| `207`  | Partial update (some emails not found) |
| `400`  | Body is not an array, is empty, or exceeds 10,000 records |
| `422`  | Validation failed — errors listed per record |
| `500`  | Unexpected server error |

---

## Schema

| Field | Type | Rules |
|-------|------|-------|
| `fullName` | String | Required, trimmed, min 3 chars |
| `email` | String | Required, unique, stored lowercase, valid format |
| `phone` | String | Required, unique, numeric only, 10–15 digits |
| `walletBalance` | Number | Default: 0, min: 0 |
| `isBlocked` | Boolean | Default: false |
| `kycStatus` | Enum | Pending / Approved / Rejected — Default: Pending |
| `deviceInfo.ipAddress` | String | Optional |
| `deviceInfo.deviceType` | Enum | Mobile / Desktop |
| `deviceInfo.os` | Enum | Android / iOS / Windows / macOS |
| `createdAt` | Date | Auto-generated |
| `updatedAt` | Date | Auto-updated |

---

## Database Indexes

```js
db.users.getIndexes()
```

```json
[
  { "key": { "_id": 1 },                        "name": "_id_" },
  { "key": { "email": 1 },                      "name": "email_1",                    "unique": true },
  { "key": { "phone": 1 },                      "name": "phone_1",                    "unique": true },
  { "key": { "kycStatus": 1, "isBlocked": 1 },  "name": "kycStatus_1_isBlocked_1" }
]
```

**Index Justification:**

- `email` (unique) — Primary lookup key for `bulk-update` match filter. Unique constraint prevents duplicates at DB level as a second safety net after the validator.
- `phone` (unique) — Enforces uniqueness at DB level, same as email.
- `kycStatus + isBlocked` (compound) — Optimizes admin dashboard queries such as *"show all blocked users with Pending KYC"*, which are the most common operational query patterns for a user management system. A compound index on these two fields is more efficient than two separate single-field indexes for combined filters.

---

## Seeding 5,000 Test Users

```bash
node scripts/seed.js
```

This generates 5,000 unique users with realistic data and sends them to the bulk-create endpoint in batches of 1,000.

Expected output:

```
═══════════════════════════════════════════════
   Bulk User Seed Script
   Target : http://localhost:5000/api/users/bulk-create
   Records: 5000
   Batches: 5 × 1000
═══════════════════════════════════════════════

📦 Generating 5000 users...
✅ Generated 5000 users.

🚀 Sending batches...

  Batch 1: HTTP 201
  ✅ Inserted: 1000 / 1000
  Batch 2: HTTP 201
  ✅ Inserted: 1000 / 1000
  ...

═══════════════════════════════════════════════
   Seed Complete
   ✅ Inserted : 5000
   ❌ Failed   : 0
   ⏱  Time     : 3.42s
═══════════════════════════════════════════════
```

---

## Database Export

Run these commands after seeding data:

```bash
# BSON export (creates db_backup/ folder)
mongodump --db bulk_user_db --out ./db_backup

# JSON export (creates users.json)
mongoexport --db bulk_user_db --collection users --out ./users.json --jsonArray
```

Both `db_backup/` and `users.json` are included in the submission.

---

## Postman Collection

Import `Bulk_User_Management.postman_collection.json` into Postman.

Set the `base_url` variable to `http://localhost:5000`.

The collection covers:

- ✅ Bulk create — valid users
- ⚠️ Bulk create — partial failure (duplicate email)
- ❌ Bulk create — validation errors, empty array, invalid JSON
- ✅ Bulk update — valid updates
- ⚠️ Bulk update — partial (email not found)
- ❌ Bulk update — validation errors, empty array
- ❌ 404 unknown route

---

## Performance & Security Design Decisions

| Decision | Reason |
|----------|--------|
| `insertMany({ ordered: false })` | Continues inserting remaining records when one fails — prevents a single duplicate from cancelling 4,999 valid inserts |
| `bulkWrite()` for updates | Single round-trip to MongoDB for all updates. Never uses `save()` in a loop which would be O(n) DB calls |
| `express.json({ limit: "50mb" })` | Default 100kb limit would reject a 5,000-record payload |
| Pre-DB validation middleware | Catches bad records before hitting MongoDB — avoids wasteful DB round-trips on clearly invalid data. Also critical for `bulkWrite` which bypasses Mongoose schema validators entirely |
| Phone validated in bulk-update path | `bulkWrite` skips Mongoose validators; without explicit pre-DB phone validation, invalid phone strings could be written directly to the database |
| Email lowercased before `bulkWrite` filter | Schema stores email in lowercase. Normalising the filter value ensures mixed-case input like `ADITYA@GMAIL.COM` correctly matches the stored `aditya@gmail.com` |
| Early exit at 50 validation errors | Prevents the validator from iterating all 5,000 records when the payload is clearly malformed |
| `helmet()` middleware | Sets production-grade HTTP security headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.) with zero configuration |
| Restricted CORS origin | `cors()` with no options allows every origin. Explicit `ALLOWED_ORIGIN` env var means a misconfigured production deploy fails safe rather than silently open |
| `engines: { node: ">=18.0.0" }` | `seed.js` uses native `fetch` (Node 18+). The engines field surfaces a clear error on older Node versions instead of a cryptic `ReferenceError: fetch is not defined` |

---

## Deployment (Bonus)

Deployed on **Render** with **MongoDB Atlas** as the cloud database.

| Item | Value |
|------|-------|
| Platform | Render |
| Database | MongoDB Atlas |
| Live URL | https://bulk-user-management-system-jgg8.onrender.com |

**Endpoints (live):**
- `POST` https://bulk-user-management-system-jgg8.onrender.com/api/users/bulk-create
- `PUT`  https://bulk-user-management-system-jgg8.onrender.com/api/users/bulk-update

> **Note:** Render free tier spins down after inactivity — first request may take ~30s to wake up.