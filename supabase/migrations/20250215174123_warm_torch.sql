/*
  # Add wallet address to auth.users

  1. Changes
    - Add wallet_address column to auth.users table
    - Create index for wallet_address lookups
    - Update messages table to reference wallet_address
  
  2. Security
    - Enable RLS on messages table
    - Add policies for wallet-based access control
*/

-- Add wallet_address to auth.users
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS wallet_address text;
CREATE INDEX IF NOT EXISTS users_wallet_address_idx ON auth.users(wallet_address);

-- Update messages table
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
ALTER TABLE messages DROP COLUMN IF EXISTS user_id;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS wallet_address text NOT NULL;

-- Update RLS policies
DROP POLICY IF EXISTS "Users can read own messages" ON messages;
DROP POLICY IF EXISTS "Users can create messages" ON messages;

CREATE POLICY "Wallets can read own messages"
  ON messages
  FOR SELECT
  USING (wallet_address = (SELECT wallet_address FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Wallets can create messages"
  ON messages
  FOR INSERT
  WITH CHECK (wallet_address = (SELECT wallet_address FROM auth.users WHERE id = auth.uid()));