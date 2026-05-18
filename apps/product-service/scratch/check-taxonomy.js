const mongoose = require('mongoose');

async function checkTaxonomy() {
  await mongoose.connect('mongodb://localhost:27017/rwanda-market');
  const Taxonomy = mongoose.model('TaxonomyCategory', new mongoose.Schema({}, { strict: false, collection: 'taxonomycategories' }));
  
  const count = await Taxonomy.countDocuments();
  console.log(`Total taxonomy categories in DB: ${count}`);
  
  const all = await Taxonomy.find().exec();
  console.log('Taxonomy categories details:');
  console.log(JSON.stringify(all, null, 2));
  
  await mongoose.disconnect();
}

checkTaxonomy().catch(console.error);
