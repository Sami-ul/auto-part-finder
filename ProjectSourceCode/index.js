/* Import Dependencies */
const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const stripe = require('stripe')(`${process.env.STRIPE_SECRET_KEY}`, {
  apiVersion: "2025-03-31.basil",
});

/* Connect to DB */
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',

});

const dbConfig = {
  host: process.env.POSTGRES_HOST || 'db',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD
};

const db = pgp(dbConfig);

db.connect()
  .then(obj => {
    console.log('Database connection successful');
    obj.done();
  })
  .catch(error => {
    console.log('ERROR', error);
  });

/* App Settings */
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static('./'));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
    // Keeps user logged in
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

// Middleware for the user session to correctly render hbs
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
})

/* Get vehicle cookie */
function getVehicleCookie(cookies) {
  const vehicleCookie = 'currentVehicle';
  try {
    const vehicleCookieValue = cookies ? cookies[vehicleCookie] : null;
    if (vehicleCookieValue) {
      const decodedJson = decodeURIComponent(vehicleCookieValue);
      return JSON.parse(decodedJson);
    }
    return null;
  } catch (err) {
    console.error("Error parsing vehicle data from req.cookies:", err);
    return null;
  }
}

/* Routes */

app.get('/login', (req, res) => {
  res.render('pages/login');
});

app.post('/login', async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;

  try {
    const query = 'SELECT * FROM users WHERE username = $1';
    let user = await db.one(query, [username]);

    const match = await bcrypt.compare(password, user.password);

    if (match) {
      req.session.user = user;
      req.session.save();
      res.redirect('/');
    } else {
      res.render('pages/login', {
        error: true,
        message: 'Password does not match'
      });
    }
  } catch (err) {
    res.render('pages/login', {
      error: true,
      message: 'User not found'
    });
  }
});

app.get('/discover', async (req, res) => {
  const query = req.query.query || '';
  const page = parseInt(req.query.page, 10) || 1;
  const limit = 12;
  const offset = (page > 0 ? page - 1 : 0) * limit;
  let vehicle = getVehicleCookie(req.cookies);
  let countSql = '';
  let dataSql = '';
  let countParams = [];
  let dataParams = [];
  let products = [];
  let pagination = {};
  let noResults = true;
  let userVehicles = [];
  const queryParam = `%${query}%`;
  let orderedBy = ` ORDER BY p.id ASC, vdr.name ASC`;

  if (req.session.user) {
    const userId = req.session.user.id;
    userVehicles = await db.any('SELECT v.id, v.make, v.year, v.engine, v.model FROM user_vehicles uv JOIN vehicles v ON uv.vehicle_id = v.id WHERE uv.user_id = $1', [userId]);
  }

  try {

    if (vehicle) {
      if (query) {
        orderedBy = ` ORDER BY p.id ASC, pr.price ASC`;
        countSql = `
          SELECT COUNT(pr.id) AS total_count
          FROM parts p
          JOIN parts_compatibility AS pc ON p.id = pc.part_id
          JOIN vehicles AS v ON pc.vehicle_id = v.id
          JOIN pricing AS pr ON p.id = pr.part_id
          JOIN vendors vdr ON pr.vendor_id = vdr.id
          WHERE (p.name ILIKE $1 OR p.description ILIKE $1 OR p.pack ILIKE $1 OR p.fits ILIKE $1 OR p.brand ILIKE $1)
            AND (v.make = $2 AND v.year = $3 AND v.model = $4 AND v.engine = $5);
        `;
        dataSql = `
          SELECT
              p.id, p.name, p.brand, p.partnumber, p.description, p.pack, p.fits,
              vdr.id AS vendor_id,
              pr.id AS pricing_id,
              vdr.name AS vendor_name,
              pr.price,
              p.compatible_vehicles,
              p.thumbimg
          FROM parts p
          JOIN parts_compatibility AS pc ON p.id = pc.part_id
          JOIN vehicles AS v ON pc.vehicle_id = v.id
          JOIN pricing AS pr ON p.id = pr.part_id
          JOIN vendors vdr ON pr.vendor_id = vdr.id
          WHERE (p.name ILIKE $1 OR p.description ILIKE $1 OR p.pack ILIKE $1 OR p.fits ILIKE $1 OR p.brand ILIKE $1)
            AND (v.make = $2 AND v.year = $3 AND v.model = $4 AND v.engine = $5)
          ${orderedBy}
          LIMIT $6 OFFSET $7;
        `;
        countParams = [
          queryParam,
          vehicle.make,
          parseInt(vehicle.year, 10),
          vehicle.model,
          vehicle.engine
        ];
        dataParams = [...countParams, limit, offset];
      } else {
        countSql = `
          SELECT COUNT(pr.id) AS total_count
          FROM parts p
          JOIN parts_compatibility AS pc ON p.id = pc.part_id
          JOIN vehicles AS v ON pc.vehicle_id = v.id
          JOIN pricing AS pr ON p.id = pr.part_id
          JOIN vendors vdr ON pr.vendor_id = vdr.id
          WHERE v.make = $1 AND v.year = $2 AND v.model = $3 AND v.engine = $4;
        `;
        dataSql = `
          SELECT
              p.id, p.name, p.brand, p.partnumber, p.description, p.pack, p.fits,
              vdr.id AS vendor_id,
              vdr.name AS vendor_name,
              pr.id AS pricing_id,
              pr.price,
              p.compatible_vehicles,
              p.thumbimg
          FROM parts p
          JOIN parts_compatibility AS pc ON p.id = pc.part_id
          JOIN vehicles AS v ON pc.vehicle_id = v.id
          JOIN pricing AS pr ON p.id = pr.part_id
          JOIN vendors vdr ON pr.vendor_id = vdr.id
          WHERE v.make = $1 AND v.year = $2 AND v.model = $3 AND v.engine = $4
          ${orderedBy}
          LIMIT $5 OFFSET $6;
        `;
        countParams = [
          vehicle.make,
          parseInt(vehicle.year, 10),
          vehicle.model,
          vehicle.engine
        ];
        dataParams = [...countParams, limit, offset];
      }
    } else {
      if (query) {
        orderedBy = ` ORDER BY p.id ASC, pr.price ASC`;
        countSql = `
          SELECT COUNT(pr.id) AS total_count
          FROM parts p
          JOIN pricing AS pr ON p.id = pr.part_id
          JOIN vendors vdr ON pr.vendor_id = vdr.id
          WHERE (p.name ILIKE $1 OR p.description ILIKE $1 OR p.pack ILIKE $1 OR p.fits ILIKE $1 OR p.brand ILIKE $1);
        `;
        dataSql = `
          SELECT
              p.id, p.name, p.brand, p.partnumber, p.description, p.pack, p.fits,
              vdr.id AS vendor_id,
              vdr.name AS vendor_name,
              pr.id AS pricing_id,
              pr.price,
              p.compatible_vehicles,
              p.thumbimg
          FROM parts p
          JOIN pricing AS pr ON p.id = pr.part_id
          JOIN vendors vdr ON pr.vendor_id = vdr.id
          WHERE (p.name ILIKE $1 OR p.description ILIKE $1 OR p.pack ILIKE $1 OR p.fits ILIKE $1 OR p.brand ILIKE $1)
          ${orderedBy}
          LIMIT $2 OFFSET $3;
        `;
        countParams = [queryParam];
        dataParams = [...countParams, limit, offset];
      } else {
        countSql = `
          SELECT COUNT(pr.id) AS total_count
          FROM parts p
          JOIN pricing AS pr ON p.id = pr.part_id
          JOIN vendors vdr ON pr.vendor_id = vdr.id
          WHERE 1=1;
        `;
        dataSql = `
          SELECT
              p.id, p.name, p.brand, p.partnumber, p.description, p.pack, p.fits,
              vdr.id AS vendor_id,
              vdr.name AS vendor_name,
              pr.id AS pricing_id,
              pr.price,
              p.compatible_vehicles,
              p.thumbimg
          FROM parts p
          JOIN pricing AS pr ON p.id = pr.part_id
          JOIN vendors vdr ON pr.vendor_id = vdr.id
          WHERE 1=1
          ${orderedBy}
          LIMIT $1 OFFSET $2;
        `;
        countParams = [];
        dataParams = [limit, offset];
      }
    }

    const countResult = await db.one(countSql, countParams);
    const totalCount = parseInt(countResult.total_count, 10) || 0;

    if (totalCount > 0 && offset < totalCount) {
      products = await db.any(dataSql, dataParams);
      if (products && products.length > 0) {
        noResults = false;
        products.forEach(product => {
          if (product && Array.isArray(product.compatible_vehicles)) {
            const uniqueMakes = Array.from(
              new Set(
                product.compatible_vehicles
                  .map(vehicle => vehicle?.make)
                  .filter(make => make)
              )
            );
            product.compatible_vehicles = uniqueMakes;
          } else if (product) {
            product.compatible_vehicles = [];
          }
        });
      } else {
        products = [];
        noResults = true;
      }
    } else {
      products = [];
      noResults = true;
    }

    const totalPages = Math.ceil(totalCount / limit);
    const hasPreviousPage = page > 1;
    const hasNextPage = page < totalPages;
    const previousPage = hasPreviousPage ? page - 1 : null;
    const nextPage = hasNextPage ? page + 1 : null;

    pagination = {
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalCount,
      limit: limit,
      hasPreviousPage: hasPreviousPage,
      hasNextPage: hasNextPage,
      previousPage: previousPage,
      nextPage: nextPage,
    };

    res.render('pages/discover', {
      searchQuery: query,
      products: products,
      pagination: products.length > 0 ? pagination : null,
      noResults: noResults,
      vehicleBadge: vehicle || null,
      userVehicles: userVehicles
    });

  } catch (error) {
    console.error('Error in /discover route:', error);
    res.render('pages/discover', {
      searchQuery: query,
      products: [],
      pagination: null,
      error: 'Failed to load parts. Please try again.',
      noResults: true,
      vehicleBadge: vehicle || null,
      userVehicles: userVehicles
    });
  }
});


app.get('/search', async (req, res) => {
  const { query } = req.query;
  const priceMin = req.query.pricemin;
  const priceMax = req.query.pricemax;
  const selectedVendors = req.query.vendors;

  let priceFilter = ``;
  let vendorFilter = ``;
  let orderedBy = ` ORDER BY p.id ASC, vdr.name ASC`;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = 12;
  const offset = (page > 0 ? page - 1 : 0) * limit;
  let vehicle = getVehicleCookie(req.cookies);
  let countSql = '';
  let dataSql = '';
  let countParams = [];
  let dataParams = [];
  const queryParam = query ? `%${query}%` : '%';
  let products = [];
  let pagination = {};
  let noResults = 'true';

  try {
    if (priceMin > 0) { priceFilter = priceFilter + ` AND pr.price >= ${priceMin}`; }
    if (priceMax > 0) { priceFilter = priceFilter + ` AND pr.price <= ${priceMax}`; }
    if (priceFilter) { orderedBy = ` ORDER BY p.id ASC, pr.price ASC`; }

    if (vehicle) {
      countSql = `
        SELECT COUNT(pr.id) AS total_count
        FROM parts p
        JOIN parts_compatibility pc ON p.id = pc.part_id
        JOIN vehicles v ON pc.vehicle_id = v.id
        JOIN pricing pr ON p.id = pr.part_id
        JOIN vendors vdr ON pr.vendor_id = vdr.id
        WHERE (p.name ILIKE $1 OR p.description ILIKE $1 OR p.pack ILIKE $1 OR p.fits ILIKE $1 OR p.brand ILIKE $1)
          AND (v.make = $2 AND v.year = $3 AND v.model = $4 AND v.engine = $5)${priceFilter};
      `;
      dataSql = `
        SELECT
            p.id, p.name, p.brand, p.partnumber, p.description, p.pack, p.fits,
            vdr.id AS vendor_id,
            vdr.name AS vendor_name,
            pr.id AS pricing_id,
            pr.price,
            p.compatible_vehicles,
            p.thumbimg
        FROM parts p
        JOIN parts_compatibility pc ON p.id = pc.part_id
        JOIN vehicles v ON pc.vehicle_id = v.id
        JOIN pricing pr ON p.id = pr.part_id
        JOIN vendors vdr ON pr.vendor_id = vdr.id
        WHERE (p.name ILIKE $1 OR p.description ILIKE $1 OR p.pack ILIKE $1 OR p.fits ILIKE $1 OR p.brand ILIKE $1)
          AND (v.make = $2 AND v.year = $3 AND v.model = $4 AND v.engine = $5)${priceFilter}
        ${orderedBy}
        LIMIT $6 OFFSET $7;
      `;
      countParams = [
        queryParam,
        vehicle.make,
        parseInt(vehicle.year, 10),
        vehicle.model,
        vehicle.engine,
      ];
      dataParams = [...countParams, limit, offset];
    } else {
      countSql = `
        SELECT COUNT(pr.id) AS total_count
        FROM parts p
        JOIN pricing pr ON p.id = pr.part_id
        JOIN vendors vdr ON pr.vendor_id = vdr.id
        WHERE (p.name ILIKE $1 OR p.description ILIKE $1 OR p.pack ILIKE $1 OR p.fits ILIKE $1 OR p.brand ILIKE $1)${priceFilter};
      `;
      dataSql = `
        SELECT
            p.id, p.name, p.brand, p.partnumber, p.description, p.pack, p.fits,
            vdr.id AS vendor_id,
            vdr.name AS vendor_name,
            pr.id AS pricing_id,
            pr.price,
            p.compatible_vehicles,
            p.thumbimg
        FROM parts p
        JOIN pricing pr ON p.id = pr.part_id
        JOIN vendors vdr ON pr.vendor_id = vdr.id
        WHERE (p.name ILIKE $1 OR p.description ILIKE $1 OR p.pack ILIKE $1 OR p.fits ILIKE $1 OR p.brand ILIKE $1)${priceFilter}
        ${orderedBy}
        LIMIT $2 OFFSET $3;
      `;
      countParams = [queryParam];
      dataParams = [...countParams, limit, offset];
    }

    const countResult = await db.one(countSql, countParams);
    const totalCount = parseInt(countResult.total_count, 10) || 0;

    if (totalCount > 0 && offset < totalCount) {
      products = await db.any(dataSql, dataParams);
      if (products && products.length > 0) {
        noResults = '';
        products.forEach(product => {
          if (product && Array.isArray(product.compatible_vehicles)) {
            const uniqueMakes = Array.from(
              new Set(
                product.compatible_vehicles
                  .map(vehicle => vehicle?.make)
                  .filter(make => make)
              )
            );
            product.compatible_vehicles = uniqueMakes;
          } else if (product) {
            product.compatible_vehicles = [];
          }
        });
      } else {
         products = [];
         noResults = 'true';
      }
    } else {
      products = [];
      noResults = 'true';
    }

    const totalPages = Math.ceil(totalCount / limit);
    const hasPreviousPage = page > 1;
    const hasNextPage = page < totalPages;
    const previousPage = hasPreviousPage ? page - 1 : null;
    const nextPage = hasNextPage ? page + 1 : null;

    pagination = {
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalCount,
      limit: limit,
      hasPreviousPage: hasPreviousPage,
      hasNextPage: hasNextPage,
      previousPage: previousPage,
      nextPage: nextPage,
    };

    res.render('pages/discover', {
      searchQuery: query,
      priceMin: priceMin ? priceMin : undefined,
      priceMax: priceMax ? priceMax : undefined,
      products: products,
      pagination: products.length > 0 ? pagination : '',
      noResults: noResults,
      vehicleBadge: vehicle == null ? '' : vehicle
    });

  } catch (error) {
    console.error('Error in /search route:', error);
    res.render('pages/discover', {
      searchQuery: query,
      products: [],
      pagination: {},
      error: 'Search failed. Please try again.',
      noResults: 'true',
      vehicleBadge: vehicle == null ? '' : vehicle
    });
  }
});


app.get('/logout', (req, res) => {
  if (req.session.user) {
    req.session.destroy((err) => {
      if (err) {
        console.log(err);
        return res.redirect('/');
      }
      res.clearCookie('connect.sid');
      res.render('pages/logout', {
        message: "Logged out successfully!",
        user: null
      });
    });
  }
  else {
    res.redirect('/login');
  }
});

app.get('/cart', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  const user_id = req.session.user.id;
  try {
    // Fetch cart items with product details
    const cartItems = await db.any(
      'SELECT pri.id, p.name, p.description, pri.price, vdr.name as vendor_name FROM cart c JOIN pricing pri ON c.pricing_id = pri.id JOIN parts p ON p.id = pri.part_id JOIN vendors vdr ON pri.vendor_id = vdr.id WHERE c.user_id = $1',
      [user_id]
    );

    // Render the cart page with the cart items
    return res.render('pages/cart', {
      cartItems: cartItems,
      hasItems: cartItems.length > 0
    });
  } catch (error) {
    console.error('Error fetching cart items:', error);
    return res.render('pages/cart', {
      error: 'Failed to load cart items',
      hasItems: false
    });
  }
});

app.post('/cart/add', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const { pricing_id } = req.body;
 
  const user_id = req.session.user.id;
  db.oneOrNone('SELECT * FROM cart WHERE user_id = $1 AND pricing_id = $2', [user_id, pricing_id])
  .then(existingItem => {
    if (existingItem) {
      return Promise.reject({ status: 400, message: 'Product already in cart' });
    }

    return db.none('INSERT INTO cart (user_id, pricing_id) VALUES ($1, $2)', [user_id, pricing_id]);
  })
  .then(() => {
    res.status(200).json({ success: true });
  })
  .catch(error => {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Error in cart operation:', error);
    res.status(500).json({ error: 'Failed to process cart operation' });
  });

});

app.delete('/cart/remove', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const { pricing_id } = req.query;
  if (!pricing_id) {
    return res.status(400).json({ error: 'Pricing ID is required' });
  }
  const user_id = req.session.user.id;
  db.none('DELETE FROM cart WHERE user_id = $1 AND pricing_id = $2', [user_id, pricing_id])
    .then(() => {
      res.status(200).json({ success: true });
    })
    .catch(error => {
      console.error('Error adding to cart:', error);
      res.status(500).json({ error: 'Failed to add to cart' });
    });
});


//register API testcase
app.get('/register', (req, res) => {
  res.render('pages/register');
});

//register API testcase
app.post('/register', async (req, res) => {
  const { email, username, password } = req.body;
  // regex email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).render('pages/register', {
      message: 'Invalid email address'
    });
  }
  // regex username validation
  const usernameRegex = /^[a-zA-Z0-9-_]+$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).render('pages/register', {
      message: 'Invalid username'
    });
  }
  // regex password validation
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).render('pages/register', {
      message: 'Password must be at least 8 characters long and contain at least one letter and one number'
    });
  }
  // check if email already exists
  const existingUser = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
  if (existingUser) {
    return res.status(400).render('pages/register', {
      message: 'Email already exists'
    });
  }
  // check if username already exists
  const existingUsername = await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);
  if (existingUsername) {
    return res.status(400).render('pages/register', {
      message: 'Username already exists'
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  db.none('INSERT INTO users(email, username, password) VALUES($1, $2, $3)', [email, username, hashedPassword])
    .then(() => {
      res.status(302).redirect('/login');
    })
    .catch(error => {
      console.log(error);
      res.status(500).render('pages/register', {
        message: 'Error registering user'
      });
    });
});

app.get('/account', async (req, res) => {
  if (!req.session.user) {
    return res.render('pages/login');
  }

  let addresses = []
  let list_addresses = []

  try {
    def_address = await db.any('SELECT * from addresses WHERE user_id = $1 AND is_default = TRUE', [req.session.user.id])
    list_addresses = await db.any('SELECT * FROM addresses WHERE user_id = $1 ANd is_default = FALSE', [req.session.user.id])
  }
  catch (err) {
    res.status(500).render('pages/account', {
      message: 'Error accessing user\'s addresses',
      error: true
    });
  }

  return res.render('pages/account', {
    def_address: def_address,
    list_addresses: list_addresses
  })
});

app.post('/account/edit', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const userId = req.session.user.id;
  const { username, email, addressId } = req.body;

  try {
    // Handle username and email updates
    if (username || email) {
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (username) {
        // Username validation
        const usernameRegex = /^[a-zA-Z0-9-_]+$/;
        if (!usernameRegex.test(username)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid username format'
          });
        }

        // Check if username already exists
        const existingUsername = await db.oneOrNone('SELECT * FROM users WHERE username = $1 AND id != $2', [username, userId]);
        if (existingUsername) {
          return res.status(400).json({
            success: false,
            error: 'Username already exists'
          });
        }

        updateFields.push(`username = $${paramCount++}`);
        updateValues.push(username);
      }

      if (email) {
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid email address'
          });
        }

        // Check if email already exists
        const existingEmail = await db.oneOrNone('SELECT * FROM users WHERE email = $1 AND id != $2', [email, userId]);
        if (existingEmail) {
          return res.status(400).json({
            success: false,
            error: 'Email already exists'
          });
        }

        updateFields.push(`email = $${paramCount++}`);
        updateValues.push(email);
      }

      if (updateFields.length > 0) {
        updateValues.push(userId);
        await db.none(`UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount}`, updateValues);

        // Update the session with new user info
        const updatedUser = await db.one('SELECT id, username, email FROM users WHERE id = $1', [userId]);
        req.session.user = updatedUser;
      }
    }

    // Handle address update
    if (addressId) {
      // First, set all addresses to non-default
      await db.none('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);

      // Then set the selected address as default
      await db.none('UPDATE addresses SET is_default = true WHERE id = $1 AND user_id = $2', [addressId, userId]);
    }

    // Return success JSON response
    return res.json({
      success: true,
      message: 'Account updated successfully'
    });
  } catch (error) {
    console.error('Error updating account:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update account'
    });
  }
});

app.post("/create-checkout-session", async (req, res) => {
  const { amount, description = "Auto Parts Order" } = req.body;
  
  const amountInCents = Math.round(parseFloat(amount) * 100);
  
  const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
  const host = req.get('host');
  const returnUrl = `${protocol}://${host}/success`;
  
  const session = await stripe.checkout.sessions.create({
    ui_mode: "custom",
    customer_email: req.session.user.email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: description,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    payment_method_types: ['card'],
    return_url: returnUrl
  });

  res.json({ clientSecret: session.client_secret });
});

app.get('/success', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  db.none('DELETE FROM cart WHERE user_id = $1', [req.session.user.id])
    .then(() => {
      res.render('pages/success');
    })
});

app.get('/checkout', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  } else {
    const user_id = req.session.user.id;
    try {
      // Fetch cart items with product details
      const cartItems = await db.any(
        'SELECT pri.id, p.name, p.description, pri.price, vdr.name as vendor_name FROM cart c JOIN pricing pri ON c.pricing_id = pri.id JOIN parts p ON p.id = pri.part_id JOIN vendors vdr ON pri.vendor_id = vdr.id WHERE c.user_id = $1',
        [user_id]
      );

      let cartSum = 0;
      cartItems.forEach(item => {
        cartSum += parseFloat(item.price);
      });


      const addresses = await db.any('SELECT * FROM addresses WHERE user_id = $1', [user_id]);
  
      // Render the cart page with the cart items
      return res.render('pages/checkout', {
        cartItems: cartItems,
        hasItems: cartItems.length > 0,
        amtItems: cartItems.length,
        addresses: addresses,
        cartSum: cartSum,
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY
      });
    } catch (error) {
      console.error('Error fetching cart items:', error);
      return res.render('pages/checkout', {
        error: 'Failed to load cart items',
        hasItems: false
      });
    }

  }
});

app.get('/mycars', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  // db.none('INSERT INTO user_vehicles(user_id, vehicle_id) VALUES($1, $2)', [req.session.user.id, 1])
  // saving vehicle addition into db
  db.any('SELECT uv.id, v.make, v.year, v.engine, v.model FROM user_vehicles uv JOIN vehicles v ON uv.vehicle_id = v.id WHERE user_id = $1', [req.session.user.id])
    .then(cars => {
      res.render('pages/mycars', { cars: cars });
    })
    .catch(error => {
      console.error('Error loading vehicles:', error);
      res.render('pages/mycars', {
        message: 'Error loading your vehicles',
        cars: []
      });
    });
});

// Vehicle data route from csv
app.get('/vehicle-data', async (req, res) => {
  try {
    const query = 'SELECT DISTINCT make, year, model, engine FROM vehicles ORDER BY make ASC';
    const result = await db.any(query);

    // For csv mapping
    const data = result.map(row => [
      row.make,
      row.year,
      row.model,
      row.engine
    ]);

    res.json(data);
  } catch (error) {
    console.error('Error fetching vehicle data:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle data' });
  }
});

// To add vehicle to profile and database
app.post('/api/vehicles', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { year, make, model, engine } = req.body;

  // Add validation
  if (!year || !make || !model || !engine) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  console.log('Attempting to add vehicle:', {
  user_id: req.session.user.id,
  make,
  model,
  year,
  engine
});

// First query: Get vehicle_id by make, model, year, engine
db.oneOrNone(
  'SELECT id FROM vehicles WHERE make = $1 AND model = $2 AND year = $3 AND engine = $4',
  [make, model, year, engine]
)
  .then(vehicle => {
    let vehicleId;
    
    if (vehicle) {
      // If vehicle exists, use its ID
      vehicleId = vehicle.id;
      return vehicleId;
    } else {
      return res.status(500).json({ error: 'Failed to add vehicle', success: false,});
    }
  })
  .then(vehicleId => {
    // Second query: Insert into user_vehicles association table
    return db.one(
      'INSERT INTO user_vehicles(user_id, vehicle_id) VALUES($1, $2) RETURNING id',
      [req.session.user.id, vehicleId]
    );
  })
  .then(data => {
    console.log('Successfully added vehicle:', data);
    res.json({
      success: true,
      id: data.id,
      vehicle: { id: data.id, year, make, model, engine }
    });
  })
  .catch(error => {
    console.error('Database error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      detail: error.detail
    });
    res.status(500).json({ error: 'Failed to add vehicle', details: error.message, success: false,});
  });
});

// To edit vehicle on profile and database
app.put('/api/vehicles/:id', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const userCarId = parseInt(req.params.id);

  const { make, model, year, engine } = req.body;

  db.oneOrNone(
    'SELECT id FROM vehicles WHERE make = $1 AND model = $2 AND year = $3 AND engine = $4',
    [make, model, year, engine]
  ).then(vehicle => {
    if (vehicle) {
      // If vehicle exists, use its ID
      newVehicleId = vehicle.id;
      db.one(
        'UPDATE user_vehicles SET vehicle_id = $1 WHERE id = $2 AND user_id = $3 RETURNING id',
        [newVehicleId, userCarId, req.session.user.id]
      )
      .then(() => {
        res.json({
          success: true,
        });
      })
      .catch(error => {
        console.error('Error updating vehicle:', error);
        res.status(500).json({ error: 'Failed to update vehicle' });
      });
    }
    else {
      return res.status(400).json({ error: 'Invalid input data' });
    }
  })

});

// To delete vehicle from profile and database
app.delete('/api/vehicles/:id', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  const vehicleId = parseInt(req.params.id);
  if (isNaN(vehicleId)) {
    return res.status(400).json({ success: false, error: 'Invalid vehicle ID' });
  }

  db.none('DELETE FROM user_vehicles WHERE id = $1 AND user_id = $2',
    [vehicleId, req.session.user.id])
    .then(() => {
      res.json({ success: true });
    })
    .catch(error => {
      console.error('Error deleting vehicle:', error);
      res.status(500).json({ success: false, error: 'Failed to delete vehicle' });
    });
});

app.get('/address', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  let addresses = []
  try {
    addresses = await db.any('SELECT * from addresses WHERE user_id = $1 AND is_default = TRUE', [req.session.user.id])
  }
  catch (err) {
    res.status(500).render('pages/address', {
      message: 'Error accessing user\'s addresses',
      error: true
    });
  }


  let needsDefault = false;

  if (addresses.length == 0) {
    needsDefault = true;
  }

  return res.render('pages/address', { needsDefault: needsDefault })
});

app.post('/address', async (req, res) => {
  const { street_address, apartment, city, state, postal_code, country, default_address, default_address_visible } = req.body;
  const user_id = req.session.user.id;
  let default_addr;
  let apt = apartment || null;
  if (default_address || default_address_visible) {
    default_addr = true
  }
  else {
    default_addr = false
  }

  let existingAddressQuery;
  let queryParams;

  if (apt === null) {
    existingAddressQuery = 'SELECT * FROM addresses WHERE user_id = $1 AND street_address = $2 AND apt IS NULL AND city = $3 AND state = $4 AND country = $5 AND postal_code = $6;';
    queryParams = [user_id, street_address, city, state, country, postal_code];
  } else {
    existingAddressQuery = 'SELECT * FROM addresses WHERE user_id = $1 AND street_address = $2 AND apt = $3 AND city = $4 AND state = $5 AND country = $6 AND postal_code = $7;';
    queryParams = [user_id, street_address, apt, city, state, country, postal_code];
  }


  let addressExistsForUser = await db.any(existingAddressQuery, queryParams);
  if (addressExistsForUser.length == 0) {
    addressExistsForUser = null;
  }

  if (addressExistsForUser) {
    return res.status(400).render('pages/address', {
      message: 'Address already exists for this user',
      error: true
    });
  }

  if (default_addr) {
    db.none('UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default = true', [user_id])
      .catch(error => {
        console.log(error);
        res.status(500).render('pages/address', {
          message: 'Error updating default address',
          error: true
        });
      });
  }

  db.none('INSERT INTO addresses (user_id, street_address, apt, city, state, postal_code, country, is_default) VALUES($1, $2, $3, $4, $5, $6, $7, $8);',
    [user_id, street_address, apt, city, state, postal_code, country, default_addr])
    .then(() => {
      res.status(200).render('pages/address', {
        message: 'Address successfully added'
      });
    })
    .catch(error => {
      console.log(error);
      res.status(500).render('pages/address', {
        message: 'Error adding address'
      });
    });
});

app.get('/', (req, res) => {
  res.redirect('/discover');
});

app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});

/* Start Server */
module.exports = app.listen(3000);

console.log('Server is listening on port 3000');
