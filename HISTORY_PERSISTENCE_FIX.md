# ScribeSwift History Persistence - Complete Troubleshooting Guide

## Summary of Changes
Your app now has **complete infrastructure** to save and sync history by user ID across devices and browsers. The fixes include:

1. ✅ **Database Schema** - SQL migration with `profiles` and `transcriptions` tables
2. ✅ **Row Level Security** - Users can only access their own data
3. ✅ **Tier Syncing** - Subscription status saved to Supabase
4. ✅ **Enhanced Logging** - Detailed console messages for debugging
5. ✅ **Auto-Profile Creation** - Profiles created automatically on user signup

---

## Quick Start (5 Steps)

### Step 1: Add Supabase Credentials
Create a `.env.local` file (or set environment variables):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anonymous_key_from_supabase
```

### Step 2: Run the Database Setup
1. Open your **Supabase Dashboard** → **SQL Editor**
2. Create **New Query**
3. Paste the contents of `supabase-setup.sql` from your project root
4. Click **Run** and wait for all commands to succeed ✓

### Step 3: Test Setup in Supabase
In SQL Editor, run:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

You should see: `profiles` and `transcriptions` tables ✓

### Step 4: Restart the App
- Stop the dev server (`Ctrl+C`)
- Start it again: `npm run dev`
- Open browser console (`F12`)

### Step 5: Check Console Output
Look for one of these messages:
```
✓ [Supabase] Successfully configured. History will be saved to Supabase.
```
OR
```
✗ [Supabase] Not configured. History will only be saved locally.
```

---

## Testing the Fix

### Test 1: Single Device (Refresh Persistence)
1. **Create account** and log in
2. **Upload & transcribe** an audio file
3. **Refresh the page** (Ctrl+R)
4. ✅ History should still appear

**If it doesn't:**
- Open browser console (F12)
- Look for `[History]` error messages
- See "Debugging Console Messages" below

### Test 2: Cross-Browser Sync
1. **Log in** on Browser A (Chrome, Firefox, Safari, etc.)
2. **Transcribe** a file on Browser A
3. **Open** Browser B in a new window/tab
4. **Log in** with the same account on Browser B
5. ✅ Transcriptions from Browser A should appear in Browser B

**If they don't:**
- Check browser console (F12) for `[Supabase]` errors
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- See "Debugging Console Messages" below

### Test 3: Tier Syncing
1. **Log in** and see your current tier
2. **Click tier toggle** (usually in header)
3. ✅ Console should show: `[Profile] ✓ Updated user tier`
4. **Refresh the page** - tier should persist
5. **Log in from another browser** - tier should appear

---

## Debugging Console Messages

Open browser Developer Tools: Press `F12` → **Console** tab

### ✅ Success Messages (Everything Working)
```
[Supabase] ✓ Successfully configured. History will be saved to Supabase.
[Profile] ✓ Loaded profile for user (tier: free)
[History] Loaded 3 transcriptions from Supabase
[History] ✓ Saved: "My Meeting Recording"
```

### ⚠️ Critical Errors (Tables Don't Exist)

**Error Message:**
```
[History] Error saving transcription: 42P01
[History] ✗ CRITICAL: "transcriptions" table does not exist. 
Run supabase-setup.sql in your Supabase project.
```

**Solution:** Run the SQL migration (Steps 2-3 in Quick Start)

### ⚠️ RLS Policy Error (Permission Denied)

**Error Message:**
```
[History] Error saving transcription: 42501
[History] ✗ CRITICAL: Row Level Security (RLS) policy error. 
Check that RLS policies are correctly configured.
```

**Solution:** 
1. Go to Supabase Dashboard → **Security** → **Policies**
2. Verify policies exist for `transcriptions` table
3. Run `supabase-setup.sql` again to recreate them

### ⚠️ Not Configured (Credentials Missing)

**Error Message:**
```
[Supabase] ✗ Not configured. History will only be saved locally. 
Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cross-device sync.
```

**Solution:** Add credentials to `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here
```

---

## Full Debugging Checklist

- [ ] `.env.local` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] `VITE_SUPABASE_URL` doesn't contain "placeholder"
- [ ] Console shows: `✓ Successfully configured`
- [ ] Supabase Dashboard shows `profiles` table exists
- [ ] Supabase Dashboard shows `transcriptions` table exists
- [ ] Supabase Dashboard → Security → Policies has RLS enabled on both tables
- [ ] User is logged in (not guest)
- [ ] File transcription completes successfully
- [ ] Browser console shows no `[History] Error` messages

---

## Database Architecture

```
Supabase Project
├─ profiles table
│  ├─ id (user ID from auth.users)
│  ├─ email
│  ├─ is_premium (true/false)
│  └─ updated_at
│
└─ transcriptions table
   ├─ id (unique transcription ID)
   ├─ user_id (links to profiles.id)
   ├─ title, full_text, segments, summary
   ├─ created_at
   └─ RLS: Users can only see their own rows
```

---

## File Locations

- **SQL Migration:** `./supabase-setup.sql`
- **App Main:** `./src/App.tsx`
- **Supabase Config:** `./src/lib/supabase.ts`
- **Setup Guide:** `./SUPABASE_SETUP.md` (this file)

---

## What Each Update Does

### `src/App.tsx` Changes
- ✅ `handleToggleTier()` now syncs to Supabase when user is logged in
- ✅ `handleSubscribeSuccess()` now updates premium status in Supabase
- ✅ `handleTranscriptionComplete()` already saving (no change needed)

### `src/lib/supabase.ts` Changes
- ✅ Startup logging shows configuration status
- ✅ `fetchUserHistory()` logs detailed errors and counts
- ✅ `saveTranscriptionToHistory()` detects table/RLS errors
- ✅ `updateUserPremiumStatus()` syncs tier changes
- ✅ `clearUserHistory()` properly logs deletions

### `supabase-setup.sql` (New File)
- ✅ Creates `profiles` and `transcriptions` tables
- ✅ Sets up Row Level Security for data isolation
- ✅ Creates trigger to auto-create profile on signup

---

## Performance Notes

- History queries are indexed on `user_id` and `created_at` for fast loads
- Segments and summary stored as JSONB (flexible, searchable)
- Each user can store unlimited transcriptions
- No file storage limits (just metadata storage)

---

## Security

- ✅ Row Level Security ensures users only see their own data
- ✅ Anon key restrictions prevent direct database access
- ✅ Email verified on signup (Supabase auth)
- ✅ Profile creation triggered automatically
- ✅ Users cannot view/modify other users' history

---

## Still Having Issues?

1. **Check console messages first** - they're very detailed now
2. **Verify SQL ran** - check Supabase Tables dashboard
3. **Check policies** - Supabase Security > Policies
4. **Test Supabase directly** - run test SQL query in Supabase dashboard
5. **Check credentials** - verify URL and key are correct (no "placeholder" text)

---

## Next Steps (Optional Enhancements)

- Add search/filter for history
- Add favorites/starred transcriptions
- Add ability to share transcriptions
- Add automatic backup export
- Add transcription tags/categories
