# Pocket Mechanics
## Description
Pocket Mechanics' Auto Part Finder is a feature rich, easy-to-use website for all your auto part needs. By creating an account on our website, you have the ability to save your vehicles in your garage and search for parts that are guaranteed to be compatible with your vehicle. Our website allows you to save addresses of local stores as well as your home address, making it seamless to get parts shipped and delivered to you.

## Contributers
Sami-ul Ahmed, Nanda Min-Fink, Sabir Saklayen, Eva Pavlik, Rey Stone

## Technology Stack
### Hosting
- Render
### Front End
- Handlebars
    - Views, Layouts, Partials
- HTML
- CSS
- Client-Side JS

### Server
- NodeJS Server

### Database
- Postgresql Database

### APIs
- Stripe for payments
- OpenStreetMap
    - Nomatism for address completion
    - Overpass for finding local shops
- Web scraped Rock Auto to populate database

## Project Requirements
- axios: ^1.8.4
- bcryptjs: ^2.4.0
- body-parser: ^1.20.3
- csv-parse: ^5.6.0
- express: ^4.6.1
- express-handlebars: ^7.1.2
- express-session: ^1.18.1
- fs: ^0.0.1-security,
- https-proxy-agent: ^7.0.6
- nodejs: ^0.0.0
- pg-promise: ^10.11.1
- cookie-parser: ^1.4.7
- stripe: ^14.3.0

### Dev Dependencies
- chai: ^4.2.0,
- chai-htt": ^4.3.0,
- mocha: ^11.1.0,
- nodemon: ^3.1.9,
- npm-run-all: ^4.1.5

## Run Locally
- cd into ProjectSourceCode
- create .env file with:
    - POSTGRES_USER
    - POSTGRES_PASSWORD
    - POSTGRES_DB
    - STRIPE_SECRET_KEY
    - STRIPE_PUBLISHABLE_KEY
- run: docker compose up
    - Automatically runs tests on compose.

## Deployed Application:
`https://auto-part-finder.onrender.com/register`
