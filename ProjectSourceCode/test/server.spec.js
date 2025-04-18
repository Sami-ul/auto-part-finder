// ********************** Initialize server **********************************

const server = require('../index'); //TODO: Make sure the path to your index.js is correctly added
const pgp = require('pg-promise')();
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
        console.log('ERROR', error);
    });


// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const { assert, expect } = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************

describe('Server!', () => {
    // Sample test case given to test / endpoint.
    it('Returns the default welcome message', done => {
        chai
            .request(server)
            .get('/welcome')
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body.status).to.equals('success');
                assert.strictEqual(res.body.message, 'Welcome!');
                done();
            });
    });
});

// *********************** TODO: WRITE 2 UNIT TESTCASES **************************
describe('Testing Register API', () => {
    // Clean up before testing
    before(done => {
        db.none('DELETE FROM users WHERE email = $1', ['Jdoe@gmail.com'])
            .then(() => {
                console.log('User deleted successfully');
                done();
            })
            .catch(error => {
                console.error('Error deleting user:', error);
                done(error);
            });
    });
// positive test case
    it('positive : /register. testing proper registration', done => {
        chai
            .request(server)
            .post('/register')
            .redirects(0) 
            .send({ email: "Jdoe@gmail.com", username: 'JohnDoe', password: '12345678B' })
            .end((err, res) => {
                expect(res).to.redirectTo(/\/login$/);
                done();
            });
    });
// negative test case
    it('negative : /register. testing duplicate registration', done => {
        chai
            .request(server)
            .post('/register')
            .redirects(0) 
            .send({ email: "Jdoe@gmail.com", username: "JohnDoe", password: "12345678B" }) // duplicate
            .end((err, res) => {
                expect(res).to.have.status(400);
                expect(res.text).to.include('Email already exists');
                done();
            });
    });
// negative test case
    it('negative : /register. testing invalid email', done => {
        chai
            .request(server)
            .post('/register')
            .redirects(0) 
            .send({ email: 1, username: "JohnDoe", password: "12345678B" })
            .end((err, res) => {
                expect(res).to.have.status(400);
                expect(res.text).to.include('Invalid email address');
                done();
            });
    });

});

describe('Discover', () => {
    // Sample test case given to test / endpoint.
    it('Renders the discover page', done => {
        chai
            .request(server)
            .get('/discover')
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.text).to.include('Choose Vehicle');
                expect(res.text).to.include('Search');
                done();
            });
    });
});
describe('negative : /cart. logged out', () => {
    // Sample test case given to test / endpoint.
    it('Checks if the cart redirects to /login if logged out', done => {
        chai
            .request(server)
            .get('/cart')
            .end((err, res) => {
                expect(res).to.redirectTo(/\/login$/);
                done();
            });
    });
});

describe('positive : /cart. logged in', () => {
    let agent;
    
    before(done => {
        // simulate a login session
        agent = chai.request.agent(server);
        
        agent
            .post('/login')
            .send({ username: 'JohnDoe', password: '12345678B' }) // pre made user
            .end((err, res) => {
                expect(res).to.redirectTo(/\/$/);
                done();
            });
    });
    
    after(() => {
        agent.close();
    });
    
    it('Checks if the cart shows properly if logged in', done => {
        agent
            .get('/cart')
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.text).to.include('Your Cart');
                done();
            });
    });
});
// ********************************************************************************