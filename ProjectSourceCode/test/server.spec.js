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

describe('positive : /mycars. add a car while logged in', () => {
    let agent;
    let newCarId;
    before(done => {
        // simulate a login session
        agent = chai.request.agent(server);

        agent
            .post('/login')
            .send({ username: 'JohnDoe', password: '12345678B' }) // pre made user
            .end((err, res) => {
                // check req.session.user
                expect(res).to.have.status(200);
                expect(res).to.redirectTo(/\/$/);
                done();
            });
    });

    after(done => {
        if (newCarId) {
            db.none('DELETE FROM user_vehicles WHERE id = $1', [newCarId])
                .then(() => agent.close())
                .then(() => done())
                .catch(done);
        }
        agent.close();
    });

    // it('Checks if the cart shows properly if logged in', done => {
    //     agent
    //         .get('/mycars')
    //         .end((err, res) => {
    //             expect(res).to.have.status(200);
    //             expect(res.text).to.include('My Garage');
    //             done();
    //         });
    // });
    // it('Checks if the car is added properly', done => {
    //     const payload = { make: 'Dodge', model: 'Hornet', year: 2025, engine: '2.0L L4 Turbocharged' };
    //     agent
    //         .post('/api/vehicles')
    //         .send(payload)
    //         .end((err, res) => {
    //             expect(res.body).to.be.an('object');
    //             expect(res.body).to.have.property('success', true);
    //             expect(res.body).to.have.property('id').that.is.a('number');
    //             expect(res.body).to.have.property('vehicle').that.deep.includes({
    //                 make: payload.make,
    //                 model: payload.model,
    //                 year: payload.year,
    //                 engine: payload.engine
    //             });

    //             newCarId = res.body.id;
    //             done();
    //         });
    // });
    // it('Tries to add a car without a make', done => {
    //     const payload = { model: 'Hornet', year: 2025, engine: '2.0L L4 Turbocharged' };
    //     agent
    //         .post('/api/vehicles')
    //         .send(payload)
    //         .end((err, res) => {
    //             expect(res).to.have.status(400);
    //             expect(res.body).to.be.an('object');
    //             expect(res.body).to.have.property('error', 'All fields are required');
    //             done();
    //         });
    // });
});
describe('negative : /mycars. logged out', () => {
    it('Checks if the cart redirects to /login if logged out', done => {
        chai
            .request(server)
            .get('/mycars')
            .redirects(0)
            .end((err, res) => {
                expect(res).to.have.status(302);
                expect(res).to.redirectTo(/\/login$/);
                done();
            });
    });
});

describe('Feature 2 UAT: Search & Add to Cart from Results', () => {
    let agent;

    before(done => {
        agent = chai.request.agent(server);
        agent
            .post('/login')
            .send({ username: 'JohnDoe', password: '12345678B' })
            .end((err, res) => {
                expect(res).to.redirectTo(/\/$/);
                done();
            });
    });

    after(() => {
        agent.close();
    });

    it('Redirects to /discover when no search query is provided', done => {
        agent
            .get('/search')
            .redirects(0)
            .end((err, res) => {
                expect(res).to.have.status(200);
                done();
            });
    });

    it('Searches parts with a valid query and shows compatible parts', done => {
        agent
            .get('/search')
            .query({ query: 'filter' })
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.text.toLowerCase()).to.include('wa10718'); // part num
                done();
            });
    });

    it('Adds a part to cart from the first search result', done => {
        agent
            .get('/search')
            .query({ query: 'filter' })
            .end((err, res) => {
                expect(res).to.have.status(200);
                // extract data-pricing-id from first "Add to Cart" button
                const m = res.text.match(/data-pricing-id="(\d+)"/);
                expect(m, 'no data-pricing-id found').to.not.be.null;
                const pricingID = m[1];

                agent
                    .post('/cart/add')
                    .send({ pricing_id: pricingID })
                    .end((err2, addRes) => {
                        expect(addRes).to.have.status(200);
                        expect(addRes.body).to.have.property('success', true);

                        // finally confirm it made it into the cart
                        agent
                            .get('/cart')
                            .end((err3, cartRes) => {
                                expect(cartRes).to.have.status(200);
                                // nav count = 1
                                // and the button or row carries the same data-product-id
                                expect(cartRes.text.toLowerCase()).to.include('air filter');
                                expect(cartRes.text).to.include(`data-pricing-id="${pricingID}"`);
                                done();
                            });
                    });
            });
    });
    it('Attempts an incomplete parts search', done => {
        agent
            .get('/search')
            .query({ query: '' })
            .redirects(0)
            .end((err, res) => {
                expect(res).to.have.status(200);
                done();
            });
    })
});

describe('Feature 3 UAT: Checkout Process', () => {
    let agent;
    let partId;

    before(done => {
        agent = chai.request.agent(server);
        agent
            .post('/login')
            .send({ username: 'JohnDoe', password: '12345678B' })
            .end((err, res) => {
                expect(res).to.redirectTo(/\/$/);
                // Find a product and add it to cart for testing
                agent
                    .get('/search')
                    .query({ query: 'filter' })
                    .end((err, res) => {
                        const m = res.text.match(/data-product-id="(\d+)"/);
                        partId = m[1];
                        agent
                            .post('/cart/add')
                            .send({ product_id: partId })
                            .end(() => done());
                    });
            });
    });

    after(() => {
        agent.close();
    });

    it('Shows items in cart correctly', done => {
        agent
            .get('/cart')
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.text).to.include('Your Cart');
                expect(res.text).to.include('Air Filter');
                done();
            });
    });

    it('Can navigate to address page', done => {
        agent
            .get('/address')
            .end((err, res) => {
                expect(res).to.have.status(200);
                done();
            });
    });

    it('Can add a new default shipping address', done => {
        const newAddress = {
            street_address: '123 Test Street',
            city: 'Testville',
            state: 'TS',
            postal_code: '12345',
            country: 'USA',
            default_address: 'true'
        };
        
        agent
            .post('/address')
            .send(newAddress)
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.text).to.include('Address successfully added');
                done();
            });
    });

    it('Proceeds to checkout page with items', done => {
        agent
            .get('/checkout')
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.text).to.include('Checkout');
                expect(res.text).to.include('Air Filter');
                expect(res.text).to.include('Test Street');
                done();
            });
    });

    it('Creates checkout session with Stripe', done => {
        agent
            .post('/create-checkout-session')
            .send({
                amount: 29.99,
                description: 'Auto Parts Order with Economy Shipping'
            })
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('clientSecret');
                done();
            });
    });


});