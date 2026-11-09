
const API = "/api/auth";
const DOC_API = "/api/documents";
const ADMIN_API = "/api/admin";

const userInfo = document.getElementById("userInfo");
const dashboardContent = document.getElementById("dashboardContent");
const logoutBtn = document.getElementById("logoutBtn");

const adminSection = document.getElementById("adminSection");
const documentsList = document.getElementById("documentsList");

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "include",
        ...options
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

// Load logged-in user
async function loadDashboard() {
    try {
        const data = await apiRequest(`${API}/me`);
        const user = data.user;

        userInfo.textContent = `${user.name} | ${user.email}`;

        const role = String(user.role || "employee").toLowerCase();

        dashboardContent.replaceChildren();

        const roleLine = document.createElement("p");
        roleLine.textContent = "Account role: " + role;

        const statusLine = document.createElement("p");
        statusLine.textContent = "Account status: " + user.status;

        const infoLine = document.createElement("p");
        infoLine.textContent =
            "Document access is controlled by server-side permissions.";

        dashboardContent.append(roleLine, statusLine, infoLine);

        if (role === "admin") {
            adminSection.hidden = false;
            await loadPendingUsers();
            await loadAuditLogs();
        }

        await loadDocuments();

    } catch (error) {
        userInfo.textContent = error.message;
        window.location.href = "index.html";
    }
}

// Load accessible documents
async function loadDocuments() {
    documentsList.textContent = "Loading documents...";

    try {
        const data = await apiRequest(DOC_API);

        documentsList.replaceChildren();

        if (!data.documents.length) {
            documentsList.textContent = "No accessible documents found.";
            return;
        }

        data.documents.forEach(doc => {
            const card = document.createElement("div");
            card.className = "security-note";

            const title = document.createElement("h3");
            title.textContent = doc.original_name;

            const id = document.createElement("p");
            id.textContent = "Document ID: " + doc.id;

            const date = document.createElement("p");
            date.textContent = "Uploaded: " + doc.created_at;

            card.append(title, id, date);

            if (doc.can_read) {
                const readBtn = document.createElement("button");
                readBtn.textContent = "Read PDF";
                readBtn.className = "primary-btn";

                readBtn.addEventListener("click", () => {
                    window.open(
                        `${DOC_API}/${doc.id}/read`,
                        "_blank",
                        "noopener"
                    );
                });

                card.append(readBtn);
            }

            if (doc.can_download) {
                const downloadBtn = document.createElement("button");
                downloadBtn.textContent = "Download PDF";
                downloadBtn.className = "primary-btn";

                downloadBtn.addEventListener("click", async () => {
                    try {
                        const response = await fetch(
                            `${DOC_API}/${doc.id}/download`,
                            { credentials: "include" }
                        );

                        if (!response.ok) {
                            throw new Error("Download not permitted");
                        }

                        const blob = await response.blob();
                        const objectUrl = URL.createObjectURL(blob);

                        const link = document.createElement("a");
                        link.href = objectUrl;
                        link.download = doc.original_name;
                        link.click();

                        URL.revokeObjectURL(objectUrl);

                    } catch (error) {
                        alert(error.message);
                    }
                });

                card.append(downloadBtn);
            }

            documentsList.append(card);
        });

    } catch (error) {
        documentsList.textContent = error.message;
    }
}

// Admin: Upload PDF
document.getElementById("uploadForm").addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        const fileInput = document.getElementById("documentFile");
        const message = document.getElementById("uploadMessage");

        if (!fileInput.files.length) {
            message.textContent = "Select a PDF file.";
            return;
        }

        const formData = new FormData();
        formData.append("document", fileInput.files[0]);

        try {
            const response = await fetch(`${DOC_API}/upload`, {
                method: "POST",
                credentials: "include",
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Upload failed");
            }

            message.textContent =
                "Upload successful. Document ID: " + data.documentId;

            fileInput.value = "";
            await loadDocuments();

        } catch (error) {
            message.textContent = error.message;
        }
    }
);

// Admin: Load pending users
async function loadPendingUsers() {
    const container = document.getElementById("pendingUsers");

    try {
        const data = await apiRequest(`${ADMIN_API}/pending-users`);
        container.replaceChildren();

        if (!data.pendingUsers.length) {
            container.textContent = "No pending users.";
            return;
        }

        data.pendingUsers.forEach(user => {
            const card = document.createElement("div");
            card.className = "security-note";

            const details = document.createElement("p");
            details.textContent =
                `${user.name} | ${user.email} | User ID: ${user.id}`;

            const roleSelect = document.createElement("select");

            ["employee", "auditor"].forEach(role => {
                const option = document.createElement("option");
                option.value = role;
                option.textContent = role;
                roleSelect.append(option);
            });

            const approveBtn = document.createElement("button");
            approveBtn.className = "primary-btn";
            approveBtn.textContent = "Approve User";

            approveBtn.addEventListener("click", async () => {
                try {
                    await apiRequest(
                        `${ADMIN_API}/users/${user.id}/approve`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                role: roleSelect.value
                            })
                        }
                    );

                    await loadPendingUsers();
                    alert("User approved successfully.");

                } catch (error) {
                    alert(error.message);
                }
            });

            card.append(details, roleSelect, approveBtn);
            container.append(card);
        });

    } catch (error) {
        container.textContent = error.message;
    }
}

// Admin: Grant document permissions
document.getElementById("permissionForm").addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        const message = document.getElementById("permissionMessage");

        const documentId = document.getElementById(
            "permissionDocumentId"
        ).value;

        const userId = document.getElementById(
            "permissionUserId"
        ).value;

        const permission = document.getElementById(
            "permissionType"
        ).value;

        try {
            const data = await apiRequest(
                `${DOC_API}/${documentId}/permissions`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        userId: Number(userId),
                        permission
                    })
                }
            );

            message.textContent = data.message;
            await loadDocuments();

        } catch (error) {
            message.textContent = error.message;
        }
    }
);

// Admin: Load audit logs
async function loadAuditLogs() {
    const container = document.getElementById("auditLogs");

    try {
        const data = await apiRequest(`${ADMIN_API}/audit-logs`);
        container.replaceChildren();

        if (!data.logs.length) {
            container.textContent = "No audit records found.";
            return;
        }

        data.logs.forEach(log => {
            const item = document.createElement("div");
            item.className = "security-note";

            const details = document.createElement("p");
            details.textContent =
                `#${log.id} | ${log.actor_email} | ${log.action}`;

            const resource = document.createElement("p");
            resource.textContent = "Resource: " + log.resource;

            const decision = document.createElement("p");
            decision.textContent =
                `Decision: ${log.decision} | Reason: ${log.reason}`;

            const date = document.createElement("p");
            date.textContent = "Time: " + log.created_at;

            item.append(details, resource, decision, date);
            container.append(item);
        });

    } catch (error) {
        container.textContent = error.message;
    }
}

// Logout
logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;

    try {
        await apiRequest(`${API}/logout`, {
            method: "POST"
        });

        window.location.href = "index.html";

    } catch (error) {
        alert(error.message);
        logoutBtn.disabled = false;
    }
});

loadDashboard();
