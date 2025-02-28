/*
  # Fix messages table structure

  1. Changes
    - Drop existing messages table
    - Create new messages table with proper structure
    - Add RLS policies for wallet-based access

  2. Security
    - Enable RLS
    - Add policies for authenticated users to read/write their own messages
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

-- Create policies
CREATE POLICY "Users can read their own messages"
  ON messages
  FOR SELECT
  USING (wallet_address = auth.jwt() ->> 'wallet_address');

CREATE POLICY "Users can create their own messages"
  ON messages
  FOR INSERT
  WITH CHECK (wallet_address = auth.jwt() ->> 'wallet_address');