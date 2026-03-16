-- ================================================================
-- AgriApp — Complete PostgreSQL Schema
-- Images stored as BYTEA directly in the database (no file system)
-- Run: node sql/migrate.js
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- 1. USERS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   VARCHAR(120) NOT NULL,
  phone                  VARCHAR(20)  NOT NULL UNIQUE,
  email                  VARCHAR(200) UNIQUE,
  password_hash          TEXT         NOT NULL,
  role                   VARCHAR(10)  NOT NULL DEFAULT 'buyer'
                           CHECK (role IN ('farmer','buyer','both')),
  address                TEXT,
  lat                    DECIMAL(10,7),
  lng                    DECIMAL(10,7),
  trust_score            DECIMAL(3,2) DEFAULT 0.00 CHECK (trust_score BETWEEN 0 AND 5),
  completed_transactions INT          DEFAULT 0,
  total_review_score     INT          DEFAULT 0,
  review_count           INT          DEFAULT 0,
  is_verified            BOOLEAN      DEFAULT FALSE,
  otp_code               VARCHAR(6),
  otp_expires_at         TIMESTAMPTZ,
  created_at             TIMESTAMPTZ  DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  DEFAULT NOW()
);

-- Profile picture stored as BYTEA in the DB
CREATE TABLE IF NOT EXISTS user_avatars (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  image_data   BYTEA       NOT NULL,       -- compressed image bytes
  mime_type    VARCHAR(30) NOT NULL DEFAULT 'image/jpeg',
  width        INT,
  height       INT,
  size_bytes   INT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_geo   ON users(lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- 2. CROPS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crops (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(120)  NOT NULL,
  category      VARCHAR(30)   NOT NULL
                  CHECK (category IN ('grain','vegetable','fruit','legume','spice','other')),
  price         DECIMAL(10,2) NOT NULL CHECK (price > 0),
  unit          VARCHAR(20)   DEFAULT 'kg'
                  CHECK (unit IN ('kg','quintal','ton','dozen','piece')),
  quantity      DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  description   TEXT,
  harvest_date  DATE,
  address       TEXT,
  lat           DECIMAL(10,7) NOT NULL,
  lng           DECIMAL(10,7) NOT NULL,
  is_active     BOOLEAN       DEFAULT TRUE,
  views         INT           DEFAULT 0,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- Crop images stored as BYTEA
CREATE TABLE IF NOT EXISTS crop_images (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id       UUID        NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  image_data    BYTEA       NOT NULL,     -- compressed JPEG bytes
  mime_type     VARCHAR(30) NOT NULL DEFAULT 'image/jpeg',
  width         INT,
  height        INT,
  size_bytes    INT,
  sort_order    INT         DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crops_farmer   ON crops(farmer_id);
CREATE INDEX IF NOT EXISTS idx_crops_category ON crops(category, is_active);
CREATE INDEX IF NOT EXISTS idx_crops_geo      ON crops(lat, lng) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_crops_name     ON crops USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_crop_images_crop ON crop_images(crop_id);

-- ──────────────────────────────────────────────────────────────
-- 3. LISTINGS  (land / warehouse / cold storage)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(20)   NOT NULL
                  CHECK (type IN ('land','warehouse','coldStorage')),
  title         VARCHAR(200)  NOT NULL,
  area          DECIMAL(10,2) NOT NULL CHECK (area > 0),
  area_unit     VARCHAR(10)   DEFAULT 'acres'
                  CHECK (area_unit IN ('acres','sqft','sqm')),
  rent          DECIMAL(10,2) NOT NULL CHECK (rent > 0),
  rent_per      VARCHAR(10)   DEFAULT 'month'
                  CHECK (rent_per IN ('day','month','season','year')),
  amenities     TEXT[]        DEFAULT '{}',
  description   TEXT,
  address       TEXT,
  lat           DECIMAL(10,7) NOT NULL,
  lng           DECIMAL(10,7) NOT NULL,
  is_available  BOOLEAN       DEFAULT TRUE,
  min_duration  INT           DEFAULT 1,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_images (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    UUID        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  image_data    BYTEA       NOT NULL,
  mime_type     VARCHAR(30) NOT NULL DEFAULT 'image/jpeg',
  width         INT,
  height        INT,
  size_bytes    INT,
  sort_order    INT         DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_type  ON listings(type, is_available);
CREATE INDEX IF NOT EXISTS idx_listings_geo   ON listings(lat, lng) WHERE is_available = TRUE;
CREATE INDEX IF NOT EXISTS idx_listing_images ON listing_images(listing_id);

-- ──────────────────────────────────────────────────────────────
-- 4. SERVICES  (rotavators, transport, labor, etc.)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(200)  NOT NULL,
  category      VARCHAR(30)   NOT NULL
                  CHECK (category IN ('equipment','transport','labor','irrigation','other')),
  price         DECIMAL(10,2) NOT NULL CHECK (price > 0),
  price_per     VARCHAR(20)   DEFAULT 'day'
                  CHECK (price_per IN ('hour','day','trip','acre','season')),
  description   TEXT,
  address       TEXT,
  lat           DECIMAL(10,7),
  lng           DECIMAL(10,7),
  is_active     BOOLEAN       DEFAULT TRUE,
  image_count   INT           DEFAULT 0,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- Service/tool images stored as BYTEA
CREATE TABLE IF NOT EXISTS service_images (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    UUID        NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  image_data    BYTEA       NOT NULL,     -- compressed JPEG bytes
  mime_type     VARCHAR(30) NOT NULL DEFAULT 'image/jpeg',
  original_name VARCHAR(260),
  width         INT,
  height        INT,
  size_bytes    INT,
  sort_order    INT         DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_provider ON services(provider_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category, is_active);
CREATE INDEX IF NOT EXISTS idx_service_images    ON service_images(service_id);

-- ──────────────────────────────────────────────────────────────
-- 5. TRANSACTIONS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id      UUID          NOT NULL REFERENCES users(id),
  seller_id     UUID          NOT NULL REFERENCES users(id),
  item_id       UUID          NOT NULL,
  item_type     VARCHAR(20)   NOT NULL
                  CHECK (item_type IN ('crop','listing','service')),
  quantity      DECIMAL(10,2),
  amount        DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  status        VARCHAR(20)   DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','visited','completed','disputed','cancelled')),
  notes         TEXT,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_buyer  ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_transactions_item   ON transactions(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- ──────────────────────────────────────────────────────────────
-- 6. REVIEWS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID        NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  reviewer_id    UUID        NOT NULL REFERENCES users(id),
  reviewee_id    UUID        NOT NULL REFERENCES users(id),
  rating         SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  role           VARCHAR(10) NOT NULL CHECK (role IN ('buyer','seller')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(transaction_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);

-- ──────────────────────────────────────────────────────────────
-- 7. AUTO-UPDATE updated_at TRIGGER
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['users','crops','listings','services','transactions'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
      CREATE TRIGGER trg_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

SELECT 'AgriApp schema created successfully ✅' AS status;
