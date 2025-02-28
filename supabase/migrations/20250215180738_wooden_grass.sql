/*
  # Fix chat functionality

  1. Changes
    - Simplify messages table structure
    - Update RLS policies for wallet-based access
    - Add index for better performance

  2. Security
    - Enable RLS
    - Add policies for wallet-based access
*/

-- Recreate messages table with simplified structure
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  wallet_address text NOT NULL
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create simplified policies for wallet-based access
CREATE POLICY "Wallets can read their messages"
  ON messages
  FOR SELECT
  USING (wallet_address = current_user);

CREATE POLICY "Wallets can create their messages"
  ON messages
  FOR INSERT
  WITH CHECK (wallet_address = current_user);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_wallet_address ON messages(wallet_address);