-- Migration to update blocks table schema for new block types and properties
-- Run this SQL against your Supabase database to support the updated block system
-- Block types: SOLID, DEADLY, CRUMBLING, SINKING, CONVEYOR, ICE/SLIPPERY, LADDERS

-- Add type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'blocks' AND column_name = 'type'
  ) THEN
    ALTER TABLE blocks ADD COLUMN type TEXT DEFAULT 'solid';
  END IF;
END $$;

-- Add properties JSONB column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'blocks' AND column_name = 'properties'
  ) THEN
    ALTER TABLE blocks ADD COLUMN properties JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;

-- Update existing blocks to have proper type values
UPDATE blocks SET type = 'solid' WHERE type IS NULL OR type = '';
UPDATE blocks SET properties = '{}'::JSONB WHERE properties IS NULL;

-- Create index on type for faster queries
CREATE INDEX IF NOT EXISTS idx_blocks_type ON blocks(type);

-- Create index on properties for JSONB queries
CREATE INDEX IF NOT EXISTS idx_blocks_properties ON blocks USING GIN(properties);

-- Add constraint to ensure type is valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'blocks_type_check'
  ) THEN
    ALTER TABLE blocks ADD CONSTRAINT blocks_type_check 
    CHECK (type IN ('solid', 'deadly', 'crumbling', 'sinking', 'conveyor', 'ice', 'ladder'));
  END IF;
END $$;

-- Comment on columns for documentation
COMMENT ON COLUMN blocks.type IS 'Block type: solid, deadly, crumbling, sinking, conveyor, ice, or ladder';
COMMENT ON COLUMN blocks.properties IS 'Type-specific properties (JSONB): crumbleTime, sinkingSpeed, direction, frictionCoefficient, climbSpeed, etc.';
