const axios = require('axios');

async function checkFraudApi() {
  try {
    const res = await axios.get('http://localhost:3011/api/v1/admin/fraud-alerts');
    console.log(`Fraud alerts returned: ${res.data?.data?.length || 0}`);
    if (res.data?.data?.length > 0) {
      console.log('Sample fraud alert:');
      console.log(JSON.stringify(res.data.data[0], null, 2));
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    if (err.response) {
      console.error(JSON.stringify(err.response.data, null, 2));
    }
  }
}

checkFraudApi();
