
function showAuthMessage(message) {
    const el =
        document.getElementById("registerMessage") ||
        document.getElementById("message");

    if (el) {
        el.textContent = message;
    } else {
        alert(message);
    }
}

// REGISTER: Send signup verification code to email
async function registerUser(details = null) {
    const name = details?.name ??
        document.getElementById("name")?.value.trim();

    const mobile = details?.mobile ??
        document.getElementById("mobile")?.value.trim();

    const email = (details?.email ??
        document.getElementById("email")?.value.trim())?.toLowerCase();

    const password = details?.password ??
        document.getElementById("password")?.value;

    const confirmPassword =
        document.getElementById("confirmPassword")?.value;

    if (!name || !mobile || !email || !password) {
        const error = new Error("Please fill in all required fields.");
        showAuthMessage(error.message);
        return { error };
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
        const error = new Error("Enter a valid 10-digit Indian mobile number.");
        showAuthMessage(error.message);
        return { error };
    }

    if (password.length < 8) {
        const error = new Error("Password must be at least 8 characters.");
        showAuthMessage(error.message);
        return { error };
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
        const error = new Error("Passwords do not match.");
        showAuthMessage(error.message);
        return { error };
    }

    const client = window.supabaseClient;

    if (!client) {
        const error = new Error(
            "Supabase connection missing. Check js/supabase.js."
        );
        showAuthMessage(error.message);
        return { error };
    }

    try {
        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                    phone: mobile
                }
            }
        });

        if (error) throw error;

        // Do not bypass OTP verification if confirmation is required.
        if (data.session && data.user?.email_confirmed_at) {
            showAuthMessage("Account created successfully!");
            window.location.href = "index.html";
            return data;
        }

        // Supabase normally sends the signup confirmation code/link
        // when email confirmations are enabled.
        return data;

    } catch (error) {
        console.error("Registration error:", error);
        showAuthMessage(error.message || "Registration failed.");
        return { error };
    }
}

// LOGIN
async function loginUser() {
    const email = (
        document.getElementById("loginEmail")?.value ||
        document.getElementById("email")?.value ||
        ""
    ).trim().toLowerCase();

    const password =
        document.getElementById("loginPassword")?.value ??
        document.getElementById("password")?.value;

    if (!email || !password) {
        showAuthMessage("Please enter your email and password.");
        return;
    }

    const client = window.supabaseClient;

    if (!client) {
        showAuthMessage("Supabase connection missing. Check js/supabase.js.");
        return;
    }

    try {
        showAuthMessage("Logging in...");

        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        if (data.session) {
            showAuthMessage("Login successful!");
            window.location.href = "index.html";
        }

    } catch (error) {
        console.error("Login error:", error);
        showAuthMessage(error.message || "Login failed.");
    }
}
