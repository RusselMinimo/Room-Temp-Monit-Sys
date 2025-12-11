-- Migration 001: Initial Database Schema
-- Room Temperature Monitoring System

-- Users table
CREATE TABLE IF NOT EXISTS users (
  email VARCHAR(255) PRIMARY KEY,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(255),
  created_at BIGINT NOT NULL,
  role VARCHAR(50) DEFAULT 'user'
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  issued_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Readings table (time-series IoT data)
CREATE TABLE IF NOT EXISTS readings (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  temperature_c DECIMAL(5, 2) NOT NULL,
  humidity_pct DECIMAL(5, 2),
  rssi INTEGER,
  is_demo BOOLEAN DEFAULT FALSE,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_readings_device_id ON readings(device_id);
CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts DESC);
CREATE INDEX IF NOT EXISTS idx_readings_device_ts ON readings(device_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_readings_is_demo ON readings(is_demo);

-- Device preferences table
CREATE TABLE IF NOT EXISTS device_preferences (
  device_id VARCHAR(255) PRIMARY KEY,
  label VARCHAR(255),
  threshold_low_c DECIMAL(5, 2),
  threshold_high_c DECIMAL(5, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User-specific device labels
CREATE TABLE IF NOT EXISTS user_device_labels (
  device_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id, email)
);

CREATE INDEX IF NOT EXISTS idx_user_device_labels_email ON user_device_labels(email);

-- User-specific temperature thresholds
CREATE TABLE IF NOT EXISTS user_device_thresholds (
  device_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  low_c DECIMAL(5, 2),
  high_c DECIMAL(5, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id, email)
);

CREATE INDEX IF NOT EXISTS idx_user_device_thresholds_email ON user_device_thresholds(email);

-- Device assignments (room assignments for users)
CREATE TABLE IF NOT EXISTS device_assignments (
  email VARCHAR(255) PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_assignments_device_id ON device_assignments(device_id);

-- Auth logs table
CREATE TABLE IF NOT EXISTS auth_logs (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  event VARCHAR(50) NOT NULL,
  ip VARCHAR(100),
  user_agent TEXT,
  timestamp BIGINT NOT NULL,
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_email ON auth_logs(email);
CREATE INDEX IF NOT EXISTS idx_auth_logs_timestamp ON auth_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_event ON auth_logs(event);

