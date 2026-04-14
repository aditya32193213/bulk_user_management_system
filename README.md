# 🚀 Bulk User Management System

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-≥18.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_9.x-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![ES Modules](https://img.shields.io/badge/ES_Modules-Native-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

A **production-ready**, scalable REST API for bulk creation and bulk updating of user records — engineered to handle **5,000+ users per request** with zero crashes, atomic partial-failure handling, and deep input validation.

</div>

---

## 🌐🚀 Live Deployment
- 🔗 Backend API
👉 **[https://bulk-user-management-system-jgg8.onrender.com/](https://bulk-user-management-system-jgg8.onrender.com/)**

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🗂️ Project Structure](#️-project-structure)
- [⚙️ Tech Stack](#️-tech-stack)
- [🛠️ Setup & Installation](#️-setup--installation)
- [🔑 Environment Variables](#-environment-variables)
- [🌱 Seeding the Database](#-seeding-the-database)
- [📡 API Reference](#-api-reference)
- [🗄️ Database Schema](#️-database-schema)
- [📈 Indexes & Performance](#-indexes--performance)
- [💾 Database Export](#-database-export)
- [📬 Postman Collection](#-postman-collection)
- [🔐 Security](#-security)
- [📊 Evaluation Rubric](#-evaluation-rubric)

---

## ✨ Features

- 📦 **Bulk Create** — Insert up to **10,000 users in a single request** using `insertMany()` with `ordered: false` (non-blocking partial inserts)
- ✏️ **Bulk Update** — Update thousands of users atomically using MongoDB's `bulkWrite()` — no loops, no `save()` calls
- 🛡️ **Deep Validation** — Multi-layer validation: request-level (before DB round-trip), intra-batch duplicate detection, schema-level enforcement
- ⚡ **Partial Failure Handling** — Returns **HTTP 207** with detailed per-record error info when a subset of records fail
- 🔐 **Security Hardened** — Helmet headers, CORS, rate limiting (30 req/min), prototype-pollution protection in nested updates
- 📊 **Performance Optimized** — Compound DB indexes, `lean()` queries, 50 MB payload cap, explicit batch-size hard limit
- 🌍 **Express 5** — Async errors auto-caught; no manual `next(err)` boilerplate needed in routes

---

## 🗂️ Project Structure

```
📦 BACKEND PROJECT
│
├── 📁 config/
│   └── 📄 db.js                  # MongoDB connection with runtime error listeners
│
├── 📁 controllers/
│   └── 📄 userController.js      # bulkCreateUsers & bulkUpdateUsers logic
│
├── 📁 db_backup/
│   └── 📁 bulk_user_db/
│       ├── 📄 prelude.json        # mongodump metadata
│       ├── 📄 users.bson          # BSON export (binary)
│       └── 📄 users.metadata.json # Collection metadata
│
├── 📁 middleware/
│   └── 📄 errorHandler.js        # 404 handler + global error handler
│
├── 📁 models/
│   └── 📄 User.js                # Mongoose schema with indexes & validators
│
├── 📁 routes/
│   └── 📄 userRoutes.js          # Route definitions (validator → controller)
│
├── 📁 scripts/
│   └── 📄 seed.js                # Seeds 5,000 users in batches of 1,000
│
├── 📁 validators/
│   └── 📄 userValidators.js      # Request-level validation middleware
│
├── ⚙️  .env                       # Local environment variables (git-ignored)
├── ⚙️  .env.example               # Template for environment variables
├── 🚫 .gitignore
├── 🟨 app.js                     # Express app setup (middleware, routes)
├── 📬 Bulk_User_Management.postman_collection.json
├── 🔒 package-lock.json
├── 📦 package.json
├── 📖 README.md
├── 🟨 server.js                  # Entry point — connects DB then starts server
└── 📄 users.json                 # mongoexport JSON dump of users collection
```

---

## ⚙️ Tech Stack

| Layer | Technology | Version |
|---|---|---|
| 🟨 Runtime | Node.js | ≥ 18.0.0 |
| 🚂 Framework | Express | ^5.2.1 |
| 🍃 Database | MongoDB + Mongoose | ^9.4.1 |
| 🛡️ Security | Helmet, CORS | Latest |
| 🚦 Rate Limiting | express-rate-limit | ^8.3.2 |
| 📝 Logging | Morgan | ^1.10.1 |
| 🔁 Dev Server | Nodemon | ^3.1.14 |
| 🔑 Env Config | dotenv | ^17.4.2 |

---

## 🛠️ Setup & Installation

### Prerequisites

- **Node.js** `>= 18.0.0` (required for native `fetch` in seed script)
- **MongoDB** running locally (`mongodb://localhost:27017`) or a cloud URI (MongoDB Atlas)

### Steps

```bash
# 1️⃣  Clone the repository
git clone <your-repo-url>
cd bulk-user-management

# 2️⃣  Install dependencies
npm install

# 3️⃣  Copy the environment template and fill in your values
cp .env.example .env

# 4️⃣  Start the development server (with hot reload)
npm run dev

# 4️⃣  OR start the production server
npm start
```

> 🟢 Server starts on **http://localhost:5000** by default.
> Health check: `GET http://localhost:5000/health`

---

## 🔑 Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```env
# MongoDB connection string
MONGO_URI=mongodb://localhost:27017/bulk_user_db

# Server port (optional, defaults to 5000)
PORT=5000

# Environment (development | production)
NODE_ENV=development
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URI` | ✅ Yes | — | Full MongoDB connection string |
| `PORT` | ❌ No | `5000` | HTTP port to listen on |
| `NODE_ENV` | ❌ No | `development` | Controls morgan log format & stack traces |

> ⚠️ The server **exits immediately** (`process.exit(1)`) if `MONGO_URI` is missing.

---

## 🌱 Seeding the Database

The seed script generates **5,000 unique, realistic Indian user profiles** and loads them into the database via the API in **5 batches of 1,000**.

```bash
# Make sure the server is running first!
npm run seed
```

### What the seed script generates per user:

| Field | Example |
|---|---|
| `fullName` | `Ananya Sharma` |
| `email` | `ananya.sharma42@gmail.com` (index-suffixed for uniqueness) |
| `phone` | `9000000042` (10-digit, index-based) |
| `walletBalance` | `4823.71` (random, 0–10,000) |
| `isBlocked` | `false` (~95%) / `true` (~5%) |
| `kycStatus` | Random: `Pending` / `Approved` / `Rejected` |
| `deviceInfo` | Random IP, `Mobile`/`Desktop`, `Android`/`iOS`/`Windows`/`macOS` |

### Expected output:
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
  ...

═══════════════════════════════════════════════
   Seed Complete
   ✅ Inserted : 5000
   ❌ Failed   : 0
   ⏱  Time     : 2.41s
═══════════════════════════════════════════════
```

---

## 📡 API Reference

### Base URL
```
http://localhost:5000/api/users
```

---

### 📥 `POST /bulk-create`

Bulk-inserts an array of new users using `insertMany()` with `ordered: false`.

**Request Body** — `application/json` array of user objects:

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

**Response Codes:**

| Status | Meaning |
|---|---|
| `201 Created` | All users inserted successfully |
| `207 Multi-Status` | Partial insert — some records failed (e.g. duplicates) |
| `400 Bad Request` | Empty array or missing body |
| `413 Payload Too Large` | Body exceeds 50 MB limit |
| `422 Unprocessable Entity` | Validation errors (with per-record details) |
| `429 Too Many Requests` | Rate limit exceeded |

**201 Response:**
```json
{
  "message": "Bulk create completed.",
  "inserted": 3,
  "total": 3
}
```

**207 Response (partial duplicate):**
```json
{
  "message": "Bulk create partially completed.",
  "inserted": 1,
  "failed": 1,
  "duplicates": [
    { "index": 1, "message": " email: \"aditya.sharma@gmail.com\"" }
  ]
}
```

**422 Response (validation failure):**
```json
{
  "message": "Validation failed. Fix the errors before retrying.",
  "errorCount": 3,
  "errors": [
    "[0] fullName must be at least 3 characters.",
    "[0] email \"not-an-email\" is not a valid email format.",
    "[1] phone \"abc\" must be a numeric string of 10–15 digits."
  ]
}
```

---

### ✏️ `PUT /bulk-update`

Bulk-updates existing users by email using MongoDB `bulkWrite()`. Supports partial field updates with automatic `updatedAt` refresh.

**Request Body** — `application/json` array; `email` is the **required identifier**:

```json
[
  {
    "email": "aditya.sharma@gmail.com",
    "kycStatus": "Rejected",
    "walletBalance": 0
  },
  {
    "email": "priya.verma@yahoo.com",
    "isBlocked": true,
    "deviceInfo": {
      "deviceType": "Desktop",
      "os": "macOS"
    }
  }
]
```

> ⚡ Nested `deviceInfo` fields are updated **individually** (using dot-notation `$set`) — updating `deviceInfo.os` will NOT wipe `deviceInfo.ipAddress`.

**Response Codes:**

| Status | Meaning |
|---|---|
| `200 OK` | All users found and updated |
| `207 Multi-Status` | Some emails not found in DB |
| `400 Bad Request` | Empty array |
| `422 Unprocessable Entity` | Validation errors |

**200 Response:**
```json
{
  "message": "Bulk update completed.",
  "matched": 3,
  "modified": 3,
  "total": 3
}
```

**207 Response (partial not found):**
```json
{
  "message": "Bulk update partially completed. Some emails were not found.",
  "matched": 1,
  "modified": 1,
  "notFound": 1,
  "notFoundEmails": ["doesnotexist@nowhere.com"],
  "total": 2
}
```

---

### 🏥 `GET /health`

```json
{ "status": "ok", "uptime": 142.83 }
```

---

## 🗄️ Database Schema

Collection: `users`

```
┌──────────────────────────────────────────────────────────────┐
│                         USER DOCUMENT                        │
├─────────────────┬──────────────┬───────────────────────────── ┤
│ Field           │ Type         │ Rules                        │
├─────────────────┼──────────────┼──────────────────────────────┤
│ fullName        │ String       │ Required, trim, 3–100 chars  │
│ email           │ String       │ Required, unique, lowercase  │
│ phone           │ String       │ Required, unique, 10–15 digits│
│ walletBalance   │ Number       │ Default: 0, min: 0           │
│ isBlocked       │ Boolean      │ Default: false               │
│ kycStatus       │ String (Enum)│ Pending|Approved|Rejected    │
│ deviceInfo      │ Object       │ Optional sub-document        │
│   .ipAddress    │ String       │ Optional                     │
│   .deviceType   │ String (Enum)│ Mobile|Desktop               │
│   .os           │ String (Enum)│ Android|iOS|Windows|macOS   │
│ createdAt       │ Date         │ Auto (timestamps: true)      │
│ updatedAt       │ Date         │ Auto (timestamps: true)      │
└─────────────────┴──────────────┴──────────────────────────────┘
```

---

## 📈 Indexes & Performance

```javascript
// Run in mongo shell to verify:
db.users.getIndexes()
```

| Index | Fields | Type | Purpose |
|---|---|---|---|
| `_id_` | `_id` | Default | Primary key |
| `email_1` | `email` | Unique | Fast lookup by email; enforces no duplicates |
| `phone_1` | `phone` | Unique | Fast lookup by phone; enforces no duplicates |
| `kycStatus_1_isBlocked_1` | `kycStatus`, `isBlocked` | Compound (Bonus) | Optimises admin queries filtering by KYC status AND block state simultaneously |

### 💡 Why the compound index?

A fintech admin dashboard typically filters: *"Show me all **Pending** users who are **not blocked**"* or *"Show all **Rejected** + **blocked** users for review."* A compound index on `{ kycStatus: 1, isBlocked: 1 }` serves both field combinations in a single index scan — far more efficient than two separate single-field indexes.

### 🔥 Bulk operation strategy for performance

- `insertMany()` with `ordered: false` → MongoDB continues inserting remaining docs even if one fails (no full rollback)
- `bulkWrite()` with `ordered: false` → All `updateOne` ops are sent together in a single network round-trip
- `flattenFields()` in controller → Converts `{ deviceInfo: { os: "iOS" } }` to `{ "deviceInfo.os": "iOS" }` for surgical `$set` updates (no accidental field deletion)
- `lean()` on the pre-flight `User.find()` → Returns plain JS objects instead of Mongoose documents, reducing memory overhead on large ID lists

---

## 💾 Database Export

### BSON Export (`mongodump`)

```bash
mongodump --uri="mongodb://localhost:27017/bulk_user_db" \
          --out=db_backup
```

Output: `db_backup/bulk_user_db/users.bson` + `users.metadata.json`

### JSON Export (`mongoexport`)

```bash
mongoexport --uri="mongodb://localhost:27017/bulk_user_db" \
            --collection=users \
            --out=users.json \
            --pretty
```

Output: `users.json` (one document per line, or pretty-printed with `--pretty`)

### Restore from BSON backup

```bash
mongorestore --uri="mongodb://localhost:27017/bulk_user_db" \
             db_backup/
```

> 📁 Both export files are included in this repository: `db_backup/bulk_user_db/` and `users.json`.

---

## 📬 Postman Collection

Import `Bulk_User_Management.postman_collection.json` into Postman.

Set the collection variable:
```
base_url = http://localhost:5000
```

### Included requests:

**Bulk Create Users**
| # | Name | Expected |
|---|---|---|
| ✅ | 3 Valid Users | `201` — all inserted |
| ⚠️ | Partial Failure (1 duplicate email) | `207` — 1 inserted, 1 failed |
| ❌ | Validation Failure (missing/bad fields) | `422` — error list |
| ❌ | Empty Array | `400` |
| ❌ | Invalid JSON | `400` |

**Bulk Update Users**
| # | Name | Expected |
|---|---|---|
| ✅ | Update kycStatus & walletBalance | `200` |
| ✅ | Update deviceInfo (nested fields) | `200` |
| ⚠️ | Partial (1 email not found) | `207` |
| ❌ | No fields to update | `422` |
| ❌ | Invalid kycStatus enum | `422` |
| ❌ | Empty Array | `400` |

**Edge Cases**
| # | Name | Expected |
|---|---|---|
| ❌ | Unknown route | `404` |

---

## 🔐 Security

| Measure | Implementation |
|---|---|
| 🪖 **Security Headers** | `helmet()` — sets 11 HTTP security headers |
| 🌐 **CORS** | `cors()` — configurable cross-origin policy |
| 🚦 **Rate Limiting** | 30 requests / minute per IP on all `/api/*` routes |
| 📏 **Payload Cap** | `express.json({ limit: "50mb" })` — rejects oversized bodies |
| 🔢 **Batch Size Cap** | Hard limit of 10,000 records per request in validator |
| 🛡️ **Prototype Pollution Guard** | `flattenFields()` strips `__proto__`, `constructor`, `prototype` keys |
| 🔍 **Input Sanitization** | Email normalised to lowercase; no raw user input reaches DB without validation |


---

## 👨‍💻 Author

**Aditya** — Backend Developer Assignment
> Built with ❤️ using Node.js, Express 5, and MongoDB











