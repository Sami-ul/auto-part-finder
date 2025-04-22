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

/* Connect to DB */
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials'
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
  let vehicle = getVehicleCookie(req.cookies);
  console.log(vehicle);
  res.render('pages/discover', {noquery: 'true', vehicleBadge: vehicle == null ? '' : vehicle});
});

// search

app.get('/search', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.redirect('/discover');
  }
  const page = parseInt(req.query.page, 10) || 1;
  const limit = 12;
  const offset = (page > 0 ? page - 1 : 0) * limit;
  let vehicle = getVehicleCookie(req.cookies);
  let countSql = '';
  let dataSql = '';
  let countParams = [];
  let dataParams = [];
  const queryParam = `%${query}%`;

  try {
    if (vehicle) {
      countSql = `
        SELECT COUNT(DISTINCT p.id) AS total_count
        FROM parts p
        JOIN parts_compatibility pc ON p.id = pc.part_id
        JOIN vehicles v ON pc.vehicle_id = v.id
        JOIN pricing pr ON p.id = pr.part_id
        WHERE (p.name ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%' OR p.pack ILIKE '%' || $1 || '%' OR p.fits ILIKE '%' || $1 || '%')
          AND (v.make = $2 AND v.year = $3 AND v.model = $4 AND v.engine = $5);
      `;
      dataSql = `
        SELECT DISTINCT p.id, p.name, p.brand, p.partnumber, p.description, p.pack, p.fits, pr.price, p.thumbimg
        FROM parts p
        JOIN parts_compatibility pc ON p.id = pc.part_id
        JOIN vehicles v ON pc.vehicle_id = v.id
        JOIN pricing pr ON p.id = pr.part_id
        WHERE (p.name ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%' OR p.pack ILIKE '%' || $1 || '%' OR p.fits ILIKE '%' || $1 || '%')
          AND (v.make = $2 AND v.year = $3 AND v.model = $4 AND v.engine = $5)
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
        SELECT COUNT(DISTINCT p.id) AS total_count
        FROM parts p
        JOIN pricing pr ON p.id = pr.part_id
        WHERE (p.name ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%' OR p.pack ILIKE '%' || $1 || '%' OR p.fits ILIKE '%' || $1 || '%');
      `;
      dataSql = `
        SELECT DISTINCT p.id, p.name, p.brand, p.partnumber, p.description, p.pack, p.fits, pr.price, p.thumbimg
        FROM parts p
        JOIN pricing pr ON p.id = pr.part_id
        WHERE (p.name ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%' OR p.pack ILIKE '%' || $1 || '%' OR p.fits ILIKE '%' || $1 || '%')
        LIMIT $2 OFFSET $3;
      `;
      countParams = [queryParam];
      dataParams = [...countParams, limit, offset];
    }

    const countResult = await db.one(countSql, countParams);
    const totalCount = parseInt(countResult.total_count, 10) || 0;

    let products = [];
    let pagination = {};
    let noResults = 'true';

    if (totalCount > 0 && offset < totalCount) {
       products = await db.any(dataSql, dataParams);
       if (products && products.length > 0) {
          noResults = '';
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
        noResults: noResults,
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
      'SELECT p.id, p.name, p.description FROM cart c JOIN parts p ON c.product_id = p.id WHERE c.user_id = $1',
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
  
  const { product_id } = req.body;
  if (!product_id) {
    return res.status(400).json({ error: 'Part ID is required' });
  }
  
  const user_id = req.session.user.id;
  
  db.oneOrNone('SELECT * FROM cart WHERE user_id = $1 AND product_id = $2', [user_id, product_id])
    .then(existingItem => {
      if (existingItem) {
        return Promise.reject({ status: 400, message: 'Product already in cart' });
      }
      
      return db.none('INSERT INTO cart (user_id, product_id) VALUES ($1, $2)', [user_id, product_id]);
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
  const { product_id } = req.query;
  if (!product_id) {
    return res.status(400).json({ error: 'Part ID is required' });
  }
  const user_id = req.session.user.id;
  db.none('DELETE FROM cart WHERE user_id = $1 AND product_id = $2', [user_id, product_id])
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

  console.log(addresses)

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

app.get('/checkout', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  } else {
    const user_id = req.session.user.id;
    try {
      // Fetch cart items with product details
      const cartItems = await db.any(
        'SELECT p.id, p.name, p.description, pri.price FROM cart c JOIN parts p ON c.product_id = p.id JOIN pricing pri ON p.id = pri.part_id WHERE c.user_id = $1 and pri.vendor_id = 1',
        [user_id]
      );

      console.log(cartItems);
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
        cartSum: cartSum
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
    return res.redirect('/discover');
  }
  // saving vehicle addition into db
  db.any('SELECT * FROM user_vehicles WHERE user_id = $1', [req.session.user.id])
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

  db.one(
    'INSERT INTO user_vehicles(user_id, make, model, year, engine) VALUES($1, $2, $3, $4, $5) RETURNING id',
    [req.session.user.id, make, model, year, engine]
  )
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
      res.status(500).json({ error: 'Failed to add vehicle', details: error.message });
    });
});

// To edit vehicle on profile and database
app.put('/api/vehicles/:id', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { year, make, model, engine } = req.body;

  db.none('UPDATE user_vehicles SET make=$1, model=$2, year=$3, engine=$4 WHERE id=$5 AND user_id=$6',
    [make, model, year, engine, req.params.id, req.session.user.id]
  )
    .then(() => {
      res.json({ success: true });
    })
    .catch(error => {
      console.log(error);
      res.status(500).json({ error: 'Failed to update vehicle' });
    });
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

  console.log(addresses)

  let needsDefault = false;

  if (addresses.length == 0) {
    needsDefault = true;
  }

  return res.render('pages/address', { needsDefault: needsDefault })
});

app.post('/address', async (req, res) => {
  console.log("POSTED ADRESS BODY", req.body)

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
