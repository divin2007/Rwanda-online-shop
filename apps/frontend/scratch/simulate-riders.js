const io = require('socket.io-client');

const socket = io('http://localhost:3008', {
  transports: ['polling', 'websocket']
});

const riders = [
  { id: '69ff6f25725c6ff52904f12a', lat: -1.9512, lng: 30.0576, marketId: '69ff72a3394ea3c5397826d1' },
  { id: '69ff70000000000000000001', lat: -1.9441, lng: 30.0619, marketId: '69ff72a3394ea3c5397826d1' },
  { id: '69ff70000000000000000002', lat: -1.9580, lng: 30.0500, marketId: '69ff72a3394ea3c5397826d1' },
  { id: '69ff70000000000000000003', lat: -1.9300, lng: 30.0700, marketId: '69ff72a3394ea3c5397826d1' }
];

socket.on('connect', () => {
  console.log('Connected to delivery-service');
  
  setInterval(() => {
    riders.forEach(r => {
      // Small random movement
      r.lat += (Math.random() - 0.5) * 0.001;
      r.lng += (Math.random() - 0.5) * 0.001;
      
      console.log(`Emitting location for ${r.id}: ${r.lat}, ${r.lng}`);
      socket.emit('rider:location:update', {
        riderId: r.id,
        lat: r.lat,
        lng: r.lng,
        marketId: r.marketId
      });
    });
  }, 3000);
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
});
