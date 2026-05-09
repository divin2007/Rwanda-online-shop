const net = require('net');

const services = [
  { name: 'user-service', port: 3001 },
  { name: 'market-service', port: 3002 },
  { name: 'product-service', port: 3003 },
  { name: 'seller-service', port: 3004 },
  { name: 'rider-service', port: 3005 },
  { name: 'order-service', port: 3006 },
  { name: 'wallet-service', port: 3007 },
  { name: 'delivery-service', port: 3008 },
  { name: 'notification-service', port: 3009 },
  { name: 'review-service', port: 3010 },
  { name: 'admin-service', port: 3011 },
];

async function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 1000;

    socket.setTimeout(timeout);
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1', () => {
      socket.end();
      resolve(true);
    });
  });
}

async function waitForServices() {
  console.log('⏳ Waiting for microservices to be ready...');
  let allReady = false;
  const startTime = Date.now();
  const maxWait = 60000; // 60 seconds

  while (!allReady && Date.now() - startTime < maxWait) {
    const statuses = await Promise.all(services.map(s => checkPort(s.port)));
    const readyCount = statuses.filter(Boolean).length;
    
    if (readyCount === services.length) {
      allReady = true;
    } else {
      console.log(`📡 ${readyCount}/${services.length} services ready. Retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (allReady) {
    console.log('✅ All microservices are online!');
    process.exit(0);
  } else {
    console.error('❌ Timeout waiting for microservices.');
    process.exit(1);
  }
}

waitForServices();
