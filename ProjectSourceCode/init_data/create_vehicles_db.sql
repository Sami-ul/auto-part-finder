-- 1. Create a temporary table to match the transformed CSV structure
CREATE TEMPORARY TABLE temp_parts_data (
    part VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    partnumber VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    core DECIMAL(10, 2),
    pack VARCHAR(200),
    total DECIMAL(10, 2),
    fits TEXT,
    fullimg TEXT,
    thumbimg TEXT,
    compatible_vehicles JSON
);

-- 2. Import the transformed CSV
COPY temp_parts_data FROM '/home/node/app/parts_with_compatibility.csv' WITH (FORMAT CSV, HEADER, NULL '');

-- 3. Create a vehicles table if not exists
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    engine VARCHAR(100) NOT NULL,
    UNIQUE(make, model, year, engine)
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
    UNIQUE(partnumber)
);

-- 5. Create parts_compatibility association table
CREATE TABLE IF NOT EXISTS parts_compatibility (
    part_id INTEGER REFERENCES parts(id),
    vehicle_id INTEGER REFERENCES vehicles(id),
    PRIMARY KEY (part_id, vehicle_id)
);

-- 6. Import parts data
INSERT INTO parts (name, brand, partnumber, description, pack, fits, fullimg, thumbimg, category)
SELECT 
    part AS name,
    brand,
    partnumber,
    description,
    pack,
    fits,
    fullimg,
    thumbimg,
    part AS category
FROM temp_parts_data tp
ON CONFLICT DO NOTHING;

-- 7. Create vendors table if not exists
CREATE TABLE IF NOT EXISTS vendors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    website VARCHAR(255),
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

-- 9. Insert vendor
INSERT INTO vendors (name, website)
VALUES ('Rock Auto', 'https://www.rockauto.com')
ON CONFLICT DO NOTHING;

-- 10. Add pricing information
INSERT INTO pricing (part_id, vendor_id, price)
SELECT 
    p.id,
    v.id,
    tp.price
FROM temp_parts_data tp
JOIN parts p ON p.partnumber = tp.partnumber
CROSS JOIN (SELECT id FROM vendors WHERE name = 'Rock Auto' LIMIT 1) v
ON CONFLICT DO NOTHING;

-- 11. Populate vehicles from the JSON data
WITH vehicle_json AS (
    SELECT 
        jsonb_array_elements(compatible_vehicles::jsonb) AS vehicle_data
    FROM temp_parts_data
)
INSERT INTO vehicles (make, model, year, engine)
SELECT 
    (vehicle_data->>'make')::VARCHAR AS make,
    (vehicle_data->>'model')::VARCHAR AS model,
    (vehicle_data->>'year')::INTEGER AS year,
    (vehicle_data->>'engine')::VARCHAR AS engine
FROM vehicle_json
ON CONFLICT DO NOTHING;

-- 12. Create parts_compatibility records using the association table
WITH compatibility_pairs AS (
    SELECT 
        p.id AS part_id,
        v.id AS vehicle_id
    FROM temp_parts_data tp
    JOIN parts p ON p.name = tp.part
    CROSS JOIN LATERAL jsonb_array_elements(tp.compatible_vehicles::jsonb) AS vehicle_data
    JOIN vehicles v ON 
        v.make = (vehicle_data->>'make')::VARCHAR AND
        v.model = (vehicle_data->>'model')::VARCHAR AND
        v.year = (vehicle_data->>'year')::INTEGER AND
        v.engine = (vehicle_data->>'engine')::VARCHAR
)
INSERT INTO parts_compatibility (part_id, vehicle_id)
SELECT part_id, vehicle_id
FROM compatibility_pairs
ON CONFLICT DO NOTHING;

-- Drop the temporary table when done
DROP TABLE temp_parts_data;
