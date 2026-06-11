function addProduct(){

const name =
document.getElementById("productName").value;

const price =
document.getElementById("productPrice").value;

const category =
document.getElementById("productCategory").value;

const stock =
document.getElementById("productStock").value;


const image =
document.getElementById("productImage").value;

if(!name || !price || !image){

alert("Fill All Fields");

return;

}

const product = {

id: Date.now(),

name:name,

price:Number(price),

image:image,

category:category,

stock:Number(stock)


};

let products =
JSON.parse(localStorage.getItem("products")) || [];

products.push(product);

localStorage.setItem(
"products",
JSON.stringify(products)
);

alert("Product Added");

location.reload();

}
function loadProducts(){

const adminProducts =
document.getElementById("adminProducts");

if(!adminProducts) return;

let products =
JSON.parse(localStorage.getItem("products")) || [];

adminProducts.innerHTML = "";

products.forEach((product,index)=>{

adminProducts.innerHTML += `

<div class="admin-product">

<img src="${product.image}">

<h3>${product.name}</h3>

<p>₹${product.price}</p>
<p>Category: ${product.category}</p>
<p>Stock: ${product.stock}</p>

<button onclick="editProduct(${index})">
Edit
</button>
<button onclick="deleteProduct(${index})">
Delete
</button>


</div>

`;

});

}

function deleteProduct(index){

let products =
JSON.parse(localStorage.getItem("products")) || [];

products.splice(index,1);

localStorage.setItem(
"products",
JSON.stringify(products)
);

loadProducts();

}

loadProducts();
function editProduct(index){

let products =
JSON.parse(localStorage.getItem("products")) || [];

const product = products[index];

const newName =
prompt("Product Name", product.name);

const newPrice =
prompt("Product Price", product.price);

const newStock =
prompt("Stock Quantity", product.stock);

if(newName && newPrice){

products[index].name = newName;

products[index].price = Number(newPrice);

products[index].stock = Number(newStock);

localStorage.setItem(
"products",
JSON.stringify(products)
);

loadProducts();

}

}