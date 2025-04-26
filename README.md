# Pocket Mechanics
## Description
Pocket Mechanics' Auto Part Finder is a feature rich, easy-to-use website for all your auto part needs. By creating an account on our website, you have the ability to save your vehicles in your garage and search for parts that are guaranteed to be compatible with your vehicle. Our website allows you to save addresses of local stores as well as your home address, making it seamless to get parts shipped and delivered to you.

## Contributors
Sami-ul Ahmed, Nanda Min-Fink, Sabir Saklayen, Eva Pavlik, Rey Stone

## Project Structure
```
├── MilestoneSubmissions
│   ├── ProjectReport_1.pdf
│   ├── UAT_Test_Plan.md
│   └── Week_1_Deliverables.pdf
├── ProjectSourceCode
│   ├── css
│   │   └── styles.css
│   ├── docker-compose.yaml
│   ├── img
│   │   └── maintenance.png
│   ├── index.js
│   ├── init_data
│   │   ├── create_auto_db.sql
│   │   ├── data
│   │   │   ├── cleanlinks.py
│   │   │   ├── parts_with_compatibility.csv
│   │   │   ├── parts_with_compatibility_full_set.csv
│   │   │   ├── test.py
│   │   │   └── vehicle_data.csv
│   │   └── populate_db.sql
│   ├── js
│   │   ├── address_suggestions.js
│   │   └── get_parts.js
│   ├── list.sh
│   ├── package-lock.json
│   ├── package.json
│   ├── schemas
│   │   └── database_schema.md
│   ├── scrape_project
│   │   ├── AILogs
│   │   │   ├── claude_getcatalog.txt
│   │   │   ├── gemini_operationfoktop.txt
│   │   │   ├── gpt_getproductdata.txt
│   │   │   └── gpt_getvehicledata.txt
│   │   ├── README.txt
│   │   ├── README.txt:Zone.Identifier
│   │   ├── get_catalog.js
│   │   ├── get_parts.js
│   │   ├── get_vehicle_data_final.js
│   │   ├── operationfoktopt.js
│   │   ├── parts_scraper.js
│   │   ├── scraper_progress.json
│   │   ├── testdrive.js
│   │   └── vehicle_data.csv
│   ├── test
│   │   └── server.spec.js
│   └── views
│       ├── layouts
│       │   └── main.hbs
│       ├── pages
│       │   ├── account.hbs
│       │   ├── address.hbs
│       │   ├── cart.hbs
│       │   ├── checkout.hbs
│       │   ├── discover.hbs
│       │   ├── login.hbs
│       │   ├── logout.hbs
│       │   ├── mycars.hbs
│       │   ├── register.hbs
│       │   └── success.hbs
│       └── partials
│           ├── footer.hbs
│           ├── head.hbs
│           ├── message.hbs
│           ├── nav.hbs
│           └── title.hbs
├── README.md
└── TeamMeetingLogs
    ├── 3-19-2025.md
    ├── 4-02-2025.md
    ├── 4-09-2025.md
    └── 4-16-2025.md
```

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

## Project Requirements (Prerequisites to run the application)
### User
- To use the app as a user, use any web browser and navigate to [https://auto-part-finder.onrender.com/register](https://auto-part-finder.onrender.com/register) and make an account.
### Development Requirements
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
    - Sets up database, installs dependencies from `package.json`, runs tests to ensure everything is okay, runs the application.
    - Automatically runs tests on compose.

## Running Tests
- `docker compose run --rm web npm test` 
    - This command will simply run the tests from within the docker container.
- Additionally, using Github Actions, tests are automatically run on every push to the remote. This makes the development life cycle easier as we can catch software regressions early.

## Deployed Application:
[https://auto-part-finder.onrender.com/register](https://auto-part-finder.onrender.com/register)
