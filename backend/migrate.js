// ============================================================
//  AttendUCC — Database Migration
//  backend/migrate.js
//  Run once: node migrate.js
// ============================================================

const { db, initDatabase } = require("./database");

async function migrate() {
  console.log("Running database migrations...");

  const migrations = [
    // Add last_active to users for inactivity tracking
    `ALTER TABLE users ADD COLUMN last_active TEXT`,

    // Add lecturer GPS columns to sessions
    `ALTER TABLE sessions ADD COLUMN lecturer_lat REAL`,
    `ALTER TABLE sessions ADD COLUMN lecturer_lng REAL`,

    // Add hall GPS columns to sessions
    `ALTER TABLE sessions ADD COLUMN hall_lat    REAL`,
    `ALTER TABLE sessions ADD COLUMN hall_lng    REAL`,
    `ALTER TABLE sessions ADD COLUMN hall_radius INTEGER DEFAULT 100`,
  ];

  for (const sql of migrations) {
    try {
      await db.execute({ sql, args: [] });
      console.log(`✅ ${sql.slice(0, 60)}...`);
    } catch (err) {
      // Column already exists — safe to ignore
      if (err.message.includes("duplicate column") || err.message.includes("already exists")) {
        console.log(`⏭  Already exists: ${sql.slice(0, 60)}...`);
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
