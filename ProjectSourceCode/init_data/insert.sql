-- Insert statements run when volume is recreated
INSERT INTO users 
    (email, password, username, first_name, last_name) 
VALUES
('john.doe@example.com', 'asdasd', 'john4', 'John', 'Doe'),
('jane.smith@example.com', 'tesdasd', 'testusername', 'Jane', 'Dawn'),
('mike.johnson@example.com', 'pass', 'testusername4', 'Mike', 'Jones');

INSERT INTO addresses 
    (user_id, street_address, city, state, postal_code, country, is_default) 
VALUES
(1, '123 First St', 'Boulder', 'CO', '80302', 'USA', TRUE),
(1, '3424 Test Street', 'Denver', 'MA', '23421', 'USA', FALSE);

INSERT INTO vehicles 
    (user_id, make, model, year)
VALUES
(1, 'Toyota', 'Camry', 2018),
(1, 'Honda', 'Civic', 2020),
(2, 'Ford', 'F-150', 2019);

INSERT INTO parts 
    (name, description, category) 
VALUES
('Oil Filter', 'High Quality oil filter', 'Maintenance'),
('Brake Pads', 'Cheap front brake pads', 'Brakes');

INSERT INTO part_compatibility 
    (part_id, make, model, year_start, year_end) 
VALUES
(1, 'Toyota', 'Camry', 2015, 2020),
(1, 'Honda', 'Civic', 2016, 2022);


INSERT INTO vendors 
    (name, website) 
VALUES
('Amazone', 'https://www.amazon.com'),
('Advance Auto Parts', 'https://www.advanceautoparts.com');

INSERT INTO pricing 
    (part_id, vendor_id, price) 
VALUES
(1, 1, 20.43),
(2, 2, 9.49),
(2, 1, 7.29),
(1, 2, 8.49);

INSERT INTO orders 
    (user_id, vehicle_id, order_date, status) 
VALUES
(1, 2, CURRENT_TIMESTAMP, 'Completed'),
(2, 3, CURRENT_TIMESTAMP, 'Shipped'),
(3, 3, '2025-04-01 12:00:00', 'Processing');

INSERT INTO order_items 
    (order_id, part_id, quantity, price) 
VALUES
(1, 1, 1, 8.99),
(1, 2, 1, 14.99);


INSERT INTO repairs 
    (vehicle_id, part_id, repair_date) 
VALUES
(1, 1, CURRENT_TIMESTAMP),
(1, 2, '2022-12-10');
