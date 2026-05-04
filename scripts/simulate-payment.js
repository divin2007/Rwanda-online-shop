const axios = require('axios');

async function simulatePayment(orderNumber) {
  const url = 'https://rmf-order-service.onrender.com/api/v1/orders/payment/callback';
  
  console.log(`🚀 Simulating successful MoMo payment for Order: ${orderNumber}...`);
  
  try {
    const response = await axios.post(url, {
      orderNumber: orderNumber,
      status: 'paid',
      transactionRef: 'SIM-' + Math.random().toString(36).substring(7).toUpperCase()
    });
    
    console.log('✅ Success! The order is now PAID and CONFIRMED.');
    console.log('Check your dashboard or tracking page to see the update.');
  } catch (error) {
    console.error('❌ Failed to simulate payment:', error.response?.data || error.message);
  }
}

const orderNum = process.argv[2];
if (!orderNum) {
  console.error('Please provide an order number. Example: node simulate-payment.js ORD-123456789');
  process.exit(1);
}

simulatePayment(orderNum);
