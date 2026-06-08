const path = require('path');
const fs = require('fs');

// Resolve local dependencies from apps/order-service
const baseDir = path.join(__dirname, '..', 'apps', 'order-service');
const axiosPath = path.join(baseDir, 'node_modules', 'axios');
const dotenvPath = path.join(baseDir, 'node_modules', 'dotenv');

if (!fs.existsSync(axiosPath) || !fs.existsSync(dotenvPath)) {
  console.error('\x1b[31mError: Required dependencies not found in order-service.\x1b[0m');
  console.log('Please make sure dependencies are installed inside apps/order-service.');
  process.exit(1);
}

const axios = require(axiosPath);
const dotenv = require(dotenvPath);

// Load .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const orderNumber = process.argv[2];

if (!orderNumber) {
  console.error('\x1b[31mError: Please provide an order number.\x1b[0m');
  console.log('Usage: node scripts/simulate_paypack_callback.js <ORDER_NUMBER>');
  process.exit(1);
}

const serviceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3006/api/v1';
const secret = process.env.INTERNAL_SERVICE_SECRET || 'change-me-to-a-strong-random-secret-for-inter-service-auth';

async function simulateCallback() {
  console.log(`\x1b[34m[Simulate] Initiating Mock Paypack Callback for Order: ${orderNumber}...\x1b[0m`);
  
  try {
    const response = await axios.post(
      `${serviceUrl}/orders/payment/callback`,
      {
        orderNumber: orderNumber,
        status: 'PAID',
        transactionRef: `MOCK-PAYPACK-REF-${Date.now()}`
      },
      {
        headers: {
          'x-internal-service-key': secret,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\x1b[32m✔ Mock Webhook Delivered Successfully!\x1b[0m');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('\x1b[31m✖ Webhook Delivery Failed!\x1b[0m');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

simulateCallback();
