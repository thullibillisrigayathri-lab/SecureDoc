
const API = "/api/auth";
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const message = document.getElementById("message");

function showMessage(text, type) {
    message.textContent = text;
    message.className = "message show " + type;
}

function clearMessage() {
    message.textContent = "";
    message.className = "message";
}

loginTab.addEventListener("click", () => {
    loginForm.hidden = false;
    registerForm.hidden = true;
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
    clearMessage();
});

registerTab.addEventListener("click", () => {
    loginForm.hidden = true;
    registerForm.hidden = false;
    registerTab.classList.add("active");
    loginTab.classList.remove("active");
    clearMessage();
});

// Login
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
        const response = await fetch(`${API}/login`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(data.error || "Login failed.", "error");
            return;
        }

        showMessage("Login successful! Opening dashboard...", "success");

        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 700);

    } catch (error) {
        showMessage(
            "Cannot connect to SecureDoc server. Please check whether the backend is running.",
            "error"
        );
    }
});

// Registration
registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

    try {
        const response = await fetch(`${API}/register`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(data.error || "Registration failed.", "error");
            return;
        }

        showMessage(
            data.message || "Registration successful. Await admin approval.",
            "success"
        );

        registerForm.reset();

    } catch (error) {
        showMessage(
            "Cannot connect to SecureDoc server. Please check whether the backend is running.",
            "error"
        );
    }
});
