/*
  # Create messages table for chat history

  1. New Tables
    - `messages`
      - `id` (uuid, primary key)
      - `role` (text, either 'user' or 'assistant')
      - `content` (text)
      - `timestamp` (timestamptz)
      - `user_id` (uuid, references auth.users)

  2. Security
    - Enable RLS on messages table
    - Add policies for users to read and create their own messages
*/

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id)
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own messages
CREATE POLICY "Users can read own messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to insert new messages
CREATE POLICY "Users can create messages"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);