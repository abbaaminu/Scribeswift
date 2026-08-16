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
-- 4. Auto-Update updated_at Timestamp (Trigger)
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for transcriptions table
DROP TRIGGER IF EXISTS update_transcriptions_updated_at ON transcriptions;
CREATE TRIGGER update_transcriptions_updated_at
  BEFORE UPDATE ON transcriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. Auto-create Profile on User Signup (Trigger)
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
-- 5. Monthly Transcription Usage Tracking (CRITICAL FIX #1)
-- ============================================================================
-- Table to track monthly transcription counts per user
-- This enables atomic check-and-increment to prevent race conditions
CREATE TABLE IF NOT EXISTS transcription_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- Format: "YYYY-MM" (e.g., "2026-08")
  count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT transcription_usage_pkey PRIMARY KEY (user_id, period)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transcription_usage_user_period
  ON transcription_usage(user_id, period);

-- ============================================================================
-- 6. Atomic Usage Check & Increment Function (CRITICAL FIX #1)
-- ============================================================================
-- This function atomically checks if a user has reached their monthly limit
-- AND increments their count in a single transaction to prevent race conditions
-- from concurrent uploads bypassing the limit.
CREATE OR REPLACE FUNCTION public.check_and_increment_transcription_usage(
  user_id UUID,
  period_string TEXT,
  is_premium BOOLEAN
)
RETURNS TABLE (allowed BOOLEAN, used_count INT, limit_count INT) AS $$
DECLARE
  current_usage INT;
  user_limit INT;
BEGIN
  -- Determine limit based on premium tier
  user_limit := CASE WHEN is_premium THEN 90 ELSE 5 END;
  
  -- Atomic check and increment in single transaction
  INSERT INTO transcription_usage (user_id, period, count)
  VALUES (user_id, period_string, 1)
  ON CONFLICT (user_id, period)
  DO UPDATE SET count = count + 1
  RETURNING count INTO current_usage;
  
  -- Return whether this transcription is allowed and current usage stats
  RETURN QUERY SELECT
    (current_usage <= user_limit)::BOOLEAN as allowed,
    current_usage as used_count,
    user_limit as limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Verify Setup
-- ============================================================================
-- After running the above, you should see:
-- - profiles table with RLS enabled
-- - transcriptions table with RLS enabled
-- - transcription_usage table for tracking monthly limits
-- - check_and_increment_transcription_usage() function for atomic operations
--
-- Test with: SELECT COUNT(*) FROM transcriptions;
-- You should get 0 rows (or access denied if not authenticated)
-- ============================================================================
