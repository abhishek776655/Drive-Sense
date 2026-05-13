-- DriveSense PostgreSQL / TimescaleDB schema
-- Ready to run (e.g., via docker-entrypoint-initdb.d)

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Updated-at trigger helper (avoid on high-ingest tables like location_points)
CREATE OR REPLACE FUNCTION drivesense_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Enums (idempotent)
DO $$
BEGIN
  CREATE TYPE drivesense_fuel_type AS ENUM ('petrol', 'diesel', 'cng', 'lpg', 'electric', 'hybrid', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE drivesense_trip_state AS ENUM ('idle', 'started', 'active', 'paused', 'ended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- users
CREATE TABLE IF NOT EXISTS users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext      NOT NULL,
  password_hash text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_email_nonempty CHECK (length(trim(email::text)) > 0)
);

-- vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id                        uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                      text               NOT NULL,
  fuel_type                 drivesense_fuel_type NOT NULL DEFAULT 'other',
  tank_capacity_liters      numeric(6,2),
  mileage_baseline_km_per_l numeric(8,3),
  created_at                timestamptz        NOT NULL DEFAULT NOW(),
  updated_at                timestamptz        NOT NULL DEFAULT NOW(),
  deleted_at                timestamptz,
  CONSTRAINT vehicles_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT vehicles_tank_capacity_positive CHECK (tank_capacity_liters IS NULL OR tank_capacity_liters > 0),
  CONSTRAINT vehicles_mileage_baseline_positive CHECK (mileage_baseline_km_per_l IS NULL OR mileage_baseline_km_per_l > 0)
);

DROP TRIGGER IF EXISTS vehicles_set_updated_at ON vehicles;
CREATE TRIGGER vehicles_set_updated_at
BEFORE UPDATE ON vehicles
FOR EACH ROW
EXECUTE FUNCTION drivesense_set_updated_at();

CREATE INDEX IF NOT EXISTS vehicles_user_id_idx ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS vehicles_user_active_idx ON vehicles(user_id) WHERE deleted_at IS NULL;

-- trips
CREATE TABLE IF NOT EXISTS trips (
  id               uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id       uuid               NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  state            drivesense_trip_state NOT NULL DEFAULT 'started',
  start_time       timestamptz        NOT NULL,
  end_time         timestamptz,
  distance_meters  numeric(12,2)      NOT NULL DEFAULT 0,
  duration_seconds integer            NOT NULL DEFAULT 0,
  avg_speed_mps    numeric(10,3),
  max_speed_mps    numeric(10,3),
  idle_time_seconds integer           NOT NULL DEFAULT 0,
  fuel_used_liters numeric(10,3),
  cost_amount      numeric(12,2),
  cost_currency    char(3),
  driving_score    smallint,
  created_at       timestamptz        NOT NULL DEFAULT NOW(),
  updated_at       timestamptz        NOT NULL DEFAULT NOW(),
  deleted_at       timestamptz,
  CONSTRAINT trips_end_after_start CHECK (end_time IS NULL OR end_time >= start_time),
  CONSTRAINT trips_distance_nonnegative CHECK (distance_meters >= 0),
  CONSTRAINT trips_duration_nonnegative CHECK (duration_seconds >= 0),
  CONSTRAINT trips_idle_time_nonnegative CHECK (idle_time_seconds >= 0),
  CONSTRAINT trips_fuel_used_nonnegative CHECK (fuel_used_liters IS NULL OR fuel_used_liters >= 0),
  CONSTRAINT trips_cost_nonnegative CHECK (cost_amount IS NULL OR cost_amount >= 0),
  CONSTRAINT trips_score_range CHECK (driving_score IS NULL OR (driving_score >= 0 AND driving_score <= 100)),
  CONSTRAINT trips_currency_format CHECK (cost_currency IS NULL OR cost_currency ~ '^[A-Z]{3}$')
);

DROP TRIGGER IF EXISTS trips_set_updated_at ON trips;
CREATE TRIGGER trips_set_updated_at
BEFORE UPDATE ON trips
FOR EACH ROW
EXECUTE FUNCTION drivesense_set_updated_at();

CREATE INDEX IF NOT EXISTS trips_user_start_time_desc_idx ON trips(user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS trips_vehicle_start_time_desc_idx ON trips(vehicle_id, start_time DESC);
CREATE INDEX IF NOT EXISTS trips_state_idx ON trips(state);
CREATE INDEX IF NOT EXISTS trips_user_active_idx ON trips(user_id) WHERE (state <> 'ended' AND deleted_at IS NULL);

-- location_points (TimescaleDB hypertable)
-- NOTE: Unique indexes/PKs on hypertables must include the time column (and space partition column if used).
CREATE TABLE IF NOT EXISTS location_points (
  trip_id     uuid        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  id          bigint      GENERATED BY DEFAULT AS IDENTITY,
  latitude    double precision NOT NULL,
  longitude   double precision NOT NULL,
  speed_mps   double precision,
  heading_deg double precision,
  accuracy_m  double precision,
  altitude_m  double precision,
  is_moving   boolean,
  provider    text,
  ingested_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (trip_id, recorded_at, id),
  CONSTRAINT location_points_lat_range CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT location_points_lon_range CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT location_points_speed_nonnegative CHECK (speed_mps IS NULL OR speed_mps >= 0),
  CONSTRAINT location_points_heading_range CHECK (heading_deg IS NULL OR (heading_deg >= 0 AND heading_deg <= 360)),
  CONSTRAINT location_points_accuracy_nonnegative CHECK (accuracy_m IS NULL OR accuracy_m >= 0)
);

-- Convert to hypertable if TimescaleDB is available
DO $$
BEGIN
  -- If TimescaleDB is installed, create hypertable; safe to re-run.
  PERFORM public.create_hypertable(
    'location_points',
    'recorded_at',
    'trip_id',
    8,
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE,
    create_default_indexes => FALSE
  );
EXCEPTION
  WHEN undefined_function THEN
    -- TimescaleDB extension not loaded; ignore.
    NULL;
END $$;

-- Primary query patterns:
-- 1) Fetch a trip's route over time: WHERE trip_id = ? ORDER BY recorded_at
-- 2) Recent points for active trip: WHERE trip_id = ? AND recorded_at > now() - ...
CREATE INDEX IF NOT EXISTS location_points_trip_time_desc_idx ON location_points(trip_id, recorded_at DESC);

-- For time-window scans across trips (admin/debug/retention verification)
CREATE INDEX IF NOT EXISTS location_points_recorded_at_brin_idx ON location_points USING BRIN (recorded_at);

-- Optional: TimescaleDB compression (commented by default)
-- ALTER TABLE location_points SET (
--   timescaledb.compress,
--   timescaledb.compress_segmentby = 'trip_id',
--   timescaledb.compress_orderby = 'recorded_at DESC'
-- );
-- SELECT add_compression_policy('location_points', INTERVAL '7 days');
-- SELECT add_retention_policy('location_points', INTERVAL '365 days');

-- events
CREATE TABLE IF NOT EXISTS events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  event_type  text        NOT NULL,
  intensity   numeric(10,3),
  occurred_at timestamptz NOT NULL,
  latitude    double precision,
  longitude   double precision,
  payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT events_type_nonempty CHECK (length(trim(event_type)) > 0),
  CONSTRAINT events_intensity_nonnegative CHECK (intensity IS NULL OR intensity >= 0),
  CONSTRAINT events_lat_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT events_lon_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

DROP TRIGGER IF EXISTS events_set_updated_at ON events;
CREATE TRIGGER events_set_updated_at
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION drivesense_set_updated_at();

CREATE INDEX IF NOT EXISTS events_trip_time_desc_idx ON events(trip_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS events_type_time_desc_idx ON events(event_type, occurred_at DESC);

-- fuel_logs
CREATE TABLE IF NOT EXISTS fuel_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id   uuid        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  liters       numeric(10,3) NOT NULL,
  cost_amount  numeric(12,2),
  cost_currency char(3),
  odometer_km  numeric(12,1),
  filled_at    timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT fuel_logs_liters_positive CHECK (liters > 0),
  CONSTRAINT fuel_logs_cost_nonnegative CHECK (cost_amount IS NULL OR cost_amount >= 0),
  CONSTRAINT fuel_logs_odometer_nonnegative CHECK (odometer_km IS NULL OR odometer_km >= 0),
  CONSTRAINT fuel_logs_currency_format CHECK (cost_currency IS NULL OR cost_currency ~ '^[A-Z]{3}$')
);

DROP TRIGGER IF EXISTS fuel_logs_set_updated_at ON fuel_logs;
CREATE TRIGGER fuel_logs_set_updated_at
BEFORE UPDATE ON fuel_logs
FOR EACH ROW
EXECUTE FUNCTION drivesense_set_updated_at();

CREATE INDEX IF NOT EXISTS fuel_logs_vehicle_time_desc_idx ON fuel_logs(vehicle_id, filled_at DESC);

-- Optional sample data (commented out)
-- INSERT INTO users (email, password_hash) VALUES ('demo@drivesense.dev', 'bcrypt$...');
-- INSERT INTO vehicles (user_id, name, fuel_type, tank_capacity_liters) VALUES
--   ((SELECT id FROM users WHERE email='demo@drivesense.dev'), 'My Car', 'petrol', 45.0);
-- INSERT INTO trips (user_id, vehicle_id, state, start_time) VALUES
--   ((SELECT id FROM users WHERE email='demo@drivesense.dev'),
--    (SELECT id FROM vehicles WHERE name='My Car' LIMIT 1),
--    'started',
--    NOW());
-- INSERT INTO location_points (trip_id, recorded_at, latitude, longitude, speed_mps) VALUES
--   ((SELECT id FROM trips ORDER BY created_at DESC LIMIT 1), NOW() - INTERVAL '10 seconds', 12.9716, 77.5946, 0.0),
--   ((SELECT id FROM trips ORDER BY created_at DESC LIMIT 1), NOW() - INTERVAL '5 seconds', 12.9720, 77.5950, 4.2),
--   ((SELECT id FROM trips ORDER BY created_at DESC LIMIT 1), NOW(), 12.9725, 77.5954, 6.8);
-- INSERT INTO events (trip_id, event_type, intensity, occurred_at, payload) VALUES
--   ((SELECT id FROM trips ORDER BY created_at DESC LIMIT 1), 'harsh_brake', 0.82, NOW() - INTERVAL '4 seconds', '{"speed_mps": 8.0}'::jsonb);
-- INSERT INTO fuel_logs (vehicle_id, liters, cost_amount, cost_currency, odometer_km, filled_at) VALUES
--   ((SELECT id FROM vehicles ORDER BY created_at DESC LIMIT 1), 32.5, 3500.00, 'INR', 41230.4, NOW() - INTERVAL '2 days');

COMMIT;
