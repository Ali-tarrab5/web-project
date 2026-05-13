const mongoose = require('mongoose');
const Product = require('./models/Product');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velour';

const categoryColors = {
  Electronics: '1d4ed8',
  Fashion: 'db2777',
  Home: '0f766e',
};

const onlineImage = (name, category) => {
  const bg = categoryColors[category] || '111827';
  const fg = 'ffffff';
  const label = encodeURIComponent(name);
  return `https://via.placeholder.com/500x300/${bg}/${fg}.png?text=${label}`;
};

const products = [
  { name: 'Wireless Noise-Cancelling Headphones', price: 129.99, category: 'Electronics', rating: 4.7, stock: 42, imageUrl: onlineImage('Wireless Noise-Cancelling Headphones', 'Electronics') },
  { name: 'Smart Home Speaker', price: 89.0, category: 'Electronics', rating: 4.4, stock: 18, imageUrl: onlineImage('Smart Home Speaker', 'Electronics') },
  { name: 'Fitness Tracker Watch', price: 69.99, category: 'Electronics', rating: 4.2, stock: 30, imageUrl: onlineImage('Fitness Tracker Watch', 'Electronics') },
  { name: 'Minimalist Leather Wallet', price: 25.0, category: 'Fashion', rating: 4.8, stock: 55, imageUrl: onlineImage('Minimalist Leather Wallet', 'Fashion') },
  { name: 'Classic Denim Jacket', price: 79.95, category: 'Fashion', rating: 4.5, stock: 23, imageUrl: onlineImage('Classic Denim Jacket', 'Fashion') },
  { name: 'Running Sneakers', price: 94.5, category: 'Fashion', rating: 4.6, stock: 12, imageUrl: onlineImage('Running Sneakers', 'Fashion') },
  { name: 'Modern Table Lamp', price: 38.0, category: 'Home', rating: 4.3, stock: 28, imageUrl: onlineImage('Modern Table Lamp', 'Home') },
  { name: 'Indoor Plant Set', price: 49.99, category: 'Home', rating: 4.9, stock: 31, imageUrl: onlineImage('Indoor Plant Set', 'Home') },
  { name: 'Organic Cotton Bedding', price: 119.0, category: 'Home', rating: 4.7, stock: 16, imageUrl: onlineImage('Organic Cotton Bedding', 'Home') },
  { name: 'Bluetooth Wireless Mouse', price: 29.99, category: 'Electronics', rating: 4.5, stock: 40, imageUrl: onlineImage('Bluetooth Wireless Mouse', 'Electronics') },
  { name: 'Sleek Laptop Sleeve', price: 24.95, category: 'Electronics', rating: 4.2, stock: 60, imageUrl: onlineImage('Sleek Laptop Sleeve', 'Electronics') },
  { name: 'Desk Organizer Set', price: 21.99, category: 'Home', rating: 4.4, stock: 47, imageUrl: onlineImage('Desk Organizer Set', 'Home') },
  { name: 'Leather Crossbody Bag', price: 69.0, category: 'Fashion', rating: 4.6, stock: 14, imageUrl: onlineImage('Leather Crossbody Bag', 'Fashion') },
  { name: 'Thermal Coffee Mug', price: 19.99, category: 'Home', rating: 4.8, stock: 36, imageUrl: onlineImage('Thermal Coffee Mug', 'Home') },
  { name: 'Premium Yoga Mat', price: 42.5, category: 'Fashion', rating: 4.5, stock: 22, imageUrl: onlineImage('Premium Yoga Mat', 'Fashion') },
  { name: 'Smartphone Charging Stand', price: 27.0, category: 'Electronics', rating: 4.3, stock: 26, imageUrl: onlineImage('Smartphone Charging Stand', 'Electronics') },
  { name: 'Air Purifier', price: 149.99, category: 'Home', rating: 4.4, stock: 10, imageUrl: onlineImage('Air Purifier', 'Home') },
  { name: 'Travel Backpack', price: 54.9, category: 'Fashion', rating: 4.7, stock: 20, imageUrl: onlineImage('Travel Backpack', 'Fashion') },
  { name: 'Ceramic Dinnerware Set', price: 64.0, category: 'Home', rating: 4.5, stock: 19, imageUrl: onlineImage('Ceramic Dinnerware Set', 'Home') },
  { name: 'Portable Projector', price: 179.99, category: 'Electronics', rating: 4.2, stock: 8, imageUrl: onlineImage('Portable Projector', 'Electronics') },
  { name: 'LED Vanity Mirror', price: 33.0, category: 'Home', rating: 4.6, stock: 34, imageUrl: onlineImage('LED Vanity Mirror', 'Home') },
  { name: 'Cotton Oversized Hoodie', price: 45.0, category: 'Fashion', rating: 4.4, stock: 29, imageUrl: onlineImage('Cotton Oversized Hoodie', 'Fashion') },
  { name: 'Wireless Charging Pad', price: 34.99, category: 'Electronics', rating: 4.5, stock: 27, imageUrl: onlineImage('Wireless Charging Pad', 'Electronics') },
  { name: 'Faux Fur Throw Blanket', price: 52.0, category: 'Home', rating: 4.8, stock: 15, imageUrl: onlineImage('Faux Fur Throw Blanket', 'Home') }
];

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
