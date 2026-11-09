
const express = require("express");
const session = require("express-session");
const crypto = require("node:crypto");
const path = require("node:path");

const db = require("./database");
const authRoutes = require("./auth");
const adminRoutes = require("./admin");
const documentsRoutes = require("./documents");

const app = express();
if (isProduction) {
    app.set("trust proxy", 1);
}

console.log("SECUREDOC UPDATED SERVER FILE LOADED");

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

// Session configuration
const isProduction = process.env.NODE_ENV === "production";

const sessionSecret =
    process.env.SESSION_SECRET ||
    (!isProduction ? crypto.randomBytes(32).toString("hex") : null);

if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be configured in production.");
}

app.use(session({
    name: "securedoc.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
        maxAge: 30 * 60 * 1000
    }
}));

// Serve SecureDoc frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Root route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Authentication debugging
app.use("/api/auth", (req, res, next) => {
    console.log("AUTH REQUEST:", req.method, req.originalUrl);
    next();
});

// Authentication test
app.get("/api/auth/test", (req, res) => {
    res.json({
        message: "Auth route mounting works!"
    });
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Admin routes
app.use("/api/admin", adminRoutes);

// Document request debugging
app.use("/api/documents", (req, res, next) => {
    console.log(
        "DOCUMENT REQUEST RECEIVED:",
        req.method,
        req.originalUrl
    );
    next();
});

// Secure document routes
app.use("/api/documents", documentsRoutes);

console.log("DOCUMENT ROUTES MOUNTED SUCCESSFULLY");

// Document test route
app.get("/api/documents/test", (req, res) => {
    console.log("DOCUMENT TEST ROUTE HIT");

    res.json({
        message: "Document route is working!"
    });
});

// Health check
app.get("/api/health", (req, res) => {
    try {
        const result = db.prepare("SELECT 1 AS ok").get();

        res.json({
            server: "Running",
            database: result.ok === 1 ? "Connected" : "Error"
        });
    } catch (error) {
        console.error("Health check error:", error);

        res.status(500).json({
            server: "Running",
            database: "Error"
        });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error("Server error:", err.message);

    if (err.name === "MulterError") {
        return res.status(400).json({
            error: "File upload error: " + err.message
        });
    }

    if (err.message === "Only PDF files are allowed.") {
        return res.status(400).json({
            error: err.message
        });
    }

    res.status(500).json({
        error: "Internal server error"
    });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`SecureDoc server running on port ${PORT}`);
});
