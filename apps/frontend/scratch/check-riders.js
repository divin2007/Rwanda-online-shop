const axios = require('axios');

async function checkRiders() {
  try {
    const res = await axios.get('http://localhost:3005/api/v1/riders');
    console.log('Success:', res.data.success);
    console.log('Count:', res.data.data.length);
    if (res.data.data.length > 0) {
      console.log('Sample Rider:', res.data.data[0]);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkRiders();
