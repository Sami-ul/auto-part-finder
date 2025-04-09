-- Create statements run when volume is recreated
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, --hashed passsword
    username VARCHAR(50) NOT NULL,
    first_name VARCHAR(25),
    last_name VARCHAR(25)
);

CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    street_address VARCHAR(255) NOT NULL,
    apt VARCHAR(15),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50),
    postal_code VARCHAR(10) NOT NULL,
    country VARCHAR(100) DEFAULT 'US',
    is_default BOOLEAN DEFAULT FALSE
);

CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    engine VARCHAR(100) NOT NULL
);

CREATE TABLE parts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100)
);

CREATE TABLE part_compatibility (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year_start INTEGER, -- year that it is first compatitble for
    year_end INTEGER -- year that it is last compatitble for
);

CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    website VARCHAR(255) NOT NULL
);

CREATE TABLE pricing (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
    vendor_id INTEGER REFERENCES vendors(id),
    price DECIMAL(10, 2) NOT NULL,
    -- shipping DECIMAL(10, 2),
    -- url VARCHAR(255),
    UNIQUE(part_id, vendor_id)
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    vehicle_id INTEGER REFERENCES vehicles(id),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(25)
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES parts(id),
    quantity INTEGER DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL
);

-- Repair history
CREATE TABLE repairs (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES parts(id),
    repair_date DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles DB

CREATE TABLE make (
    id SERIAL PRIMARY KEY,
    make VARCHAR(25) NOT NULL
);

CREATE TABLE year (
    id SERIAL PRIMARY KEY,
    year_id INTEGER REFERENCES make(id) ON DELETE CASCADE,
    year INTEGER
);

CREATE TABLE model (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES year(id) ON DELETE CASCADE,
    model VARCHAR(25) NOT NULL
);

CREATE TABLE engine (
    id SERIAL PRIMARY KEY,
    engine_id INTEGER REFERENCES model(id) ON DELETE CASCADE,
    engine VARCHAR(25) NOT NULL
);