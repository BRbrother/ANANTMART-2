let cart =
JSON.parse(localStorage.getItem("cart")) || [];

const cartContainer =
document.getElementById("cart-items");

const totalPriceElement =
document.getElementById("total-price");

function loadCart(){

cartContainer.innerHTML = "";

let total = 0;

if(cart.length === 0){

cartContainer.innerHTML =
"<h2 class='cart-empty'>Your Cart is Empty</h2>";

totalPriceElement.innerHTML = '<h2 class="total-price">Total Price: ₹0</h2>';

return;

}

cart.forEach((product,index)=>{

total += product.price;

cartContainer.innerHTML += `

<div style="
padding:20px;
margin:20px;
border:1px solid #ddd;
border-radius:10px;
">

<h3>${product.name}</h3>

<p>₹${product.price}</p>

<button class="remove-btn" 
onclick="removeItem(${index})">
Remove
</button>

</div>

`;

});

totalPriceElement.innerHTML =
'<h2 class="total-price">Total Price: ₹' + total + '</h2>';

}

function removeItem(index){

cart.splice(index,1);

localStorage.setItem(
"cart",
JSON.stringify(cart)
);

loadCart();

}

loadCart();
function clearCart(){
    localStorage.removeItem("cart");
    location.reload();
}