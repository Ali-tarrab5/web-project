const express      = require('express');
const path         = require('path');
const { products } = require('./data/products');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── View engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Static files (serves index.html, style.css, script.js, images) ───────────
app.use(express.static(path.join(__dirname)));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.redirect('/products');
});

app.get('/products', (req, res) => {
  try {
    const LIMIT = 8;

    // -- Parse query params ---------------------------------------------------
    const search      = String(req.query.search   || '').trim();
    const category    = String(req.query.category || '').trim();
    const minPriceRaw = String(req.query.minPrice || '').trim();
    const maxPriceRaw = String(req.query.maxPrice || '').trim();
    const sort        = String(req.query.sort     || 'name_asc');
    let   page        = Math.max(parseInt(req.query.page, 10) || 1, 1);

    // -- Build filtered product list -----------------------------------------
    const filteredProducts = products.filter((product) => {
      if (search && !product.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (category && category !== 'All' && product.category !== category) {
        return false;
      }

      const price = Number(product.price);
      const min = parseFloat(minPriceRaw);
      const max = parseFloat(maxPriceRaw);

      if (minPriceRaw && !isNaN(min) && price < min) {
        return false;
      }
      if (maxPriceRaw && !isNaN(max) && price > max) {
        return false;
      }
      return true;
    });

    // -- Sort filtered products ----------------------------------------------
    const sortMap = {
      name_asc:    (a, b) => a.name.localeCompare(b.name),
      name_desc:   (a, b) => b.name.localeCompare(a.name),
      price_asc:   (a, b) => a.price - b.price,
      price_desc:  (a, b) => b.price - a.price,
      rating_desc: (a, b) => b.rating - a.rating,
    };
    const sorter = sortMap[sort] || sortMap.name_asc;
    filteredProducts.sort(sorter);

    // -- Pagination math ------------------------------------------------------
    const totalProducts = filteredProducts.length;
    const totalPages    = Math.max(Math.ceil(totalProducts / LIMIT), 1);
    if (page > totalPages) page = totalPages;

    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
    const pagedProducts = filteredProducts.slice((page - 1) * LIMIT, page * LIMIT);

    // -- Categories list ------------------------------------------------------
    const categories = [...new Set(products.map((product) => product.category))].sort();

    res.render('products', {
      products: pagedProducts,
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
