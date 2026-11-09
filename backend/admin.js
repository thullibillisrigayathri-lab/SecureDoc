

const express = require("express");
const db = require("./database");

const router = express.Router();

// Admin authentication and authorization
function requireAdmin(req, res, next) {
    if (!req.session?.userId) {
        return res.status(401).json({
            error: "Please login"
        });
    }

    const user = db.prepare(`
        SELECT u.id, u.email, u.status, r.name AS role
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
    `).get(req.session.userId);

    if (
        !user ||
        user.status !== "approved" ||
        user.role !== "admin"
    ) {
        return res.status(403).json({
            error: "Admin permission required"
        });
    }

    req.currentUser = user;
    next();
}

// View pending users
router.get("/pending-users", requireAdmin, (req, res) => {
    const users = db.prepare(`
        SELECT id, name, email, created_at
        FROM users
        WHERE status = 'pending'
        ORDER BY id DESC
    `).all();

    res.json({ pendingUsers: users });
});
// List approved employees and auditors
router.get("/approved-users", requireAdmin, (req, res) => {
    try {
        const users = db.prepare(`
            SELECT u.id, u.name, u.email, r.name AS role
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.status = 'approved'
              AND r.name IN ('employee', 'auditor')
            ORDER BY u.id DESC
        `).all();

        res.json({ users });
    } catch (error) {
        console.error("Approved users error:", error);
        res.status(500).json({ error: "Could not load approved users." });
    }
});

// Approve a pending user
router.post("/users/:id/approve", requireAdmin, (req, res) => {
    const userId = Number(req.params.id);
    const roleName = req.body.role || "employee";

    if (
        !Number.isSafeInteger(userId) ||
        userId < 1 ||
        !["employee", "auditor"].includes(roleName)
    ) {
        return res.status(400).json({
            error: "Invalid input"
        });
    }

    const role = db.prepare(
        "SELECT id FROM roles WHERE name = ?"
    ).get(roleName);

    if (!role) {
        return res.status(400).json({
            error: "Role not found"
        });
    }

    const result = db.prepare(`
        UPDATE users
        SET status = 'approved', role_id = ?
        WHERE id = ? AND status = 'pending'
    `).run(role.id, userId);

    if (result.changes !== 1) {
        return res.status(404).json({
            error: "Pending user not found"
        });
    }

    db.prepare(`
        INSERT INTO audit_logs
        (actor_email, action, resource, decision, reason)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        req.currentUser.email,
        "approve_user",
        `user:${userId}`,
        "allowed",
        `Assigned ${roleName} role`
    );

    res.json({
        message: "User approved successfully"
    });
});

// View recent audit logs - Admin only
router.get("/audit-logs", requireAdmin, (req, res) => {
    try {
        const logs = db.prepare(`
            SELECT
                id,
                actor_email,
                action,
                resource,
                decision,
                reason,
                created_at
            FROM audit_logs
            ORDER BY id DESC
            LIMIT 200
        `).all();

        res.json({ logs });

    } catch (error) {
        console.error("Audit logs error:", error.message);

        res.status(500).json({
            error: "Unable to retrieve audit logs"
        });
    }
});

module.exports = router;
