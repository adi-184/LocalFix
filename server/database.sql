-- 1. Enable PostGIS Extension for Spatial Queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create Stores Table
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    store_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(50),
    subscription_tier VARCHAR(50) DEFAULT 'Free',
    location GEOGRAPHY(Point, 4326) NOT NULL
);

-- 3. Create Products Inventory Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    size_spec VARCHAR(100),
    price NUMERIC(10, 2) NOT NULL,
    in_stock BOOLEAN DEFAULT TRUE
);

-- 4. Create Customer Leads Table
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
    searched_item VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Insert Sample Hardware Stores (Kurukshetra Coordinates)
INSERT INTO stores (store_name, address, phone, subscription_tier, location) VALUES
('Sharma Hardware & Sanitary', 'Near NIT Gate, Thanesar, Kurukshetra', '+91 98120-11223', 'Pro', ST_SetSRID(ST_MakePoint(76.8185, 29.9490), 4326)::geography),
('Garg Plumbing & Tools', 'Railway Road, Kurukshetra', '+91 98120-44556', 'Pro', ST_SetSRID(ST_MakePoint(76.8310, 29.9530), 4326)::geography),
('National Pipe & Fitting Store', 'Pipli Road, Sector 13, Kurukshetra', '+91 98120-77889', 'Free', ST_SetSRID(ST_MakePoint(76.8500, 29.9550), 4326)::geography);

-- 6. Insert Sample Hardware Products
INSERT INTO products (store_id, product_name, category, size_spec, price, in_stock) VALUES
(1, 'Brass Wall Bib Cock Tap', 'Plumbing', '1/2 inch (15mm)', 280.00, TRUE),
(2, 'Chrome Finish Heavy Tap', 'Plumbing', '1/2 inch (15mm)', 320.00, TRUE),
(3, 'PVC Short Body Water Tap', 'Plumbing', '1/2 inch (15mm)', 95.00, TRUE);