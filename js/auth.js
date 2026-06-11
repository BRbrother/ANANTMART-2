function registerUser(){

const name =
document.getElementById("name").value;

const email =
document.getElementById("email").value;

const password =
document.getElementById("password").value;

if(!name || !email || !password){

alert("Please Fill All Fields");

return;

}

const user = {
name,
email,
password
};

localStorage.setItem(
"user",
JSON.stringify(user)
);

alert("Registration Successful");

window.location.href =
"login.html";

}



function loginUser(){

const email =
document.getElementById("loginEmail").value;

const password =
document.getElementById("loginPassword").value;

const user =
JSON.parse(localStorage.getItem("user"));

if(
user &&
user.email === email &&
user.password === password
){

alert("Login Successful");

window.location.href =
"index.html";

}else{

alert("Invalid Email Or Password");

}

}