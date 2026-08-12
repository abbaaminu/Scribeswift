-- ============================================================================
-- ScribeSwift Supabase Database Setup
-- ============================================================================
-- Run these SQL commands in your Supabase project to set up persistent
-- transcription history storage by user ID.
-- 
-- Steps:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to SQL Editor
-- 3. Create a new query and paste this entire file
-- 4. Click "Run" to execute all commands
-- ============================================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. Profiles Table (for user subscription data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 2. Transcriptions Table (for saving history by user)
-- ============================================================================
CREATE TABLE IF NOT EXISTS transcriptions (
  -- Primary key and user reference
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Unique constraint: one transcription per user per ID
  CONSTRAINT transcriptions_pkey PRIMARY KEY (user_id, id),
  
  -- Transcription metadata
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  language TEXT DEFAULT 'en',
  
  -- Full transcript text
  full_text TEXT NOT NULL,
  
  -- Structured data (stored as JSONB for flexibility)
  segments JSONB DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{"overview": "", "keyPoints": [], "actionItems": [], "keywords": []}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id and created_at for fast lookups
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_created 
  ON transcriptions(user_id, created_at DESC);

-- ============================================================================
-- 3. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Profiles: Users can only update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Profiles: Users can insert their own profile (on signup via trigger)
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Transcriptions: Users can only view their own transcriptions
DROP POLICY IF EXISTS "Users can view their own transcriptions" ON transcriptions;
CREATE POLICY "Users can view their own transcriptions" ON transcriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Transcriptions: Users can insert their own transcriptions
DROP POLICY IF EXISTS "Users can insert their own transcriptions" ON transcriptions;
CREATE POLICY "Users can insert their own transcriptions" ON transcriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transcriptions: Users can update their own transcriptions
DROP POLICY IF EXISTS "Users can update their own transcriptions" ON transcriptions;
CREATE POLICY "Users can update their own transcriptions" ON transcriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Transcriptions: Users can delete their own transcriptions
DROP POLICY IF EXISTS "Users can delete their own transcriptions" ON transcriptions;
CREATE POLICY "Users can delete their own transcriptions" ON transcriptions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 4. Auto-create Profile on User Signup (Trigger)
-- ============================================================================

-- Function to create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, is_premium)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. Verify Setup
-- ============================================================================
-- After running the above, you should see:
-- - profiles table with RLS enabled
-- - transcriptions table with RLS enabled
-- - Both tables should have proper indexes and constraints
--
-- Test with: SELECT COUNT(*) FROM transcriptions;
-- You should get 0 rows (or access denied if not authenticated)
-- ============================================================================
