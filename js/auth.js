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

// REGISTER
// Registration is handled directly by register.html.
// This function remains available for any older page using registerUser().
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
        return { error: new Error("Please fill in all required fields.") };
    }

    if (!/^[6-9]\d{9}$/.test(mobile)) {
        return { error: new Error("Enter a valid 10-digit Indian mobile number.") };
    }

    if (password.length < 8) {
        return { error: new Error("Password must be at least 8 characters.") };
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
        return { error: new Error("Passwords do not match.") };
    }

    const client = window.supabaseClient;

    if (!client) {
        return {
            error: new Error("Supabase connection missing. Check js/supabase.js.")
        };
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

        if (!data.session) {
            return {
                error: new Error(
                    "Account created, but no active session was returned. " +
                    "Check Supabase Email Confirmations settings."
                )
            };
        }

        return data;
    } catch (error) {
        console.error("Registration error:", error);
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

window.registerUser = registerUser;
window.loginUser = loginUser;