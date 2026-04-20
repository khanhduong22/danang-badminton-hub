-- Database Schema for Danang Badminton Hub (PostgreSQL / PostgREST)

CREATE TABLE IF NOT EXISTS courts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    contact_number VARCHAR(50),
    zalo_url TEXT,
    maps_url TEXT,
    image_urls TEXT[],
    num_of_courts INTEGER,
    price_range VARCHAR(100),
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wandering_posts (
    id SERIAL PRIMARY KEY,
    court_id_ref INTEGER REFERENCES courts(id) ON DELETE SET NULL,
    court_name_raw VARCHAR(255), -- Dùng khi AI bóc tách tên sân nhưng chưa map được id
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    level_required VARCHAR(100),
    slot_needed INTEGER NOT NULL,
    price_per_slot VARCHAR(100),
    source_url TEXT,
    content_raw TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS if needed, or create anonymous web user for PostgREST
-- CREATE ROLE web_anon nologin;
-- GRANT USAGE ON SCHEMA public TO web_anon;
-- GRANT SELECT ON courts TO web_anon;
-- GRANT SELECT, INSERT ON wandering_posts TO web_anon;
