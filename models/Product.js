const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, trim: true },
  rating: { type: Number, required: true, min: 0, max: 5 },
  stock: { type: Number, required: true, min: 0 },
  imageUrl: { type: String, default: 'https://via.placeholder.com/400x300?text=Product' },
});

module.exports = mongoose.model('Product', productSchema);
