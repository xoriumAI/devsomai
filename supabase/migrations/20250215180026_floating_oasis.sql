/*
  # Fix messages table structure and policies

  1. Changes
    - Drop and recreate messages table with proper structure
    - Add wallet_address column
    - Update RLS policies for wallet-based access
    
  2. Security
    - Enable RLS
    - Add policies for wallet-based read/write access
*/

-- Drop existing table and recreate with proper structure
DROP TABLE IF EXISTS messages;

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  wallet_address text NOT NULL
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for wallet-based access
CREATE POLICY "Wallets can read their messages"
  ON messages
  FOR SELECT
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');

CREATE POLICY "Wallets can create their messages"
  ON messages
  FOR INSERT
  WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');