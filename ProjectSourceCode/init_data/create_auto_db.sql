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


-- 3. Create a vehicles table if not exists
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    engine VARCHAR(100) NOT NULL,
    UNIQUE(make, model, year, engine)
);

CREATE TABLE user_vehicles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 4. Create parts table if not exists
CREATE TABLE IF NOT EXISTS parts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    partnumber VARCHAR(100) NOT NULL,
    description TEXT,
    pack VARCHAR(200),
    fits TEXT,
    fullimg TEXT,
    thumbimg TEXT,
    category VARCHAR(100),
    compatible_vehicles JSON,
    UNIQUE(partnumber)
);

-- 5. Create parts_compatibility association table
CREATE TABLE IF NOT EXISTS parts_compatibility (
    part_id INTEGER REFERENCES parts(id),
    vehicle_id INTEGER REFERENCES vehicles(id),
    PRIMARY KEY (part_id, vehicle_id)
);

-- 7. Create vendors table if not exists
CREATE TABLE IF NOT EXISTS vendors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    website VARCHAR(255),
    markup FLOAT, 
    UNIQUE(name)
);

-- 8. Create pricing table if not exists
CREATE TABLE IF NOT EXISTS pricing (
    id SERIAL PRIMARY KEY,
    part_id INTEGER REFERENCES parts(id),
    vendor_id INTEGER REFERENCES vendors(id),
    price DECIMAL(10, 2) NOT NULL,
    UNIQUE(part_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS cart (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pricing_id INTEGER NOT NULL REFERENCES pricing(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_pricing'
    ) THEN
        ALTER TABLE cart ADD CONSTRAINT unique_user_product UNIQUE (user_id, pricing_id);
    END IF;
END$$;


CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    vehicle_id INTEGER REFERENCES user_vehicles(id),
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
    vehicle_id INTEGER REFERENCES user_vehicles(id) ON DELETE CASCADE,
    part_id INTEGER REFERENCES parts(id),
    repair_date DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

