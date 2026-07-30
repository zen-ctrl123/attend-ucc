// ============================================================
//  AttendUCC — Account Deactivation Job
//  backend/deactivateJob.js
//  Automatically deactivates accounts inactive for 1 year
// ============================================================

const { db } = require("./database");

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function deactivateInactiveAccounts() {
  try {
    const cutoff = new Date(Date.now() - ONE_YEAR_MS).toISOString();

    // Find accounts inactive for more than 1 year
    const result = await db.execute({
      sql: `SELECT id, name, email, role FROM users
            WHERE (last_active < ? OR last_active IS NULL)
            AND active = 1
            AND created_at < ?`,
      args: [cutoff, cutoff],
    });

    if (result.rows.length === 0) {
      console.log("✅ Deactivation job: no inactive accounts found.");
      return;
    }

    // Deactivate each account
    for (const user of result.rows) {
      await db.execute({
        sql: "UPDATE users SET active = 0 WHERE id = ?",
        args: [user.id],
      });
      console.log(`⚠️  Deactivated account: ${user.name} (${user.email}) — inactive for over 1 year`);
    }

    console.log(`✅ Deactivation job: deactivated ${result.rows.length} account(s).`);
  } catch (err) {
    console.error("❌ Deactivation job error:", err.message);
  }
}

// Run once immediately when loaded, then every 24 hours
deactivateInactiveAccounts();
setInterval(deactivateInactiveAccounts, 24 * 60 * 60 * 1000);

module.exports = { deactivateInactiveAccounts };