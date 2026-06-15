// =======================================================
// 1. USER REGISTRATION (BACKEND CONNECTED - DAY 9)
// =======================================================
async function registerUser() {
  const name = document.getElementById("name").value; // Abhi hum backend me sirf email/password bhej rahe hain
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!name || !email || !password) {
    alert("Please Fill All Fields");
    return;
  }

  // Data object taiyar kiya backend ko bhejne ke liye
  const userData = {
    email: email,
    password: password
  };

  try {
    // Backend API ko POST request bhejna
    const response = await fetch("http://localhost:3000/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(userData)
    });

    const result = await response.json();

    if (response.status === 201) {
      alert("Registration Successful! 🎉");
      
      // Account bante hi sidhe login page par bhej dena
      window.location.href = "login.html";
    } else {
      // Agar email pehle se register hoga, toh backend ka error message dikhega
      alert("Error: " + result.message);
    }

  } catch (error) {
    console.error("Register karne me dikkat aayi:", error);
    alert("Server band hai! Pehle terminal me server.js run karo.");
  }
}


// Is pure function ko fir se paste kar lein (Day 12 Update)
async function loginUser() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    alert("Please Fill All Fields");
    return;
  }

  const loginData = { email, password };

  try {
    const response = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginData)
    });

    const result = await response.json();

    if (response.status === 200) {
      alert("Login Successful! Welcome back. 🎉");

      // =======================================================
      // TOKEN KO LOCALSTORAGE ME SAVE KARNA
      // =======================================================
      localStorage.setItem("anantmart_token", result.token); // Secure Token Saved!
      localStorage.setItem("userEmail", result.user.email);
      localStorage.setItem("isLoggedIn", "true");

      window.location.href = "index.html";
    } else {
      alert("Error: " + result.message);
    }
  } catch (error) {
    console.error("Login Error:", error);
    alert("Server Error!");
  }
}