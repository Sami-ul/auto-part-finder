/* Import Dependencies */
const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { match } = require('assert');

/* Connect to DB */
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials'
});

const dbConfig = {
  host: 'db',
  port: 5432,
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
    console.log('ERROR', error_message || error);
  });

/* App Settings */
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false
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

app.get('/discover', (req,res) => {
  res.render('pages/discover');
});

app.get('/logout', (req,res) => {
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

app.get('/cart', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  return res.render('pages/cart');
});

//register API testcase
app.get('/register', (req, res) => {
  res.render('pages/register');
});

//register API testcase
app.post('/register', async (req, res) => {
  const {email, username, password } = req.body;
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

app.get('/account', (req, res) => {
  if (req.session.user) {
    res.render('pages/account');
  } else {
    res.render('pages/login');
  }
});

app.get('/allparts', (req, res) => {
  res.render('pages/allparts');
});

app.get('/mycars', (req, res) => {
  if (!req.session.user) {
    res.redirect('/discover');
  }
  // saving vehicle addition into db
  db.any('SELECT * FROM vehicles WHERE user_id = $1', [req.session.user.id])
    .then(cars => {
      res.render('pages/mycars', { cars: cars});
    })
    .catch(error => {
      console.log(error);
      res.render('pages/mycars', {
        message: 'Error loading your vehicles',
        cars: []
      });
    });
});

// To add vehicle to profile and database
app.post('/api/vehicles', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const {year, make, model, engine} = req.body;
  
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
    'INSERT INTO vehicles(user_id, make, model, year, engine) VALUES($1, $2, $3, $4, $5) RETURNING id',
    [req.session.user.id, make, model, year, engine]
  )
  .then(data => {
    console.log('Successfully added vehicle:', data);
    res.json({
      success: true,
      id: data.id,
      vehicle: {id: data.id, year, make, model, engine}
    });
  })
  .catch(error => {
    console.error('Database error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      detail: error.detail
    });
    res.status(500).json({error: 'Failed to add vehicle', details: error.message});
  });
});

// To edit vehicle on profile and database
app.put('/api/vehicles/:id', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({error : 'Not authenticated'});
  }

  const {year, make, model, engine} =req.body;

  db.none('UPDATE vehicles SET make=$1, model=$2, year=$3, engine=$4 WHERE id=$5 AND user_id=$6',
    [make, model, year, engine, req.params.id, req.session.user.id]
  )
  .then(() => {
    res.json({success: true});
  })
  .catch(error=> {
    console.log(error);
    res.status(500).json({error: 'Failed to update vehicle'});
  });
});

// To delete vehicle from profile and database
app.delete('/api/vehicles/:id', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  db.none('DELETE FROM vehicles WHERE id=$1 AND user_id=$2',
    [req.params.id, req.session.user.id])
    .then(() => {
      res.json({success: true});
    })
    .catch(error => {
      console.log(error);
      res.status(500).json({error: 'Failed to delete vehicle' });
    });
});

app.get('/address', (req, res) => {
  res.render('pages/address')
});

app.post('/address', async (req, res) => {
  console.log(req.body)

  const {street_address, apartment, city, state, postal_code, country, default_address} = req.body;
  // const user_id = req.session.user.id;
  const user_id = 2;
  let default_addr;
  let apt = apartment || null;
  if (!default_address){
    default_addr = false
  }
  else {
    default_addr = true
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
  if (addressExistsForUser.length == 0){
    addressExistsForUser = null;
  }

  if (addressExistsForUser) {
    return res.status(400).render('pages/address', {
      message: 'Address already exists for this user',
      error: true
    });
  }

  if (default_addr){
    db.none('UPDATE addresses SET is_default = false WHERE user_id = $1 AND is_default = true', [user_id])
    .catch(error => {
      console.log(error);
      res.status(500).render('pages/address', {
        message: 'Error updating default address'
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
  res.json({status: 'success', message: 'Welcome!'});
});

/* Start Server */
module.exports = app.listen(3000);

console.log('Server is listening on port 3000');
