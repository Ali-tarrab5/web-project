const express   = require('express');
const mongoose  = require('mongoose');
const path      = require('path');
const Product   = require('./models/Product');

const app  = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velour';

// ── FIX: removed deprecated useNewUrlParser / useUnifiedTopology ─────────────
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ── View engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Static files (serves index.html, style.css, script.js, images) ───────────
app.use(express.static(path.join(__dirname)));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.redirect('/products');
});

app.get('/products', async (req, res) => {
  try {
    const LIMIT = 8;

    // -- Parse query params ---------------------------------------------------
    const search      = String(req.query.search   || '').trim();
    const category    = String(req.query.category || '').trim();
    const minPriceRaw = String(req.query.minPrice || '').trim();
    const maxPriceRaw = String(req.query.maxPrice || '').trim();
    const sort        = String(req.query.sort     || 'name_asc');
    let   page        = Math.max(parseInt(req.query.page, 10) || 1, 1);

    // -- Build filter ---------------------------------------------------------
    const filter = {};

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    if (category && category !== 'All') {
      filter.category = category;
    }
    if (minPriceRaw || maxPriceRaw) {
      filter.price = {};
      const min = parseFloat(minPriceRaw);
      const max = parseFloat(maxPriceRaw);
      if (minPriceRaw && !isNaN(min)) filter.price.$gte = min;
      if (maxPriceRaw && !isNaN(max)) filter.price.$lte = max;
    }

    // -- Build sort -----------------------------------------------------------
    const sortMap = {
      name_asc:    { name:   1 },
      name_desc:   { name:  -1 },
      price_asc:   { price:  1 },
      price_desc:  { price: -1 },
      rating_desc: { rating:-1 },
    };
    const sortOption = sortMap[sort] || sortMap.name_asc;

    // -- Pagination math ------------------------------------------------------
    const totalProducts = await Product.countDocuments(filter);
    const totalPages    = Math.max(Math.ceil(totalProducts / LIMIT), 1);

    // clamp page so it never exceeds totalPages
    if (page > totalPages) page = totalPages;

    const products = await Product.find(filter)
      .sort(sortOption)
      .skip((page - 1) * LIMIT)
      .limit(LIMIT)
      .lean();
    // -- Dynamic categories from DB (not hardcoded) ---------------------------
    const categories = (await Product.distinct('category')).sort();

    // -- Page numbers array for EJS -------------------------------------------
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

    res.render('products', {
      products,
      categories,
      pageNumbers,
      pagination: {
        page,
        totalPages,
        totalProducts,
        limit: LIMIT,
      },
      filters: { search, category, minPrice: minPriceRaw, maxPrice: maxPriceRaw, sort },
    });

  } catch (err) {
    console.error('Products route error:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

// ── Catch-all ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.redirect('/products'));

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
