#!/usr/bin/env node
/**
 * MTN MoMo Sandbox Setup Script
 * Run once to create a sandbox API user and get credentials.
 * 
 * MTN MoMo Sandbox Docs: https://momodeveloper.mtn.com/
 * 
 * Prerequisites:
 *   1. Register at https://momodeveloper.mtn.com/
 *   2. Subscribe to "Collection" product — get a PRIMARY KEY (this is your Ocp-Apim-Subscription-Key)
 *   3. Set it as MTN_MOMO_SUBSCRIPTION_KEY in your .env file
 *   4. Run: node scripts/setup-momo-sandbox.js
 * 
 * This script will:
 *   - Create a sandbox API user
 *   - Create API key (secret) for that user
 *   - Print the credentials to add to your .env
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const SANDBOX_BASE_URL = 'https://sandbox.momodeveloper.mtn.com';

// ─── READ FROM ENV ───────────────────────────────────────────────────────────
const SUBSCRIPTION_KEY = process.env.MTN_MOMO_SUBSCRIPTION_KEY;

if (!SUBSCRIPTION_KEY) {
  console.error('\n❌ ERROR: MTN_MOMO_SUBSCRIPTION_KEY is not set.\n');
  console.error('   1. Go to https://momodeveloper.mtn.com/');
  console.error('   2. Sign in → Subscribe to "Collection" product');
  console.error('   3. Copy your Primary Key');
  console.error('   4. Run: MTN_MOMO_SUBSCRIPTION_KEY=<your_key> node scripts/setup-momo-sandbox.js\n');
  process.exit(1);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function setupMoMoSandbox() {
  const userId = uuidv4();
  console.log('\n🔧 MTN MoMo Sandbox Setup');
  console.log('─'.repeat(50));
  console.log(`📋 Generated User ID: ${userId}`);

  // Step 1: Create API User
  console.log('\n1️⃣  Creating sandbox API user...');
  try {
    await axios.post(
      `${SANDBOX_BASE_URL}/v1_0/apiuser`,
      { providerCallbackHost: 'http://localhost:3006' },
      {
        headers: {
          'X-Reference-Id': userId,
          'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('   ✅ API User created successfully');
  } catch (err) {
    console.error('   ❌ Failed to create API user:', err.response?.data || err.message);
    process.exit(1);
  }

  // Step 2: Create API Key (secret)
  console.log('\n2️⃣  Creating API key for user...');
  let apiKey;
  try {
    const res = await axios.post(
      `${SANDBOX_BASE_URL}/v1_0/apiuser/${userId}/apikey`,
      {},
      {
        headers: {
          'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
        },
      }
    );
    apiKey = res.data.apiKey;
    console.log('   ✅ API Key created successfully');
  } catch (err) {
    console.error('   ❌ Failed to create API key:', err.response?.data || err.message);
    process.exit(1);
  }

  // Step 3: Test - Get Access Token
  console.log('\n3️⃣  Testing: Fetching access token...');
  try {
    const auth = Buffer.from(`${userId}:${apiKey}`).toString('base64');
    const res = await axios.post(
      `${SANDBOX_BASE_URL}/collection/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
        },
      }
    );
    console.log('   ✅ Access token obtained! Expires in:', res.data.expires_in, 'seconds');
  } catch (err) {
    console.error('   ❌ Failed to get access token:', err.response?.data || err.message);
    process.exit(1);
  }

  // Step 4: Print credentials
  console.log('\n' + '═'.repeat(50));
  console.log('🎉 SANDBOX SETUP COMPLETE! Add these to your .env:\n');
  console.log(`MTN_MOMO_API_KEY=${SUBSCRIPTION_KEY}`);
  console.log(`MTN_MOMO_USER_ID=${userId}`);
  console.log(`MTN_MOMO_API_SECRET=${apiKey}`);
  console.log(`MTN_MOMO_TARGET_ENV=sandbox`);
  console.log('\n📌 Sandbox test numbers:');
  console.log('   • 46733123450  → Always SUCCESSFUL');
  console.log('   • 46733123451  → Always FAILED');
  console.log('   • 46733123452  → Always PENDING (TIMEOUT)');
  console.log('\n⚠️  For sandbox, use format: 256780000000 (remove leading 0, add 256)');
  console.log('═'.repeat(50) + '\n');
}

setupMoMoSandbox();
