const express = require("express");
const db = require("./database");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

// Check server and database connection
app.get("/api/health", (req, res) => {
    try {
        const result = db.prepare("SELECT 1 AS ok").get();

        res.json({
            server: "Running",
            database: result.ok === 1 ? "Connected" : "Error"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Database connection failed"
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "127.0.0.1", () => {
    console.log(`SecureDoc server running at http://localhost:${PORT}`);
});