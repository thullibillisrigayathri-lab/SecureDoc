
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("./database");

const router = express.Router();

function audit(email, action, decision, reason) {
    db.prepare(`
        INSERT INTO audit_logs
        (actor_email, action, resource, decision, reason)
        VALUES (?, ?, ?, ?, ?)
    `).run(email, action, "authentication", decision, reason);
}

// User Registration
router.post("/register", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (name.length < 2 || name.length > 80) {
            return res.status(400).json({
                error: "Name must contain 2 to 80 characters."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                error: "Enter a valid email address."
            });
        }

        if (password.length < 12 ||
            Buffer.byteLength(password, "utf8") > 72) {
            return res.status(400).json({
                error: "Password must be at least 12 characters."
            });
        }

        const existing = db.prepare(
            "SELECT id FROM users WHERE email = ?"
        ).get(email);

        if (existing) {
            return res.status(409).json({
                error: "Unable to create account with these details."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        db.prepare(`
            INSERT INTO users (name, email, password_hash)
            VALUES (?, ?, ?)
        `).run(name, email, passwordHash);

        audit(
            email,
            "user_registration",
            "info",
            "Registration submitted. Waiting for admin approval."
        );

        res.status(201).json({
            message: "Registration successful. Await admin approval."
        });

    } catch (error) {
        console.error("Registration error:", error.message);
        res.status(500).json({
            error: "Registration failed."
        });
    }
});

// User Login
router.post("/login", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        const user = db.prepare(`
            SELECT id, name, email, password_hash, status
            FROM users
            WHERE email = ?
        `).get(email);

        const validPassword = user
            ? await bcrypt.compare(password, user.password_hash)
            : false;

        if (!user || !validPassword) {
            audit(
                email || "unknown",
                "login",
                "denied",
                "Invalid login credentials."
            );

            return res.status(401).json({
                error: "Invalid email or password."
            });
        }

        if (user.status !== "approved") {
            audit(
                email,
                "login",
                "denied",
                "Account is not approved or is suspended."
            );

            return res.status(403).json({
                error: "Your account is awaiting approval or is suspended."
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                return res.status(500).json({
                    error: "Unable to create login session."
                });
            }

            req.session.userId = user.id;

            req.session.save((saveError) => {
                if (saveError) {
                    return res.status(500).json({
                        error: "Unable to save login session."
                    });
                }

                audit(
                    email,
                    "login",
                    "allowed",
                    "Approved user logged in successfully."
                );

                res.json({
                    message: "Login successful.",
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email
                    }
                });
            });
        });

    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({
            error: "Login failed."
        });
    }
});

// Check current login
router.get("/me", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            error: "Please log in."
        });
    }

    const user = db.prepare(`
        SELECT u.id, u.name, u.email, u.status, r.name AS role
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
    `).get(req.session.userId);

    if (!user || user.status !== "approved") {
        return res.status(403).json({
            error: "Account is not approved."
        });
    }

    res.json({ user });
});

// Logout
router.post("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                error: "Logout failed."
            });
        }

        res.clearCookie("securedoc.sid", {
            httpOnly: true,
            sameSite: "strict"
        });

        res.json({ message: "Logged out successfully." });
    });
});

module.exports = router;
