// ============================================================
//  AttendUCC — Notifications Migration
//  backend/migrateNotifications.js
//  Run once: node migrateNotifications.js
// ============================================================

const { db, initDatabase } = require("./database");

async function migrate() {
  console.log("Running notifications migration...");

  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS notifications (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        title      TEXT NOT NULL,
        message    TEXT NOT NULL,
        type       TEXT DEFAULT 'info',
        is_read    INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      args: [],
    });
    console.log("✅ notifications table created");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("⏭  notifications table already exists");
    } else {
      console.error("❌ Failed:", err.message);
    }
  }

  console.log("Migration complete.");
  process.exit(0);
}

initDatabase().then(migrate).catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
