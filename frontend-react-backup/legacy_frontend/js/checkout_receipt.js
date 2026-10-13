// Checkout and receipt UI: show payment options, cash change,
// errors, cancellation, and the itemized receipt.
// checkout_receipt.js

function showPaymentOptions() {
    console.log("Payment Options:");
    console.log("1. Cash");
    console.log("2. Credit Card");
    console.log("3. Debit Card");
}

function calculateChange(total, amountPaid) {
    if (amountPaid < total) {
        return null;
    }

    return amountPaid - total;
}

function showError(message) {
    console.error("Error: " + message);
}

function cancelCheckout() {
    console.log("Checkout cancelled.");
}

function printReceipt(cart, total) {
    console.log("===== RECEIPT =====");

    cart.forEach(item => {
        console.log(
            `${item.name} x${item.quantity} - $${item.price}`
        );
    });

    console.log("-------------------");
    console.log(`Total: $${total}`);
}