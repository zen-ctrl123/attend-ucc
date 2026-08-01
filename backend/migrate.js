// ============================================================
//  AttendUCC — Migration: Add active column + deactivation support
//  backend/migrate.js
//  Run: node migrate.js
// ============================================================

const { db, initDatabase } = require("./database");

async function migrate() {
  console.log("Running database migrations...");

  const migrations = [
    // Core columns
    `ALTER TABLE users ADD COLUMN last_active  TEXT`,
    `ALTER TABLE users ADD COLUMN reset_token  TEXT`,
    `ALTER TABLE users ADD COLUMN reset_expiry TEXT`,
    // Active flag — 1 = active, 0 = deactivated
    `ALTER TABLE users ADD COLUMN active       INTEGER DEFAULT 1`,
    // Session GPS columns
    `ALTER TABLE sessions ADD COLUMN lecturer_lat  REAL`,
    `ALTER TABLE sessions ADD COLUMN lecturer_lng  REAL`,
    `ALTER TABLE sessions ADD COLUMN hall_lat      REAL`,
    `ALTER TABLE sessions ADD COLUMN hall_lng      REAL`,
    `ALTER TABLE sessions ADD COLUMN hall_radius   INTEGER DEFAULT 100`,
    // Per-browser device ID — replaces the old IP-based anti-proxy check,
    // which false-positived on any two students sharing WiFi/campus network.
    `ALTER TABLE attendance_records ADD COLUMN device_id TEXT`,
  ];

  for (const sql of migrations) {
    try {
      await db.execute({ sql, args: [] });
      console.log(`✅ ${sql.slice(0, 70)}`);
    } catch (err) {
      if (err.message.includes("duplicate column") || err.message.includes("already exists")) {
        console.log(`⏭  Already exists: ${sql.slice(0, 50)}`);
      } else {
        console.error(`❌ Failed: ${sql}\n   ${err.message}`);
      }
    }
  }

  // Set all existing users to active = 1
  try {
    await db.execute({ sql: "UPDATE users SET active = 1 WHERE active IS NULL", args: [] });
    console.log("✅ Set all existing users to active");
  } catch (err) {
    console.log("⏭  active column update skipped:", err.message);
  }

  console.log("\nMigration complete.");
  process.exit(0);
}

initDatabase().then(migrate).catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
