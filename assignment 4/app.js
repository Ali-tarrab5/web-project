const express   = require('express');
const mongoose  = require('mongoose');
const path      = require('path');
const fs        = require('fs');           // ← ADD
const multer    = require('multer');
const Product   = require('./models/Product');

const app  = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI  = process.env.MONGO_URI   || 'mongodb://127.0.0.1:27017/velour';
const ADMIN_USER = process.env.ADMIN_USER  || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS  || 'password123';

// ── FIX 1: Ensure uploads directory exists before Multer tries to use it ──────
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir));   // reuse variable
app.use(express.urlencoded({ extended: false }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/-+/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, allowedTypes.test(extension));
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

// ── FIX 2: Safe header parsing — no crash on missing/malformed auth ───────────
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const base64     = authHeader.startsWith('Basic ') ? authHeader.slice(6) : '';

  let user = '', pass = '';
  if (base64) {
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');          // handle passwords with ':' in them
    if (colonIdx !== -1) {
      user = decoded.slice(0, colonIdx);
      pass = decoded.slice(colonIdx + 1);
    }
  }

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    return next();
  }

  res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
  return res.status(401).send('Authentication required.');
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.redirect('/products'));

app.get('/products', async (req, res) => {
  try {
    const LIMIT = 8;

    const search      = String(req.query.search   || '').trim();
    const category    = String(req.query.category || '').trim();
    const minPriceRaw = String(req.query.minPrice || '').trim();
    const maxPriceRaw = String(req.query.maxPrice || '').trim();
    const sort        = String(req.query.sort     || 'name_asc');
    let   page        = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const filter = {};
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (category && category !== 'All') filter.category = category;
    if (minPriceRaw || maxPriceRaw) {
      filter.price = {};
      const min = parseFloat(minPriceRaw);
      const max = parseFloat(maxPriceRaw);
      if (minPriceRaw && !isNaN(min)) filter.price.$gte = min;
      if (maxPriceRaw && !isNaN(max)) filter.price.$lte = max;
    }

    const sortMap = {
      name_asc:    { name:   1 },
      name_desc:   { name:  -1 },
      price_asc:   { price:  1 },
      price_desc:  { price: -1 },
      rating_desc: { rating:-1 },
    };
    const sortOption = sortMap[sort] || sortMap.name_asc;

    const totalProducts = await Product.countDocuments(filter);
    const totalPages    = Math.max(Math.ceil(totalProducts / LIMIT), 1);
    if (page > totalPages) page = totalPages;

    const products = await Product.find(filter)
      .sort(sortOption)
      .skip((page - 1) * LIMIT)
      .limit(LIMIT)
      .lean();

    const categories  = (await Product.distinct('category')).sort();
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

    res.render('products', {
      products,
      categories,
      pageNumbers,
      pagination: { page, totalPages, totalProducts, limit: LIMIT },
      filters: { search, category, minPrice: minPriceRaw, maxPrice: maxPriceRaw, sort },
    });

  } catch (err) {
    console.error('Products route error:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.get('/admin', (req, res) => res.redirect('/admin/products'));

app.get('/admin/products', requireAdmin, async (req, res) => {
  try {
    const products        = await Product.find().sort({ name: 1 }).lean();
    const totalProducts   = products.length;
    const distinctCats    = await Product.distinct('category');   // ← FIX 3: await properly
    const totalCategories = distinctCats.length;

    res.render('admin_dashboard', {
      title: 'Admin Dashboard',
      products,
      totalProducts,
      totalCategories,
      active: 'dashboard',
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.get('/admin/products/new', requireAdmin, (req, res) => {
  res.render('admin_form', {
    title: 'Add Product',
    active: 'create',
    product: {},
    errors: [],
    formAction: '/admin/products/new',
  });
});

app.post('/admin/products/new', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, category, price, rating, stock } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
  const errors = [];

  if (!name?.trim())   errors.push('Name is required.');
  if (!category?.trim()) errors.push('Category is required.');
  if (!price || isNaN(Number(price))  || Number(price)  < 0)        errors.push('Price must be a positive number.');
  if (!rating || isNaN(Number(rating))|| Number(rating) < 0 || Number(rating) > 5) errors.push('Rating must be 0–5.');
  if (!stock || isNaN(Number(stock))  || Number(stock)  < 0)        errors.push('Stock must be non-negative.');

  if (errors.length) {
    return res.status(400).render('admin_form', {
      title: 'Add Product', active: 'create',
      product: { name, category, price, rating, stock, imageUrl },
      errors, formAction: '/admin/products/new',
    });
  }

  try {
    await new Product({
      name: name.trim(), category: category.trim(),
      price: Number(price), rating: Number(rating), stock: Number(stock),
      imageUrl: imageUrl || 'https://via.placeholder.com/400x300?text=Product',
    }).save();
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.get('/admin/products/:id/edit', requireAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).send('Product not found.');
    res.render('admin_form', {
      title: 'Edit Product', active: 'dashboard',
      product, errors: [], formAction: `/admin/products/${product._id}/edit`,
    });
  } catch (err) {
    console.error('Edit form error:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.post('/admin/products/:id/edit', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, category, price, rating, stock, existingImageUrl } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : existingImageUrl || '';
  const errors = [];

  if (!name?.trim())   errors.push('Name is required.');
  if (!category?.trim()) errors.push('Category is required.');
  if (!price || isNaN(Number(price))  || Number(price)  < 0)        errors.push('Price must be a positive number.');
  if (!rating || isNaN(Number(rating))|| Number(rating) < 0 || Number(rating) > 5) errors.push('Rating must be 0–5.');
  if (!stock || isNaN(Number(stock))  || Number(stock)  < 0)        errors.push('Stock must be non-negative.');

  if (errors.length) {
    return res.status(400).render('admin_form', {
      title: 'Edit Product', active: 'dashboard',
      product: { _id: req.params.id, name, category, price, rating, stock, imageUrl },
      errors, formAction: `/admin/products/${req.params.id}/edit`,
    });
  }

  try {
    await Product.findByIdAndUpdate(req.params.id, {
      name: name.trim(), category: category.trim(),
      price: Number(price), rating: Number(rating), stock: Number(stock),
      imageUrl: imageUrl || 'https://via.placeholder.com/400x300?text=Product',
    });
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.post('/admin/products/:id/delete', requireAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

// ── FIX 4: Wildcard only matches truly unknown routes, not static assets ──────
app.use((req, res) => res.redirect('/products'));

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});