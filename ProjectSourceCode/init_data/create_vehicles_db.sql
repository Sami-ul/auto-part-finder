-- Vehicles DB

CREATE TABLE vehicle_data (
    make VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    model VARCHAR(50) NOT NULL,
    engine VARCHAR(50) NOT NULL,
    part VARCHAR(25) NOT NULL,
    brand VARCHAR(25) NOT NULL,
    partnumber VARCHAR(25) NOT NULL,
    description VARCHAR(2000),
    price FLOAT NOT NULL,
    core FLOAT,
    pack VARCHAR(200),
    total FLOAT,
    fits VARCHAR(5000),
    fullimg VARCHAR(2000),
    thumbimg VARCHAR(2000) 
);

COPY vehicle_data FROM '/home/node/app/vehicle_data.csv' WITH (FORMAT CSV, HEADER);