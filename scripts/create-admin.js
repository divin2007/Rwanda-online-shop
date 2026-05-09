const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/market_rwanda';

async function createAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminEmail = 'admin@rmf.com';
    const adminPassword = 'admin123';

    // Check if user exists
    const User = mongoose.connection.collection('users');
    const existingUser = await User.findOne({ email: adminEmail });

    if (existingUser) {
      console.log('Admin user already exists. Updating role to ADMIN...');
      await User.updateOne(
        { email: adminEmail },
        { $set: { role: 'ADMIN' } }
      );
      console.log('Admin user updated successfully.');
    } else {
      console.log('Creating new admin user...');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(adminPassword, salt);

      await User.insertOne({
        fullName: 'System Administrator',
        email: adminEmail,
        phone: '+250780000000',
        passwordHash: passwordHash,
        role: 'ADMIN',
        isVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Admin user created successfully.');
      console.log('Email: admin@rmf.com');
      console.log('Password: admin123');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

createAdmin();
