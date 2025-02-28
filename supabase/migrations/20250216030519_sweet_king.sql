/*
  # Fix wallet sections relationship

  1. Changes
    - Drop existing tables to ensure clean state
    - Recreate tables with proper relationships
    - Add UNIQUE constraint to section names
    - Simplify schema and improve foreign key relationship
    - Add proper indexes for performance
    - Set up RLS policies
    - Add default wallet sections

  2. Tables
    - wallet_sections
      - id (uuid, primary key)
      - name (text, unique)
      - order (integer)
      - created_at (timestamp)
      - updated_at (timestamp)
    
    - wallets
      - id (uuid, primary key)
      - public_key (text, unique)
      - encrypted_private_key (text)
      - name (text)
      - balance (numeric)
      - section_name (text, foreign key)
      - archived (boolean)
      - created_at (timestamp)
      - updated_at (timestamp)

  3. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS wallet_sections CASCADE;

-- Create wallet_sections table
CREATE TABLE wallet_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create wallets table with section_name foreign key
CREATE TABLE wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_key text UNIQUE NOT NULL,
  encrypted_private_key text NOT NULL,
  name text,
  balance numeric NOT NULL DEFAULT 0,
  section_name text REFERENCES wallet_sections(name) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE wallet_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_wallets_section_name ON wallets(section_name);
CREATE INDEX idx_wallet_sections_order ON wallet_sections("order");
CREATE INDEX idx_wallets_public_key ON wallets(public_key);

-- Insert default sections
INSERT INTO wallet_sections (name, "order") VALUES
  ('main', 0),
  ('bundles', 1),
  ('sniper', 2),
  ('dev', 3),
  ('cex', 4)
ON CONFLICT (name) DO UPDATE SET
  "order" = EXCLUDED."order";

-- Create RLS policies for wallet_sections
CREATE POLICY "Allow read access to wallet sections for authenticated users"
  ON wallet_sections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert access to wallet sections for authenticated users"
  ON wallet_sections FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update access to wallet sections for authenticated users"
  ON wallet_sections FOR UPDATE
  TO authenticated
  USING (true);

-- Create RLS policies for wallets
CREATE POLICY "Allow read access to wallets for authenticated users"
  ON wallets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert access to wallets for authenticated users"
  ON wallets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update access to wallets for authenticated users"
  ON wallets FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow delete access to wallets for authenticated users"
  ON wallets FOR DELETE
  TO authenticated
  USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_wallet_sections_updated_at
  BEFORE UPDATE ON wallet_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();