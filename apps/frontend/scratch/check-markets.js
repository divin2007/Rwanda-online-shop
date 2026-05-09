const axios = require('axios');

async function checkMarkets() {
  try {
    const res = await axios.get('http://localhost:3002/api/v1/markets');
    console.log('Success:', res.data.success);
    console.log('Count:', res.data.data.length);
    console.log('Sample Market:', res.data.data[0]);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkMarkets();
