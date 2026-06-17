// =======================================================
// ANANTMART - PRODUCTION READY AUTHENTICATION LOGIC
// =======================================================

// MASTER URL: Pure file ke liye ek hi baar live link set kar diya
const BACKEND_URL = "https://anantmart-backend.onrender.com";

// =======================================================
// 1. USER REGISTRATION (BACKEND CONNECTED)
// =======================================================
async function registerUser() {
  const name = document.getElementById("name").value; 
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!name || !email || !password) {
    alert("Please Fill All Fields");
    return;
  }

  const userData = {
    email: email,
    password: password
  };

  try {
    // FIXED: Localhost hata kar global BACKEND_URL lagaya
    const response = await fetch(`${BACKEND_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(userData)
    });

    const result = await response.json();

    if (response.status === 201) {
      alert("Registration Successful! 🎉");
      window.location.href = "login.html";
    } else {
      alert("Error: " + result.message);
    }

  } catch (error) {
    console.error("Register karne me dikkat aayi:", error);
    alert("Server connect nahi ho pa raha hai bhaa!");
  }
}

// =======================================================
// 2. USER LOGIN (TOKEN MANAGEMENT)
// =======================================================
async function loginUser() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    alert("Please Fill All Fields");
    return;
  }

  const loginData = { email, password };

  try {
    // FIXED: Localhost hata kar global BACKEND_URL lagaya
    const response = await fetch(`${BACKEND_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginData)
    });

    const result = await response.json();

    if (response.status === 200) {
      alert("Login Successful! Welcome back. 🎉");

      // TOKEN KO LOCALSTORAGE ME SAVE KARNA
      localStorage.setItem("anantmart_token", result.token); 
      localStorage.setItem("userEmail", result.user.email);
      localStorage.setItem("isLoggedIn", "true");

      window.location.href = "index.html";
    } else {
      alert("Error: " + result.message);
    }
  } catch (error) {
    console.error("Login Error:", error);
    alert("Server Error! Connection nahi ban paya.");
  }
}