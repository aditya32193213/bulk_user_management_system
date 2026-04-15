// scripts/seed.js
// ─────────────────────────────────────────────────────────────────────────────
// Generates 5,000 unique users and POSTs them to the bulk-create endpoint.
// Run: node scripts/seed.js
// ─────────────────────────────────────────────────────────────────────────────
import "dotenv/config";
const PORT = process.env.PORT || 5000;
const API_URL = `http://localhost:${PORT}/api/users/bulk-create`;
const TOTAL_USERS = 5000;
const BATCH_SIZE = 1000; // send in batches of 1000 to avoid one giant request

// ── Data pools ────────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan",
  "Krishna", "Ishaan", "Ananya", "Diya", "Priya", "Riya", "Nisha", "Pooja",
  "Kavya", "Sneha", "Megha", "Tanvi", "Rohan", "Raj", "Nikhil", "Amit",
  "Rahul", "Vikram", "Suresh", "Ramesh", "Deepak", "Manoj", "Sakshi", "Simran",
  "Anjali", "Neha", "Shruti", "Divya", "Komal", "Poonam", "Rekha", "Sunita",
];

const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Singh", "Kumar", "Patel", "Shah", "Mehta",
  "Joshi", "Nair", "Reddy", "Rao", "Iyer", "Pillai", "Menon", "Chatterjee",
  "Banerjee", "Das", "Bose", "Sen", "Mishra", "Tiwari", "Pandey", "Dubey",
  "Yadav", "Malhotra", "Kapoor", "Chopra", "Bhatia", "Arora",
];

const DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "rediffmail.com", "protonmail.com", "icloud.com",
];

const KYC_STATUSES = ["Pending", "Approved", "Rejected"];
const DEVICE_TYPES = ["Mobile", "Desktop"];
const OS_LIST = ["Android", "iOS", "Windows", "macOS"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateIP = () =>
  `${randInt(1, 255)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;

// Generates a 10-digit numeric phone string, guaranteed unique via index suffix
const generatePhone = (index) => {
  const base = 9000000000 + index;
  return String(base);
};

// ── User factory ──────────────────────────────────────────────────────────────
const generateUser = (index) => {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const domain = pick(DOMAINS);

  // Append index to guarantee email uniqueness across all 5000 records
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${domain}`;

  return {
    fullName: `${firstName} ${lastName}`,
    email,
    phone: generatePhone(index),
    walletBalance: parseFloat((Math.random() * 10000).toFixed(2)),
    isBlocked: Math.random() < 0.05, // ~5% blocked
    kycStatus: pick(KYC_STATUSES),
    deviceInfo: {
      ipAddress: generateIP(),
      deviceType: pick(DEVICE_TYPES),
      os: pick(OS_LIST),
    },
  };
};

// ── Generate all users ────────────────────────────────────────────────────────
const generateAllUsers = (total) => {
  console.log(`\n📦 Generating ${total} users...`);
  const users = [];
  for (let i = 0; i < total; i++) {
    users.push(generateUser(i));
  }
  console.log(`✅ Generated ${users.length} users.\n`);
  return users;
};

// ── Split into batches ────────────────────────────────────────────────────────
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

// ── Send a single batch ───────────────────────────────────────────────────────
const sendBatch = async (batch, batchNumber) => {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });

    const data = await res.json();
    console.log(`  Batch ${batchNumber}: HTTP ${res.status}`);

    if (res.status === 201) {
  const inserted = data.inserted ?? data.insertedCount ?? data.count ?? batch.length;
  console.log(`  ✅ Inserted: ${inserted} / ${data.total ?? batch.length}`);
} else if (res.status === 207) {
  const inserted = data.inserted ?? data.insertedCount ?? data.count ?? 0;
  const failed = data.failed ?? data.failedCount ?? (batch.length - inserted);
  console.log(`  ⚠️  Partial: Inserted ${inserted}, Failed ${failed}`);
  if (data.duplicates?.length) {
    console.log(`     Duplicates: ${data.duplicates.length} records`);
  }
} else {
      console.log(`  ❌ Error:`, data.message);
    }

    return data;
  } catch (err) {
    console.error(`  ❌ Batch ${batchNumber} network/parse error: ${err.message}`);
    return { inserted: 0, failed: batch.length };
  }
};

// ── Main ──────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log("═══════════════════════════════════════════════");
  console.log("   Bulk User Seed Script");
  console.log(`   Target : ${API_URL}`);
  console.log(`   Records: ${TOTAL_USERS}`);
  console.log(`   Batches: ${Math.ceil(TOTAL_USERS / BATCH_SIZE)} × ${BATCH_SIZE}`);
  console.log("═══════════════════════════════════════════════");

  const users = generateAllUsers(TOTAL_USERS);
  const batches = chunkArray(users, BATCH_SIZE);

  let totalInserted = 0;
  let totalFailed = 0;

  console.log("🚀 Sending batches...\n");

  const start = Date.now();

 for (let i = 0; i < batches.length; i++) {
  const batch = batches[i];
  const result = await sendBatch(batch, i + 1);
  
  // Use the same fallback logic as the per‑batch logging
  const inserted = result.inserted ?? result.insertedCount ?? result.count ?? batch.length;
  const failed = result.failed ?? result.failedCount ?? (batch.length - inserted);
  
  totalInserted += inserted;
  totalFailed += failed;
}

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log("\n═══════════════════════════════════════════════");
  console.log("   Seed Complete");
  console.log(`   ✅ Inserted : ${totalInserted}`);
  console.log(`   ❌ Failed   : ${totalFailed}`);
  console.log(`   ⏱  Time     : ${elapsed}s`);
  console.log("═══════════════════════════════════════════════\n");
};

main().catch((err) => {
  console.error("❌ Seed script crashed:", err.message);
  process.exit(1);
});