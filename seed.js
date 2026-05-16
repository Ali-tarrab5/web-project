const mongoose = require('mongoose');
const Product = require('./models/Product');
const { products } = require('./data/products');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velour';

async function seedDatabase() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB for seeding.');
    await Product.deleteMany({});
    await Product.insertMany(products);
    console.log(`Inserted ${products.length} sample products.`);
  } catch (error) {
    console.error('Error seeding database:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedDatabase();
