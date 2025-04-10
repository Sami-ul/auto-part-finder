-- Vehicles DB

CREATE TABLE vehicle_data (
    make VARCHAR(50) NOT NULL,
    year INTEGER,
    model VARCHAR(50) NOT NULL,
    engine VARCHAR(50) NOT NULL    
);

COPY vehicle_data FROM '/home/node/app/vehicle_data.csv' WITH (FORMAT CSV, HEADER);

-- To get vehicle Makes
-- SELECT DISTINCT make FROM vehicle_data ORDER BY make;

-- To get vehicle Years
-- @make in WHERE clause should contain the value of first dropdown box for vehicle Make
-- @year in WHERE clause should be >= 1960 to ensure threshold
-- SELECT year FROM vehicle_data WHERE make = 'Honda' AND year >= 1960 ORDER BY year DESC;

-- To get vehicle Model
-- @make in WHERE clause should contain the value of first dropdown box for vehicle Make (String)
-- @year in WHERE clause should contain the value of second dropdown box for vehicle Year (Integer)
-- SELECT model FROM vehicle_data WHERE make = 'Honda' AND year = 2020 ORDER BY model;

-- To get vehicle Engine
-- @make in WHERE clause should contain the value of first dropdown box for vehicle Make (String)
-- @year in WHERE clause should contain the value of second dropdown box for vehicle Year (Integer)
-- @model in WHERE clause should contain the value of third dropdown box for vehicle Model (String)
-- SELECT engine FROM vehicle_data WHERE make = 'Honda' AND year = 2020 AND model='CR-V' ORDER BY engine;