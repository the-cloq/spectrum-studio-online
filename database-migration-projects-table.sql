-- Migration to create projects table for batched Supabase saves
-- This table stores the entire GameProject as a JSONB blob
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);

-- Comment for documentation
COMMENT ON TABLE projects IS 'Stores complete GameProject state as JSONB for batched saves from localStorage';
COMMENT ON COLUMN projects.data IS 'Serialized GameProject with all sprites, blocks, screens, levels, and game flow data';
