"use strict";
const mongoose = require('mongoose');
const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');

// Load env from root
const envPath = resolve(__dirname, '../../../.env');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) return;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  });
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/market_rwanda';

async function clearDatabase() {
  console.log('🧹 Wiping all local database collections...');
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    await mongoose.connection.dropDatabase();
    console.log('✅ Database dropped and cleared completely!');
    console.log('✨ System is now 100% empty and ready for your actual market data!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to clear database:', err);
    process.exit(1);
  }
}

clearDatabase();
