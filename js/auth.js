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

        return data;
    } catch (error) {
        console.error("Registration error:", error);
        return { error };
    }
}

// APPLY REFERRAL AFTER LOGIN
async function applyPendingReferral(client) {
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("ref");

    // URL referral is preferred; signup metadata is fallback.
    const { data: userData, error: userError } =
        await client.auth.getUser();

    if (userError || !userData.user) return;

    const metadataCode =
        userData.user.user_metadata?.referral_code;

    const referralCode = (urlCode || metadataCode || "")
        .trim()
        .toUpperCase();

    if (!referralCode) return;

    const { data: profile, error: profileError } =
        await client
            .from("referral_profiles")
            .select("referred_by")
            .eq("user_id", userData.user.id)
            .maybeSingle();

    if (profileError) throw profileError;

    // Never overwrite an existing referral.
    if (profile?.referred_by) return;

    const { error } = await client.rpc("apply_referral_code", {
        p_code: referralCode
    });

    if (error) throw error;
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
            try {
                await applyPendingReferral(client);
            } catch (referralError) {
                console.error("Referral application error:", referralError);
                showAuthMessage(
                    "Login successful, but referral could not be applied: " +
                    referralError.message
                );
                return;
            }

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