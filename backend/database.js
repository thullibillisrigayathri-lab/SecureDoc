const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Configurable persistent data directory
const DATA_DIR =
    process.env.SECUREDOC_DATA_DIR ||
    path.join(__dirname, "..");

// Create database folder
const folder = path.join(DATA_DIR, "database");
fs.mkdirSync(folder, { recursive: true });

// Connect to database
const db = new Database(
    path.join(folder, "securedoc.sqlite")
);

db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role_id INTEGER REFERENCES roles(id),
        status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending', 'approved', 'suspended')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        permission_key TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER REFERENCES roles(id),
        permission_id INTEGER REFERENCES permissions(id),
        PRIMARY KEY(role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_name TEXT NOT NULL,
        stored_name TEXT UNIQUE NOT NULL,
        uploaded_by INTEGER REFERENCES users(id),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS document_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER REFERENCES documents(id),
        user_id INTEGER REFERENCES users(id),
        permission TEXT NOT NULL
            CHECK(permission IN ('read', 'download')),
        granted_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_email TEXT NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        decision TEXT NOT NULL
            CHECK(decision IN ('allowed', 'denied', 'info')),
        reason TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
`);

// Create default roles
const addRole = db.prepare(
    "INSERT OR IGNORE INTO roles (name) VALUES (?)"
);

["admin", "employee", "auditor"].forEach(role => {
    addRole.run(role);
});

console.log("SecureDoc database created successfully!");
module.exports = db;