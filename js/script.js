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