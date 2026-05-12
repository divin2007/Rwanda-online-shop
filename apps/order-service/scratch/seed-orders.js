const mongoose = require('mongoose');

async function seedOrders() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rmf-platform';
  await mongoose.connect(uri);
  const Order = mongoose.model('Transaction', new mongoose.Schema({}, { strict: false }));
  
  // Clear existing orders if any
  await Order.deleteMany({});
  console.log('Cleared existing orders.');

  const sellers = [
    { id: '69ff6f25725c6ff52904f12a', name: 'Bakery World' },
    { id: '69ff6f25725c6ff52904f12b', name: 'Kigali Fashion' },
    { id: '69ff6f25725c6ff52904f12c', name: 'Fresh Fruits' }
  ];

  const statuses = ['delivered', 'delivered', 'delivered', 'cancelled', 'disputed', 'placed', 'confirmed'];
  const products = [
    { name: 'Rwandan Coffee', price: 5000 },
    { name: 'Traditional Basket', price: 12000 },
    { name: 'Milk Bread', price: 1500 },
    { name: 'Honey 500g', price: 4500 }
  ];

  const orders = [];
  const now = new Date();

  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    
    const seller = sellers[Math.floor(Math.random() * sellers.length)];
    const product = products[Math.floor(Math.random() * products.length)];
    const qty = Math.floor(Math.random() * 3) + 1;
    const subtotal = product.price * qty;
    const commission = Math.max(subtotal * 0.1, 100);
    const deliveryFee = 1000;
    const gatewayFee = Math.ceil((subtotal + deliveryFee) * 0.02);
    const total = subtotal + deliveryFee + gatewayFee;

    const isFraudulent = i % 10 === 0; // Flag every 10th order
    const status = isFraudulent ? 'placed' : statuses[Math.floor(Math.random() * statuses.length)];

    orders.push({
      orderNumber: `ORD-${date.getTime()}-${i}`,
      status,
      createdAt: date,
      updatedAt: date,
      buyer: {
        userId: 'buyer-123',
        fullName: 'Test Buyer',
        email: 'buyer@example.com'
      },
      seller: {
        userId: seller.id,
        fullName: seller.name,
        marketId: '69ff72a3394ea3c5397826d1'
      },
      products: [{
        productId: 'prod-' + i,
        name: product.name,
        quantity: qty,
        unitPrice: product.price
      }],
      financials: {
        subtotal,
        deliveryFee,
        platformCommission: commission,
        gatewayFee,
        totalAmount: total,
        sellerPayout: subtotal - commission,
        riderPayout: deliveryFee * 0.9
      },
      dispute: {
        isDisputed: Math.random() > 0.9
      },
      security: {
        isFlagged: isFraudulent,
        flagReason: isFraudulent ? 'F001: High value transaction exceeding 100,000 RWF' : null
      }
    });
  }

  await Order.insertMany(orders);
  console.log(`Successfully seeded ${orders.length} orders across the last 30 days.`);
  
  await mongoose.disconnect();
}

seedOrders().catch(console.error);
