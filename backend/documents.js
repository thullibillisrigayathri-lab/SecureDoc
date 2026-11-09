
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./database");

const router = express.Router();

const DATA_DIR =
    process.env.SECUREDOC_DATA_DIR ||
    path.join(__dirname, "..");

const STORAGE_DIR = path.join(
    DATA_DIR,
    "storage",
    "private-documents"
);fs.mkdirSync(STORAGE_DIR, { recursive: true });

// PDF upload configuration
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
            return cb(new Error("Only PDF files are allowed."));
        }
        cb(null, true);
    }
});

// Audit logging
function audit(email, action, resource, decision, reason) {
    db.prepare(`
        INSERT INTO audit_logs
        (actor_email, action, resource, decision, reason)
        VALUES (?, ?, ?, ?, ?)
    `).run(email, action, resource, decision, reason);
}

// Authentication and approval check
function requireUser(req, res, next) {
    if (!req.session?.userId) {
        audit(
            "anonymous",
            "document_access",
            "unknown",
            "denied",
            "No active login session"
        );

        return res.status(401).json({
            error: "Please login"
        });
    }

    const user = db.prepare(`
        SELECT u.id, u.name, u.email, u.status,
               r.name AS role
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
    `).get(req.session.userId);

    if (!user || user.status !== "approved") {
        audit(
            "unknown",
            "document_access",
            "unknown",
            "denied",
            "User not approved or account unavailable"
        );

        return res.status(403).json({
            error: "Approved account required"
        });
    }

    req.currentUser = user;
    next();
}

// Admin authorization
function requireAdmin(req, res, next) {
    if (req.currentUser.role !== "admin") {
        audit(
            req.currentUser.email,
            "admin_action",
            "documents",
            "denied",
            "Admin permission required"
        );

        return res.status(403).json({
            error: "Admin permission required"
        });
    }

    next();
}
// List documents based on the logged-in user's permissions
router.get("/", requireUser, (req, res) => {
    try {
        const isAdmin = req.currentUser.role === "admin";

        let documents;

        if (isAdmin) {
            documents = db.prepare(`
                SELECT
                    d.id,
                    d.original_name,
                    d.created_at,
                    1 AS can_read,
                    1 AS can_download
                FROM documents d
                ORDER BY d.created_at DESC
            `).all();
        } else {
            documents = db.prepare(`
                SELECT
                    d.id,
                    d.original_name,
                    d.created_at,
                    MAX(CASE WHEN p.permission = 'read'
                        THEN 1 ELSE 0 END) AS can_read,
                    MAX(CASE WHEN p.permission = 'download'
                        THEN 1 ELSE 0 END) AS can_download
                FROM documents d
                JOIN document_permissions p
                    ON p.document_id = d.id
                   AND p.user_id = ?
                WHERE p.permission IN ('read', 'download')
                GROUP BY d.id
                ORDER BY d.created_at DESC
            `).all(req.currentUser.id);
        }

        audit(
            req.currentUser.email,
            "list_documents",
            "documents",
            "allowed",
            `Listed ${documents.length} accessible documents`
        );

        res.json({ documents });

    } catch (error) {
        console.error("Document list error:", error.message);
        res.status(500).json({
            error: "Unable to retrieve documents"
        });
    }
});
// Upload PDF - Admin only
router.post(
    "/upload",
    requireUser,
    requireAdmin,
    upload.single("document"),
    (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: "Please select a PDF file"
                });
            }

            // Check actual PDF signature
            if (
                req.file.buffer.subarray(0, 5).toString() !== "%PDF-"
            ) {
                return res.status(400).json({
                    error: "Invalid PDF file"
                });
            }

            const storedName = crypto.randomUUID() + ".pdf";

            const originalName = path.basename(req.file.originalname)
                .replace(/[\r\n]/g, "")
                .slice(0, 200);

            const filePath = path.join(STORAGE_DIR, storedName);

            fs.writeFileSync(filePath, req.file.buffer, {
                flag: "wx",
                mode: 0o600
            });

            try {
                const result = db.prepare(`
                    INSERT INTO documents
                    (original_name, stored_name, uploaded_by)
                    VALUES (?, ?, ?)
                `).run(
                    originalName,
                    storedName,
                    req.currentUser.id
                );

                audit(
                    req.currentUser.email,
                    "upload_document",
                    `document:${result.lastInsertRowid}`,
                    "allowed",
                    "Admin uploaded a PDF document"
                );

                return res.status(201).json({
                    message: "Document uploaded successfully",
                    documentId: result.lastInsertRowid
                });

            } catch (error) {
                fs.unlinkSync(filePath);
                throw error;
            }

        } catch (error) {
            console.error("Upload error:", error.message);

            return res.status(500).json({
                error: "Document upload failed"
            });
        }
    }
);

// Grant read/download permission - Admin only
router.post(
    "/:id/permissions",
    requireUser,
    requireAdmin,
    (req, res) => {
        const documentId = Number(req.params.id);
        const userId = Number(req.body.userId);
        const permission = req.body.permission;

        if (
            !Number.isSafeInteger(documentId) ||
            documentId < 1 ||
            !Number.isSafeInteger(userId) ||
            userId < 1 ||
            !["read", "download"].includes(permission)
        ) {
            return res.status(400).json({
                error: "Invalid permission details"
            });
        }

        const document = db.prepare(
            "SELECT id FROM documents WHERE id = ?"
        ).get(documentId);

        const targetUser = db.prepare(`
            SELECT id FROM users
            WHERE id = ? AND status = 'approved'
        `).get(userId);

        if (!document || !targetUser) {
            return res.status(404).json({
                error: "Document or approved user not found"
            });
        }

        const existing = db.prepare(`
            SELECT id FROM document_permissions
            WHERE document_id = ?
              AND user_id = ?
              AND permission = ?
        `).get(documentId, userId, permission);

        if (existing) {
            return res.status(409).json({
                error: "Permission already exists"
            });
        }

        db.prepare(`
            INSERT INTO document_permissions
            (document_id, user_id, permission, granted_by)
            VALUES (?, ?, ?, ?)
        `).run(
            documentId,
            userId,
            permission,
            req.currentUser.id
        );

        audit(
            req.currentUser.email,
            "grant_permission",
            `document:${documentId}`,
            "allowed",
            `Granted ${permission} permission to user:${userId}`
        );

        res.json({
            message: `${permission} permission granted successfully`
        });
    }
);

// Check document permission
function checkDocumentAccess(req, res, permission) {
    const documentId = Number(req.params.id);

    if (!Number.isSafeInteger(documentId) || documentId < 1) {
        audit(
            req.currentUser.email,
            "document_access",
            "invalid_document",
            "denied",
            "Invalid document ID"
        );

        res.status(400).json({
            error: "Invalid document ID"
        });

        return null;
    }

    const document = db.prepare(`
        SELECT id, original_name, stored_name, uploaded_by
        FROM documents
        WHERE id = ?
    `).get(documentId);

    if (!document) {
        audit(
            req.currentUser.email,
            permission,
            `document:${documentId}`,
            "denied",
            "Document not found"
        );

        res.status(404).json({
            error: "Document not found"
        });

        return null;
    }

    const isAdmin = req.currentUser.role === "admin";

    const granted = db.prepare(`
        SELECT id FROM document_permissions
        WHERE document_id = ?
          AND user_id = ?
          AND permission = ?
    `).get(
        documentId,
        req.currentUser.id,
        permission
    );

    if (!isAdmin && !granted) {
        audit(
            req.currentUser.email,
            permission,
            `document:${documentId}`,
            "denied",
            `Missing ${permission} permission`
        );

        res.status(403).json({
            error: "You do not have permission to access this document"
        });

        return null;
    }

    audit(
        req.currentUser.email,
        permission,
        `document:${documentId}`,
        "allowed",
        isAdmin
            ? "Admin access"
            : `${permission} permission verified`
    );

    return document;
}

// Read document
router.get("/:id/read", requireUser, (req, res) => {
    const document = checkDocumentAccess(req, res, "read");

    if (!document) return;

    const filePath = path.join(STORAGE_DIR, document.stored_name);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            error: "Stored file not found"
        });
    }

    res.type("application/pdf");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");

    res.sendFile(filePath);
});

// Download document
router.get("/:id/download", requireUser, (req, res) => {
    const document = checkDocumentAccess(req, res, "download");

    if (!document) return;

    const filePath = path.join(STORAGE_DIR, document.stored_name);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            error: "Stored file not found"
        });
    }

    res.download(filePath, document.original_name);
});

// Debug: confirm document routes are loaded
console.log(
    "DOCUMENT ROUTES LOADED:",
    router.stack.map(layer => layer.route?.path)
);

module.exports = router;
