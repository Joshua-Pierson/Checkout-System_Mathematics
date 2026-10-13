// Preserves the original checkout controls and console-only behavior.
// No new checkout form or receipt preview is added.
export default function CheckoutReceipt() {
  function showPaymentOptions() {
    console.log('Payment Options:');
    console.log('1. Cash');
    console.log('2. Credit Card');
    console.log('3. Debit Card');
  }
  return <>
    <h3>Checkout</h3>
    <button type="button" onClick={showPaymentOptions}>Show Payment Options</button>{' '}
    <button type="button" onClick={() => console.log('Checkout cancelled.')}>Cancel Checkout</button>
    <p id="checkout-message"></p>
    <h3>Receipt</h3>
    <div id="receipt-output">No receipt generated yet.</div>
  </>;
}
