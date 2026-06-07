-- Perez Automotive D1 schema
-- Run this once in Cloudflare D1 Console before using the shared dashboard.

CREATE TABLE IF NOT EXISTS portal_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
