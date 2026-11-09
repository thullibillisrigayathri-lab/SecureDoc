const bcrypt = require("bcryptjs");
const db = require("./database");

async function main() {
    const name = (process.env.ADMIN_NAME || "").trim();
    const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "";

    if (!name || !email || password.length < 12 ||
        Buffer.byteLength(password, "utf8") > 72) {
        throw new Error("Admin details are missing or invalid.");
    }

    const role = db.prepare(
        "SELECT id FROM roles WHERE name = 'admin'"
    ).get();

    if (!role) throw new Error("Admin role not found.");

    const existing = db.prepare(`
        SELECT u.id FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.name = 'admin'
    `).get();

    if (existing) throw new Error("Admin already exists.");

    const hash = await bcrypt.hash(password, 12);

    db.prepare(`
        INSERT INTO users
        (name, email, password_hash, status, role_id)
        VALUES (?, ?, ?, 'approved', ?)
    `).run(name, email, hash, role.id);

    db.prepare(`
        INSERT INTO audit_logs
        (actor_email, action, resource, decision, reason)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        email, "admin_bootstrap", "admin_account",
        "allowed", "Initial administrator created."
    );

    console.log("Initial Admin account created successfully!");
}

main()
    .catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => db.close());