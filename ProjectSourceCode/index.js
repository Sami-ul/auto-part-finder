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
        message: 'Password does not match'
      });
    }
  } catch (err) {
    res.render('pages/login', {
      message: 'User not found'
    });
  }
});

app.get('/discover', (req,res) => {
  res.render('pages/discover');
});

app.get('/register', (req, res) => {
  res.render('pages/register');
});

app.post('/register', async (req, res) => {
  const {email, username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  db.none('INSERT INTO users(email, username, password) VALUES($1, $2, $3)', [email, username, hashedPassword])
    .then(() => {
      res.redirect('/login');
    })
    .catch(error => {
      console.log(error);
      res.status(500).send('Error registering user');
    });
});

app.get('/', (req,res) => {
  res.render('pages/discover');
});
app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});
/* Start Server */
module.exports = app.listen(3000);

console.log('Server is listening on port 3000');