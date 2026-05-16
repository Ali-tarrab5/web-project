const express      = require('express');
const mongoose     = require('mongoose');
const path         = require('path');
const multer       = require('multer');
const session      = require('express-session');
const flash        = require('connect-flash');
const MongoStore   = require('connect-mongo');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const Product      = require('./models/Product');
const User         = require('./models/User');
const Order        = require('./models/Order');

const app  = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/velour';
const SESSION_SECRET = process.env.SESSION_SECRET || 'keyboard cat';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase() || null;

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
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    ttl: 14 * 24 * 60 * 60,
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: 'lax',
  },
}));

app.use(flash());

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.successMessages = req.flash('success');
  res.locals.errorMessages = req.flash('error');
  next();
});

const isLoggedIn = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  req.flash('error', 'Please login first.');
  return res.redirect('/login');
};

const isAdmin = (req, res, next) => {
  if (req.session.user?.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access Denied.');
  return res.redirect('/products');
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
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

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/register', (req, res) => {
  res.render('register', { title: 'Register', errors: [], formData: {} });
});

app.post('/register', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  const errors = [];
  const formData = { name, email };

  if (!name?.trim()) errors.push('Name is required.');
  if (!email?.trim()) errors.push('Email is required.');
  if (!password) errors.push('Password is required.');
  if (password !== confirmPassword) errors.push('Passwords do not match.');

  if (errors.length) {
    return res.status(400).render('register', { title: 'Register', errors, formData });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      errors.push('Email is already registered.');
      return res.status(400).render('register', { title: 'Register', errors, formData });
    }

    const adminCount = await User.countDocuments({ role: 'admin' });
    const isAdminUser = ADMIN_EMAIL
      ? normalizedEmail === ADMIN_EMAIL
      : adminCount === 0;

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: isAdminUser ? 'admin' : 'customer',
    });

    await user.save();
    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    if (isAdminUser) {
      req.flash('success', 'Admin account created successfully. You can now access the admin panel.');
    } else {
      req.flash('success', 'Registration successful! Welcome to the store.');
    }
    return res.redirect('/products');
  } catch (err) {
    console.error('Registration error:', err);
    errors.push('Server error while creating account. Please try again.');
    return res.status(500).render('register', { title: 'Register', errors, formData });
  }
});

app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/products');
  }
  res.render('login', { title: 'Login', errors: [] });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email?.trim()) errors.push('Email is required.');
  if (!password) errors.push('Password is required.');

  if (errors.length) {
    return res.status(400).render('login', { title: 'Login', errors });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      errors.push('No account found with that email.');
      return res.status(400).render('login', { title: 'Login', errors });
    }

    const passwordValid = await user.comparePassword(password);
    if (!passwordValid) {
      req.flash('error', 'Invalid Password.');
      return res.redirect('/login');
    }

    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // Issue JWT for API consumers when Accept: application/json
    const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    if ((req.headers.accept || '').includes('application/json')) {
      return res.json({ token, user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role } });
    }

    req.flash('success', 'Welcome Back!');
    return res.redirect('/products');
  } catch (err) {
    console.error('Login error:', err);
    errors.push('Server error while logging in. Please try again.');
    return res.status(500).render('login', { title: 'Login', errors });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Unable to logout.');
    }
    res.clearCookie('connect.sid');
    return res.redirect('/login');
  });
});

app.get('/checkout', isLoggedIn, (req, res) => {
  res.render('checkout', { title: 'Checkout' });
});

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

// ── Admin Routes ─────────────────────────────────────────────────────────────────
app.get('/admin', isAdmin, (req, res) => res.redirect('/admin/products'));

app.get('/admin/products', isAdmin, async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 }).lean();
    const totalProducts = products.length;
    const totalCategories = await Product.distinct('category').then((items) => items.length);

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

app.get('/admin/products/new', isAdmin, (req, res) => {
  res.render('admin_form', {
    title: 'Add Product',
    active: 'create',
    product: {},
    errors: [],
    formAction: '/admin/products/new',
  });
});

app.post('/admin/products/new', isAdmin, upload.single('image'), async (req, res) => {
  const { name, category, price, rating, stock } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
  const errors = [];

  if (!name?.trim()) errors.push('Name is required.');
  if (!category?.trim()) errors.push('Category is required.');
  if (!price || Number.isNaN(Number(price)) || Number(price) < 0) errors.push('Price must be a positive number.');
  if (!rating || Number.isNaN(Number(rating)) || Number(rating) < 0 || Number(rating) > 5) errors.push('Rating must be a number between 0 and 5.');
  if (!stock || Number.isNaN(Number(stock)) || Number(stock) < 0) errors.push('Stock must be a non-negative integer.');

  if (errors.length > 0) {
    return res.status(400).render('admin_form', {
      title: 'Add Product',
      active: 'create',
      product: { name, category, price, rating, stock, imageUrl },
      errors,
      formAction: '/admin/products/new',
    });
  }

  try {
    const product = new Product({
      name: name.trim(),
      category: category.trim(),
      price: Number(price),
      rating: Number(rating),
      stock: Number(stock),
      imageUrl: imageUrl || 'https://via.placeholder.com/400x300?text=Product',
    });

    await product.save();
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.get('/admin/products/:id/edit', isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).send('Product not found.');
    }

    res.render('admin_form', {
      title: 'Edit Product',
      active: 'dashboard',
      product,
      errors: [],
      formAction: `/admin/products/${product._id}/edit`,
    });
  } catch (err) {
    console.error('Edit form error:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.post('/admin/products/:id/edit', isAdmin, upload.single('image'), async (req, res) => {
  const { name, category, price, rating, stock, existingImageUrl } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : existingImageUrl || '';
  const errors = [];

  if (!name?.trim()) errors.push('Name is required.');
  if (!category?.trim()) errors.push('Category is required.');
  if (!price || Number.isNaN(Number(price)) || Number(price) < 0) errors.push('Price must be a positive number.');
  if (!rating || Number.isNaN(Number(rating)) || Number(rating) < 0 || Number(rating) > 5) errors.push('Rating must be a number between 0 and 5.');
  if (!stock || Number.isNaN(Number(stock)) || Number(stock) < 0) errors.push('Stock must be a non-negative integer.');

  if (errors.length > 0) {
    return res.status(400).render('admin_form', {
      title: 'Edit Product',
      active: 'dashboard',
      product: { _id: req.params.id, name, category, price, rating, stock, imageUrl },
      errors,
      formAction: `/admin/products/${req.params.id}/edit`,
    });
  }

  try {
    await Product.findByIdAndUpdate(req.params.id, {
      name: name.trim(),
      category: category.trim(),
      price: Number(price),
      rating: Number(rating),
      stock: Number(stock),
      imageUrl: imageUrl || 'https://via.placeholder.com/400x300?text=Product',
    });
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

app.post('/admin/products/:id/delete', isAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).send('Server Error: ' + err.message);
  }
});

// ── API: JWT setup and routes (prefix: /api/v1) ────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'please-set-a-strong-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const verifyToken = (req, res, next) => {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// API: Login -> issue JWT
app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const valid = await user.comparePassword(password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ token, user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('API login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// API: Public - list products
app.get('/api/v1/products', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);
    const sort = String(req.query.sort || 'name_asc');
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const LIMIT = Math.max(parseInt(req.query.limit, 10) || 20, 1);

    const filter = {};
    if (search) filter.name = { $regex: search, $options: 'i' };
    if (category && category !== 'All') filter.category = category;
    if (!Number.isNaN(minPrice) || !Number.isNaN(maxPrice)) {
      filter.price = {};
      if (!Number.isNaN(minPrice)) filter.price.$gte = minPrice;
      if (!Number.isNaN(maxPrice)) filter.price.$lte = maxPrice;
    }

    const sortMap = {
      name_asc: { name: 1 },
      name_desc: { name: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating_desc: { rating: -1 },
    };
    const sortOption = sortMap[sort] || sortMap.name_asc;

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter).sort(sortOption).skip((page - 1) * LIMIT).limit(LIMIT).lean();

    return res.json({ data: { products, pagination: { page, limit: LIMIT, total } } });
  } catch (err) {
    console.error('API products error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// API: Public - single product
app.get('/api/v1/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    return res.json({ data: product });
  } catch (err) {
    console.error('API product detail error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// API: Protected - profile
app.get('/api/v1/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ data: user });
  } catch (err) {
    console.error('API profile error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// API: Protected - place order (stateless example)
app.post('/api/v1/orders', verifyToken, async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'Order items required' });
    // Build order items with product info and calculate total
    const resolvedItems = [];
    let total = 0;
    for (const it of items) {
      const pid = it.productId || it.product;
      const qty = Number(it.quantity) || 1;
      const product = await Product.findById(pid).lean();
      if (!product) return res.status(400).json({ error: `Product not found: ${pid}` });
      const price = Number(product.price) || 0;
      resolvedItems.push({ product: product._id, name: product.name, price, quantity: qty });
      total += price * qty;
    }

    const orderDoc = new Order({ user: req.user.id, items: resolvedItems, total });
    await orderDoc.save();
    return res.status(201).json({ data: orderDoc });
  } catch (err) {
    console.error('API place order error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// API: Register -> create user and issue JWT
app.post('/api/v1/auth/register', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body || {};
  const errors = [];
  if (!name?.trim()) errors.push('Name is required.');
  if (!email?.trim()) errors.push('Email is required.');
  if (!password) errors.push('Password is required.');
  if (password !== confirmPassword) errors.push('Passwords do not match.');
  if (errors.length) return res.status(400).json({ errors });

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const adminCount = await User.countDocuments({ role: 'admin' });
    const isAdminUser = ADMIN_EMAIL ? normalizedEmail === ADMIN_EMAIL : adminCount === 0;

    const user = new User({ name: name.trim(), email: normalizedEmail, password, role: isAdminUser ? 'admin' : 'customer' });
    await user.save();

    const token = jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.status(201).json({ token, user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('API register error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('*', (req, res) => res.redirect('/products'));

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
