const addToCart =
document.getElementById("addToCart");

if(addToCart){

addToCart.addEventListener("click",()=>{

const product = {

name:"Premium Smartphone",
price:14999

};

let cart =
JSON.parse(localStorage.getItem("cart")) || [];

cart.push(product);

localStorage.setItem(
"cart",
JSON.stringify(cart)
);

alert("Product Added To Cart");

});

}
const user =
JSON.parse(localStorage.getItem("user"));

const welcomeUser =
document.getElementById("welcomeUser");

const loginLink =
document.getElementById("loginLink");

const logoutBtn =
document.getElementById("logoutBtn");

if(user && welcomeUser && loginLink && logoutBtn){

welcomeUser.innerHTML =
`👤 ${user.name}`;

loginLink.style.display = "none";

logoutBtn.style.display = "inline-block";


logoutBtn.addEventListener("click",()=>{

localStorage.removeItem("user");

location.reload();

});
}
let products =
JSON.parse(localStorage.getItem("products")) || [];
function displayProducts(products){
const productGrid =
document.getElementById("productGrid");

if(!productGrid) return;

productGrid.innerHTML = "";

products.forEach(product=>{

productGrid.innerHTML += `

<div class="product-card">

<img src="${product.image}">

<h3>${product.name}</h3>

<p>₹${product.price}</p>

<p>${product.category}</p>

<button>Buy Now</button>

</div>

`;

});

}
displayProducts(products);

const searchInput =
document.getElementById("searchInput");

if(searchInput){

searchInput.addEventListener("keyup",()=>{

const searchText =
searchInput.value.toLowerCase();

const filteredProducts =
products.filter(product=>

product.name
.toLowerCase()
.includes(searchText)

);

displayProducts(filteredProducts);

});

}