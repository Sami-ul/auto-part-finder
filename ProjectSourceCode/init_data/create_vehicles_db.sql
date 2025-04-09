-- Vehicles DB

CREATE TABLE vehicle_data (
    make VARCHAR(50) NOT NULL,
    year INTEGER,
    model VARCHAR(50) NOT NULL,
    engine VARCHAR(50) NOT NULL    
);

COPY vehicle_data FROM '/home/node/app/vehicle_data.csv' WITH (FORMAT CSV, HEADER);

CREATE TABLE make (
    id SERIAL PRIMARY KEY,
    make VARCHAR(25) NOT NULL
);

CREATE TABLE year (
    id SERIAL PRIMARY KEY,
    make_id INTEGER REFERENCES make(id) ON DELETE CASCADE,
    year INTEGER
);

CREATE TABLE model (
    id SERIAL PRIMARY KEY,
    year_id INTEGER REFERENCES year(id) ON DELETE CASCADE,
    model VARCHAR(25) NOT NULL
);

CREATE TABLE engine (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES model(id) ON DELETE CASCADE,
    engine VARCHAR(25) NOT NULL
);

INSERT INTO make (make) SELECT DISTINCT make FROM vehicle_data;