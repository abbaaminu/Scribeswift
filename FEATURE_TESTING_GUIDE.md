# ScribeSwift - Feature Testing Guide

## Complete Test Scenarios (Before Launch)

Run through these scenarios end-to-end to verify all functionality works correctly.

---

## Scenario 1: Free Tier User - Complete Transcription Flow

### Setup
- [ ] Browser session cleared (fresh start)
- [ ] Not signed in

### Test Steps
1. [ ] **Load App**
   - Navigate to app
   - Verify "Sign In" button visible
   - Verify "Upgrade to Premium" button visible

2. [ ] **Upload First File (Free)**
   - Click upload area
   - Select audio file (5-10 MB)
   - Verify file selected
   - Verify language dropdown shows "Auto-detect"
   - Click upload
   - Verify progress bar shows "Uploading media file..."
   - Verify progress bar shows "Processing file with advanced AI..."
   - Wait for transcription to complete

3. [ ] **Verify Transcription Results**
   - Verify title auto-filled
   - Verify file size displayed
   - Verify duration calculated correctly
   - Verify full transcript shows
   - Verify segments with timestamps show
   - Verify speaker labels appear (Speaker 1, etc.)
   - Verify summary displays:
     - Overview (2-4 sentences)
     - Key Points (3-5 items)
     - Action Items (if any)
     - Keywords (5-10 items)

4. [ ] **Test Export Restrictions (Free)**
   - Try to click "Copy Text" button
   - Verify "Upgrade to Premium" message shows
   - Try to click export dropdown
   - Verify all export options show lock icon
   - Verify hovering shows upgrade message

5. [ ] **Sign Up/Sign In**
   - Click "Sign In" button
   - Select "Magic Link" tab
   - Enter email
   - Click "Send Magic Link"
   - Verify success message shows
   - Check email for magic link
   - Click magic link
   - Verify signed in (user avatar visible in header)
   - Verify free tier indicator shown

6. [ ] **Test Free Usage Cap**
   - Upload 2nd file (should succeed)
   - Upload 3rd file (should succeed)
   - Upload 4th file (should succeed)
   - Upload 5th file (should succeed)
   - Try to upload 6th file (should show error: "Monthly limit reached")
   - Verify error message is user-friendly
   - Verify "Upgrade to Premium" link in error

### Expected Results
- ✅ Transcription completes within 2-5 minutes
- ✅ 5 files can be transcribed per month
- ✅ 6th file blocked with friendly message
- ✅ Export buttons disabled with upgrade prompt
- ✅ History saved and synced
- ✅ Can sign out and sign back in with history preserved

---

## Scenario 2: Premium Tier User - Payment & Full Features

### Setup
- [ ] Fresh user account (or test account)
- [ ] Signed in

### Test Steps
1. [ ] **Upgrade to Premium**
   - Click "Upgrade to Premium" button
   - Verify subscription modal opens
   - Verify pricing shown correctly (5/mo or 55/yr)
   - Verify monthly selected by default
   - Click "Subscribe with Paddle"
   - Verify Paddle checkout opens
   - Complete payment (use test card)
   - Verify confetti animation plays
   - Verify modal closes
   - Verify "Premium Member" badge shows in header
   - Check Supabase: verify is_premium set to true

2. [ ] **Upload and Export**
   - Upload audio file (same as Scenario 1)
   - Wait for transcription
   - Verify copy text button is enabled (no lock)
   - Click "Copy Text"
   - Verify success message shows
   - Paste text in text editor, verify correct

3. [ ] **Test Export Formats**
   - Click "Export" dropdown
   - [ ] Export as TXT
     - Verify file downloaded with `.txt` extension
     - Verify format: title, then segments with timestamps
   - [ ] Export as SRT (subtitles)
     - Verify file downloaded with `.srt` extension
     - Verify SRT format (sequence, timecode, text)
   - [ ] Export as VTT (WebVTT)
     - Verify file downloaded with `.vtt` extension
     - Verify VTT format (WEBVTT header, timestamps, cues)
   - [ ] Export as JSON
     - Verify file downloaded with `.json` extension
     - Verify valid JSON structure
   - [ ] Print
     - Verify print preview opens
     - Verify formatting looks good
     - Print to PDF or printer

4. [ ] **Premium Usage Limits**
   - Upload 50+ files (should all succeed)
   - Verify all save to history
   - Scroll history, verify all files shown
   - No limit reached message

5. [ ] **Premium Status Persistence**
   - Sign out
   - Sign back in
   - Verify "Premium Member" badge still shows
   - Verify export buttons still enabled

### Expected Results
- ✅ Paddle payment completes successfully
- ✅ Premium status updated in database
- ✅ All export formats work correctly
- ✅ 90 transcriptions per month (vs 5 free)
- ✅ Premium status persists across sessions

---

## Scenario 3: Multi-Language Transcription

### Setup
- [ ] Signed in (free or premium user)
- [ ] Test audio files in different languages

### Test Steps
1. [ ] **English Audio**
   - Upload English audio file
   - Verify auto-detects English
   - Verify transcript is in English
   - Check accuracy (should be >95%)

2. [ ] **Spanish Audio**
   - Upload Spanish audio file
   - Click language dropdown BEFORE upload
   - Select "Spanish"
   - Upload
   - Verify transcript is in Spanish
   - Verify accuracy

3. [ ] **French Audio**
   - Upload French audio file
   - Select "French"
   - Upload
   - Verify transcript is in French

4. [ ] **Auto-Detect**
   - Upload audio in German (language auto-detect)
   - Leave as "Auto-detect"
   - Upload
   - Verify Groq correctly detects German
   - Verify transcript is accurate

### Expected Results
- ✅ All supported languages transcribe correctly
- ✅ Auto-detect works for common languages
- ✅ Accuracy >90% for each language

---

## Scenario 4: Large File Handling

### Setup
- [ ] Audio file 50-100 MB
- [ ] Video file with audio track

### Test Steps
1. [ ] **50MB Audio File**
   - Drag & drop 50MB audio file
   - Verify file size shown correctly
   - Start upload
   - Monitor progress bar
   - Verify chunked processing (multiple Groq calls)
   - Wait for completion (should take 5-10 minutes)
   - Verify complete transcript

2. [ ] **100MB Audio File**
   - Upload 100MB audio file
   - Verify processes in chunks
   - Verify no timeout errors
   - Verify complete when done

3. [ ] **Video File (MP4)**
   - Upload MP4 video file
   - Verify app extracts audio track
   - Verify transcription completes
   - Check transcription accuracy

4. [ ] **File Size Limit**
   - Try uploading 101MB file
   - Verify error: "File size exceeds maximum allowed limit"
   - Verify user-friendly message

### Expected Results
- ✅ Large files chunked and processed
- ✅ No timeouts on large transcriptions
- ✅ Video audio extraction works
- ✅ 100MB limit enforced with clear error

---

## Scenario 5: Network Reliability & Recovery

### Setup
- [ ] Audio file ready to upload
- [ ] Dev tools open (network throttling available)

### Test Steps
1. [ ] **Slow Network (3G)**
   - Enable 3G throttling in dev tools
   - Upload audio file
   - Verify progress bar moves slowly but steadily
   - Verify no timeouts
   - Verify completes successfully

2. [ ] **Network Interruption (Upload Stage)**
   - Start upload
   - After 20% uploaded, disable network
   - Verify error message shows: "Network connection error"
   - Enable network again
   - Verify user can retry

3. [ ] **Network Interruption (Processing Stage)**
   - Start upload, allow to reach "Processing" stage
   - Disable network
   - Verify error handling
   - Verify graceful degradation
   - Re-enable network, retry

4. [ ] **Network Interruption (Transcription Stage)**
   - Allow transcription to start
   - Disable network after 10 seconds
   - Verify retry mechanism engages
   - Re-enable network
   - Verify completes successfully

### Expected Results
- ✅ Slow networks don't cause premature timeout
- ✅ Network errors handled gracefully
- ✅ Users can retry after network failure
- ✅ No data loss on connection drop

---

## Scenario 6: Multi-User Concurrent Uploads

### Setup
- [ ] 2-3 users ready (different browsers/devices)
- [ ] Audio files ready

### Test Steps
1. [ ] **User A: Start Upload**
   - User A uploads file
   - Observe transcription starts

2. [ ] **User B: Start Upload**
   - While A is transcribing, User B uploads file
   - Verify B's transcription starts independently

3. [ ] **User C: Start Upload**
   - While A and B transcribe, User C uploads
   - Verify C's transcription starts

4. [ ] **Monitor Completion**
   - Verify all three complete (no interference)
   - Verify each user's history shows only their files
   - Verify no usage count bleeding between users

5. [ ] **Test Free Tier Concurrency**
   - Create 2 free users
   - User A uploads file 1-5 (5 free limit)
   - While A's files processing, User B tries upload 6
   - Verify User B gets rate limited correctly
   - Verify doesn't affect User A's quota

### Expected Results
- ✅ Users don't interfere with each other's transcriptions
- ✅ Each user's history separate
- ✅ Usage caps isolated per user
- ✅ No transcription drops

---

## Scenario 7: History & Persistence

### Setup
- [ ] User with 5+ transcriptions in history

### Test Steps
1. [ ] **View History Drawer**
   - Click history icon in header
   - Verify history drawer opens
   - Verify all transcriptions listed
   - Verify newest first (most recent at top)

2. [ ] **Click History Item**
   - Click on transcription in history
   - Verify transcription loads
   - Verify correct content shown
   - Verify export/copy buttons work

3. [ ] **Clear History**
   - Click "Clear History" button
   - Verify confirmation dialog
   - Click "Confirm Clear"
   - Verify all history removed
   - Verify drawer empty
   - Refresh page, verify still empty

4. [ ] **History Sync Across Browsers**
   - User uploads transcription in Browser 1
   - Open same app in Browser 2
   - Verify new transcription appears in history
   - (Requires Supabase + authentication)

5. [ ] **Offline History**
   - Disable network
   - Verify can still access saved history
   - Verify can view transcriptions
   - Re-enable network
   - Verify no errors

### Expected Results
- ✅ History displays chronologically
- ✅ Can click history items to view
- ✅ Clear history works completely
- ✅ History syncs across devices
- ✅ Works offline for previously saved items

---

## Scenario 8: Error Handling & Edge Cases

### Setup
- [ ] Various error conditions to test

### Test Steps
1. [ ] **Corrupted Audio File**
   - Create invalid audio file (rename text file to .mp3)
   - Try to upload
   - Verify error: "Failed to process audio file"
   - Verify user-friendly message

2. [ ] **Empty Audio File**
   - Create 0-byte audio file
   - Upload
   - Verify error handling

3. [ ] **Unsupported Format**
   - Try uploading .txt, .pdf, .doc
   - Verify error: "Unsupported file format"
   - Verify message lists supported formats

4. [ ] **No Groq API Key**
   - Simulate missing GROQ_API_KEY
   - Try transcription
   - Verify error: "Transcription service unavailable"
   - Verify doesn't expose internal error

5. [ ] **No Supabase Connection**
   - Disconnect from Supabase
   - Try signing in
   - Verify error message
   - Verify app doesn't crash

### Expected Results
- ✅ All errors show user-friendly messages
- ✅ No technical/stack trace errors exposed
- ✅ App remains stable after errors
- ✅ Users can retry or contact support

---

## Scenario 9: UI/UX Responsiveness

### Setup
- [ ] Different screen sizes (desktop, tablet, mobile)

### Test Steps
1. [ ] **Desktop (1920x1080)**
   - Verify layout looks good
   - Verify buttons clickable
   - Verify text readable
   - Verify no overflow

2. [ ] **Tablet (iPad 1024x768)**
   - Verify responsive design
   - Verify upload area fits
   - Verify buttons appropriately sized
   - Verify transcript readable

3. [ ] **Mobile (iPhone 375x667)**
   - Verify drag & drop works (or file picker)
   - Verify upload progress visible
   - Verify transcript scrollable
   - Verify buttons tappable (min 44px)
   - Verify modal responsive

4. [ ] **Mobile: Transcript View**
   - View transcription on mobile
   - Verify timestamps visible
   - Verify speaker labels visible
   - Verify export menu accessible
   - Verify copy works

### Expected Results
- ✅ All screen sizes display correctly
- ✅ No horizontal scrolling needed
- ✅ Touch targets min 44x44px
- ✅ Readable on small screens

---

## Scenario 10: Authentication Flows

### Setup
- [ ] Supabase configured with email/password + Google OAuth

### Test Steps
1. [ ] **Magic Link Sign In**
   - Click "Sign In"
   - Select "Magic Link"
   - Enter email
   - Check email for link
   - Click link
   - Verify signed in automatically

2. [ ] **Google OAuth Sign In**
   - Click "Sign In"
   - Click "Google Sign In"
   - Verify Google OAuth popup
   - Authorize app
   - Verify signed in

3. [ ] **Password Sign Up**
   - Click "Sign In"
   - Select "Sign Up"
   - Enter email, password, name
   - Click "Create Account"
   - Verify account created
   - Verify signed in

4. [ ] **Password Sign In**
   - Sign out
   - Click "Sign In"
   - Select "Password"
   - Enter email and password
   - Click "Sign In"
   - Verify signed in

5. [ ] **Session Persistence**
   - Sign in
   - Refresh page
   - Verify still signed in
   - Close browser, reopen app
   - Verify session persists

6. [ ] **Sign Out**
   - Click user avatar
   - Click "Sign Out"
   - Verify signed out
   - Verify "Sign In" button visible

### Expected Results
- ✅ All auth methods work
- ✅ Sessions persist across page reload
- ✅ Sign out clears session
- ✅ Redirects after auth success

---

## Pre-Launch Testing Metrics

Track these during testing:

```
Transcription Accuracy:
  - English: ___% accuracy
  - Spanish: ___% accuracy
  - French: ___% accuracy
  - German: ___% accuracy

File Handling:
  - 5MB file: ___ seconds to transcribe
  - 50MB file: ___ seconds to transcribe
  - 100MB file: ___ seconds to transcribe

Payment:
  - Paddle checkout: works ✓/✗
  - Premium status syncs: works ✓/✗
  - Webhook verification: works ✓/✗

Mobile:
  - Responsive design: ✓/✗
  - Touch interactions: ✓/✗
  - Export on mobile: ✓/✗

Errors:
  - Error messages user-friendly: ✓/✗
  - No stack traces shown: ✓/✗
  - Proper error recovery: ✓/✗

Performance:
  - API response times <500ms: ✓/✗
  - Transcription speed acceptable: ✓/✗
  - UI responsive (no jank): ✓/✗
```

---

**Complete all scenarios before declaring launch-ready! 🚀**

