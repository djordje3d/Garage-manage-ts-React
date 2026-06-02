-- Baseline schema aligned with Python SQLAlchemy models (APIPostgreSql/app/models.py)
-- and Alembic constraint name uq_tickets_ticket_token (8a34a74bbbcc).
-- Apply to an empty database: npm run db:init (requires DATABASE_URL).

CREATE TABLE IF NOT EXISTS parking_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  capacity INTEGER NOT NULL,
  default_rate NUMERIC NOT NULL,
  lost_ticket_fee NUMERIC NULL,
  night_rate NUMERIC NULL,
  day_rate NUMERIC NULL,
  open_time TIME NULL,
  close_time TIME NULL,
  allow_subscription BOOLEAN NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parking_spot (
  id SERIAL PRIMARY KEY,
  garage_id INTEGER NOT NULL REFERENCES parking_config (id),
  code VARCHAR(14) NOT NULL DEFAULT '10010',
  is_rentable BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_spot_per_garage UNIQUE (garage_id, code)
);

CREATE TABLE IF NOT EXISTS vehicle_types (
  id SERIAL PRIMARY KEY,
  "type" TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  CONSTRAINT uq_vehicle_types_type UNIQUE ("type")
);

CREATE TABLE IF NOT EXISTS vehicle (
  id SERIAL PRIMARY KEY,
  licence_plate VARCHAR(8) NULL,
  vehicle_type_id INTEGER NULL REFERENCES vehicle_types (id),
  created TIMESTAMPTZ NULL DEFAULT NOW(),
  status SMALLINT NULL DEFAULT 1,
  CONSTRAINT uq_vehicle_licence_plate UNIQUE (licence_plate)
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  ticket_token VARCHAR(32) NOT NULL,
  entry_time TIMESTAMPTZ NULL,
  exit_time TIMESTAMPTZ NULL,
  fee NUMERIC NULL,
  ticket_state TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  operational_status TEXT NOT NULL,
  vehicle_id INTEGER NULL REFERENCES vehicle (id),
  garage_id INTEGER NOT NULL REFERENCES parking_config (id),
  spot_id INTEGER NULL REFERENCES parking_spot (id),
  image_url VARCHAR(512) NULL,
  CONSTRAINT uq_tickets_ticket_token UNIQUE (ticket_token)
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NULL REFERENCES tickets (id),
  amount NUMERIC NOT NULL,
  method VARCHAR(20) NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'RSD',
  paid_at TIMESTAMPTZ NULL DEFAULT NOW()
);

-- Stamp Alembic head so Python Alembic does not re-apply add_column migrations on this DB.
CREATE TABLE IF NOT EXISTS alembic_version (
  version_num VARCHAR(32) NOT NULL,
  CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

INSERT INTO alembic_version (version_num) VALUES ('c2559069f3b5')
ON CONFLICT (version_num) DO NOTHING;
