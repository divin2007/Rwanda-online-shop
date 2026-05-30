const path = require('path');
const fs = require('fs');

// Resolve local dependencies from apps/order-service
const baseDir = path.join(__dirname, '..', 'apps', 'order-service');
const mongoosePath = path.join(baseDir, 'node_modules', 'mongoose');
const axiosPath = path.join(baseDir, 'node_modules', 'axios');
const dotenvPath = path.join(baseDir, 'node_modules', 'dotenv');

if (!fs.existsSync(mongoosePath) || !fs.existsSync(axiosPath) || !fs.existsSync(dotenvPath)) {
  console.error('\x1b[31mError: Required dependencies not found in order-service.\x1b[0m');
  console.log('Please make sure dependencies are installed inside apps/order-service.');
  process.exit(1);
}

const mongoose = require(mongoosePath);
const axios = require(axiosPath);
const dotenv = require(dotenvPath);

// Load .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rmf-platform';
const serviceUrl = process.env.ORDER_SERVICE_URL || 'http://localhost:3006/api/v1';
const secret = process.env.INTERNAL_SERVICE_SECRET || 'change-me-to-a-strong-random-secret-for-inter-service-auth';

async function approveLatestOrder() {
  console.log(`Connecting to MongoDB at: ${mongoUri}...`);
  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✔ Connected to MongoDB!');

    // Define minimal Transaction schema to retrieve orderNumber
    const transactionSchema = new mongoose.Schema({}, { strict: false, collection: 'transactions' });
    const Transaction = mongoose.model('Transaction', transactionSchema);

    // Find the latest order where payment status is PENDING or not PAID
    const order = await Transaction.findOne({
      'payment.status': { $ne: 'PAID' }
    }).sort({ createdAt: -1 }).exec();

    if (!order) {
      console.log('\x1b[33mNo unpaid orders found in the database.\x1b[0m');
      mongoose.disconnect();
      return;
    }

    const orderNumber = order.get('orderNumber');
    const currentStatus = order.get('payment.status');
    console.log(`\n\x1b[32mFound Latest Unpaid Order:\x1b[0m`);
    console.log(`- ID: ${order._id}`);
    console.log(`- Order Number: ${orderNumber}`);
    console.log(`- Payment Status: ${currentStatus}`);
    console.log(`- Created At: ${order.get('createdAt')}`);

    // Trigger mock callback
    console.log(`\n\x1b[34m[Simulate] Triggering Mock Webhook for ${orderNumber}...\x1b[0m`);
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
    console.error('\x1b[31m✖ Error during database query or webhook simulation:\x1b[0m');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  } finally {
    mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
}

approveLatestOrder();
