const mongoose = require('mongoose');
const uri = 'mongodb+srv://mahorodiv2007_db_user:RwShop%402024Secure@cluster0.pkpnndf.mongodb.net/market_rwanda?retryWrites=true&w=majority';

async function fixSlugs() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    const Market = mongoose.model('Market', new mongoose.Schema({}, { strict: false }));
    const markets = await Market.find({});
    
    for (const m of markets) {
      if (m.slug && m.slug !== m.slug.toLowerCase()) {
        console.log(`Lowercasing slug for: ${m.name} (${m.slug} -> ${m.slug.toLowerCase()})`);
        await Market.updateOne({ _id: m._id }, { $set: { slug: m.slug.toLowerCase() } });
      }
    }
    
    console.log('Migration complete');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

fixSlugs();
