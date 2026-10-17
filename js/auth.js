/* ANANTMART — Supabase Authentication */

function showAuthMessage(message) {
  const el = document.getElementById("message");
  if (el) {
    el.textContent = message;
  } else {
    alert(message);
  }
}

// REGISTER
async function registerUser() {
  const name = document.getElementById("name")?.value.trim();
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;

  if (!name || !email || !password) {
    showAuthMessage("Please fill all fields.");
    return;
  }

  if (password.length < 6) {
    showAuthMessage("Password must be at least 6 characters.");
    return;
  }

  const client = window.supabaseClient;

  if (!client) {
    showAuthMessage("Supabase connection missing. Check js/supabase.js.");
    return;
  }

  showAuthMessage("Creating your account...");

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }
      }
    });

    if (error) throw error;

    if (data.session) {
      showAuthMessage("Account created successfully!");
      window.location.href = "index.html";
    } else {
      showAuthMessage(
        "Account request successful. Check your email to confirm your account, then log in."
      );
    }
  } catch (error) {
    console.error("Registration error:", error);
    showAuthMessage(error.message || "Registration failed.");
  }
}

// LOGIN
async function loginUser() {
  const email =
    document.getElementById("loginEmail")?.value.trim() ||
    document.getElementById("email")?.value.trim();

  const password =
    document.getElementById("loginPassword")?.value ||
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

  showAuthMessage("Logging in...");

  try {
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

// Supports the register form shown in register.html
document.getElementById("registerForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  registerUser();
});