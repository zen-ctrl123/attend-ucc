// ============================================================
//  AttendUCC — Database Migration
//  backend/migrate.js
//  Run once: node migrate.js
// ============================================================

const { db, initDatabase } = require("./database");

async function migrate() {
  console.log("Running database migrations...");

  const migrations = [
    `ALTER TABLE users ADD COLUMN last_active   TEXT`,
    `ALTER TABLE users ADD COLUMN reset_token   TEXT`,
    `ALTER TABLE users ADD COLUMN reset_expiry  TEXT`,
    `ALTER TABLE sessions ADD COLUMN lecturer_lat  REAL`,
    `ALTER TABLE sessions ADD COLUMN lecturer_lng  REAL`,
    `ALTER TABLE sessions ADD COLUMN hall_lat      REAL`,
    `ALTER TABLE sessions ADD COLUMN hall_lng      REAL`,
    `ALTER TABLE sessions ADD COLUMN hall_radius   INTEGER DEFAULT 100`,
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

  console.log("\nMigration complete.");
  process.exit(0);
}

initDatabase().then(migrate).catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
