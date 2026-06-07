const axios = require('axios');

async function simulatePayment(referenceId, orderNumber) {
  const url = 'https://rmf-order-service.onrender.com/api/v1/orders/payment/mtn/callback';

  console.log(`Simulating successful MTN MoMo payment for reference: ${referenceId}...`);

  try {
    const response = await axios.post(url, {
      referenceId,
      externalId: orderNumber,
      status: 'SUCCESSFUL',
      financialTransactionId: 'SIM-MTN-' + Math.random().toString(36).substring(7).toUpperCase(),
    });

    console.log('Success! The MTN MoMo callback was accepted.');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Failed to simulate payment:', error.response?.data || error.message);
  }
}

const referenceId = process.argv[2];
const orderNum = process.argv[3];
if (!referenceId) {
  console.error('Please provide the MTN MoMo reference id. Example: node scripts/simulate-payment.js <REFERENCE_ID> ORD-123456789');
  process.exit(1);
}

simulatePayment(referenceId, orderNum);
