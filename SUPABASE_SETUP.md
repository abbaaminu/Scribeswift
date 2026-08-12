# Supabase Database Setup Guide for ScribeSwift

## Problem
History is not persisting across sessions and not syncing across browsers/devices because the Supabase database tables haven't been created yet.

## Solution Overview
The app is already coded to save history to Supabase by user ID! We just need to:
1. Create the database tables
2. Set up Row Level Security (RLS)
3. Verify your Supabase credentials are configured

## Step-by-Step Setup

### Step 1: Set Up Supabase Project
If you haven't already:
1. Go to [supabase.com](https://supabase.com) and create a free project
2. Copy your **Project URL** and **Anonymous API Key** from the Settings > API menu
3. Add them to your `.env` file or deploy environment:
   ```
   VITE_SUPABASE_URL=your_project_url_here
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

### Step 2: Create Database Tables
1. Open your Supabase project dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the entire contents of `supabase-setup.sql` (in the root of this repo)
5. Click **Run** to execute all SQL commands
6. You should see "Success" messages for each command

### Step 3: Verify Setup
In the Supabase SQL Editor, run this test query:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('profiles', 'transcriptions');
```

You should see two rows:
- `profiles`
- `transcriptions`

### Step 4: Test the App
1. Restart the app (or refresh if running locally)
2. Create a new account or log in
3. Transcribe an audio/video file
4. **Refresh the page** - your history should still be there
5. **Log in from another browser/device** with the same account
6. Your history should appear in the new browser

## What the Setup Does

### Profiles Table
- Stores user subscription tier (free vs premium)
- Automatically created when a user signs up
- Each user can only view/edit their own profile

### Transcriptions Table
- Stores all transcription history by user
- Indexed for fast queries
- Row Level Security ensures users only see their own transcriptions

### Row Level Security (RLS)
- Prevents users from accessing other users' data
- Prevents unauthenticated access
- Each policy is scoped to the authenticated user's ID

## Troubleshooting

### Issue: "Still not saving history"
**Check:**
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for warnings like `Supabase history save warning:`
4. Check the error message to see what went wrong

**Common issues:**
- Credentials not set (check `console.log` shows "✓ Supabase configured")
- RLS policy preventing writes (check policies in Supabase > Security > Policies)
- User not authenticated (check you're logged in)

### Issue: "Still only showing history in same browser"
**Solution:** Make sure:
1. You're logged in with the same account in both browsers
2. The `profiles` table was created (check Step 3)
3. The user profile has `is_premium = false` initially (that's normal)

### Issue: Supabase shows errors
**Check your Supabase database:**
1. Go to Database > Tables
2. Verify `profiles` and `transcriptions` tables exist
3. Go to Security > Policies and verify RLS policies are set

### Enable Debug Logging
To see detailed logs, in `src/lib/supabase.ts` change the `console.warn` calls to `console.log`:
```typescript
// Line ~155: change this
console.warn('Supabase history fetch notice:', error.message);
// to this
console.log('DEBUG Supabase history fetch:', error);
```

## Architecture

```
User Login
    ↓
Load Profile (tier) → Supabase profiles table
Load History → Supabase transcriptions table (filtered by user_id)
    ↓
User Transcribes File
    ↓
Save to State + Save to Supabase → transcriptions table (with user_id)
    ↓
User Logs In From Another Device
    ↓
Fetch History → Supabase transcriptions table (filtered by user_id)
    ↓
History Appears (Cross-device sync!)
```

## Environment Variables
Make sure these are set in your deployment or `.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here_with_extra_characters
```

## Need Help?
1. Check browser console for error messages
2. Check Supabase dashboard > Logs for API errors
3. Verify the SQL ran successfully (all green checkmarks)
4. Make sure user is authenticated (logged in)
