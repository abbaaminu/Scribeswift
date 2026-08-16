# ScribeSwift Launch Day Checklist

**Launch Target Date:** [Your Date]  
**Status:** Ready for Implementation  

---

## 🔴 CRITICAL - Fix These Immediately (24 hours)

### Security & Payment Issues
- [ ] **Fix #1:** Implement atomic usage cap check (prevents free quota bypass)
  - Create SQL function: `check_and_increment_transcription_usage()`
  - Update `/api/transcribe` endpoint
  - Test: 5 simultaneous uploads should all be counted

- [ ] **Fix #2:** Add Paddle webhook timestamp validation (prevents payment fraud)
  - Make `PADDLE_NOTIFICATION_WEBHOOK_SECRET` mandatory
  - Add 5-minute timestamp freshness check
  - Add rate limiting (10 webhooks/60sec per user)
  - Test: Send old webhook (should reject)

- [ ] **Fix #3:** Add timeout & retry to Groq API calls (prevents hung uploads)
  - Add `withTimeout()` wrapper (40sec for transcription, 20sec for LLM)
  - Add `withRetry()` wrapper (3 attempts with exponential backoff)
  - Test: Kill network during upload (should retry)

- [ ] **Fix #4:** Remove fake payment form (eliminates free premium exploit)
  - Delete `handleSubscribeDirect()` from SubscriptionModal
  - Delete card input fields and test button
  - Verify ONLY Paddle checkout is available
  - Test: Complete real Paddle payment

---

## 🟠 HIGH PRIORITY - Complete by launch (48 hours)

### Reliability & Data
- [ ] **Security Headers:** Add CORS, HSTS, X-Frame-Options
  - Install: `npm install helmet cors`
  - Configure in `server.ts`
  - Test with browser dev tools

- [ ] **Rate Limiting:** Protect API endpoints
  - Install: `npm install express-rate-limit`
  - Limit `/api/transcribe` to 10 req/min per user
  - Limit `/api/webhooks/paddle` to 100 req/min global
  - Return 429 when exceeded

- [ ] **Input Validation:** File integrity checks
  - Validate magic bytes (audio file headers)
  - Verify file isn't corrupted before processing
  - Test with intentionally corrupted files

- [ ] **Error Messages:** User-friendly error handling
  - Wrap all API errors with user-friendly text
  - Add error codes (ERR_TRANSCRIBE_001, etc.)
  - Hide technical details from UI
  - Log full errors server-side

- [ ] **Config Validation:** Fail fast on startup
  - Create `validateStartupConfig()` function
  - Check: Groq API key, Supabase URL, Paddle secret
  - Display clear error messages if missing
  - Don't start server if critical config missing

### Data & History
- [ ] **History Sync:** Handle offline scenarios
  - Test: Disable network after transcription
  - Verify history saved locally
  - Verify sync resumes when online
  - Test: Concurrent local & remote saves

### Logging & Monitoring
- [ ] **Add structured logging:**
  - Log all API requests with timestamps
  - Log transcription success/failure rates
  - Log Paddle webhook events
  - Log auth events (login, logout, errors)
  - Example: `console.log(`[Transcribe] User ${userId} started: ${filename}`)`

---

## 🟡 MEDIUM PRIORITY - Before or after launch (72 hours)

### Testing & Documentation
- [ ] **Test matrix:**
  - File sizes: 1MB, 5MB, 50MB, 100MB
  - Languages: English, Spanish, French, German, Japanese (each)
  - Audio types: MP3, WAV, M4A, MP4, WEBM
  - Multiple speakers (2-4 speakers per file)
  - Network conditions: Good, 3G, Offline
  - Browsers: Chrome, Firefox, Safari, Edge

- [ ] **Payment flow:**
  - Test monthly purchase
  - Test yearly purchase
  - Test webhook after purchase
  - Verify premium status updates
  - Test refund (if applicable)

- [ ] **Mobile experience:**
  - Upload on mobile browser
  - Test progress bar responsiveness
  - Test payment modal on mobile
  - Test export on mobile

- [ ] **Documentation:**
  - Write API documentation
  - Document environment variables
  - Create deployment guide
  - Create user FAQ

---

## ✅ VERIFICATION - Day Before Launch

### Configuration
- [ ] **Environment Variables Set:**
  ```bash
  ✓ VITE_SUPABASE_URL
  ✓ VITE_SUPABASE_ANON_KEY
  ✓ SUPABASE_SERVICE_ROLE_KEY
  ✓ GROQ_API_KEY
  ✓ VITE_PADDLE_CLIENT_TOKEN
  ✓ VITE_PADDLE_MONTHLY_PRICE_ID
  ✓ VITE_PADDLE_YEARLY_PRICE_ID
  ✓ PADDLE_NOTIFICATION_WEBHOOK_SECRET
  ✓ VITE_SUBSCRIPTION_MONTHLY_PRICE_USD
  ✓ VITE_SUBSCRIPTION_YEARLY_PRICE_USD
  ✓ VITE_SITE_URL
  ✓ VITE_CONTACT_EMAIL
  ```

- [ ] **Database Ready:**
  - [ ] `supabase-setup.sql` executed
  - [ ] `profiles` table exists
  - [ ] `transcriptions` table exists
  - [ ] `transcription_usage` table exists
  - [ ] `check_and_increment_transcription_usage()` function created
  - [ ] RLS policies enabled on all tables
  - [ ] Service role key configured on server

- [ ] **Paddle Configuration:**
  - [ ] Webhook URL registered: `https://yourdomain.com/api/webhooks/paddle`
  - [ ] Webhook secret saved in `PADDLE_NOTIFICATION_WEBHOOK_SECRET`
  - [ ] Monthly price ID set to `VITE_PADDLE_MONTHLY_PRICE_ID`
  - [ ] Yearly price ID set to `VITE_PADDLE_YEARLY_PRICE_ID`
  - [ ] Test webhook sent and received successfully

- [ ] **Groq Configuration:**
  - [ ] API key valid and active
  - [ ] Quota sufficient for launch (recommend 10,000+ API calls)
  - [ ] Test transcription works (call `/api/sample-transcription`)

### Build & Deployment
- [ ] **Build Successful:**
  ```bash
  npm run build
  # Should complete without errors
  # Check: dist/ folder created
  # Check: dist/server.cjs exists and is <50MB
  ```

- [ ] **Local Testing:**
  ```bash
  npm run dev
  # Server starts on localhost:5173
  # Load http://localhost:5173
  # Test transcription upload
  # Test premium upgrade
  # Check browser console for no errors
  ```

- [ ] **Production Build Test:**
  ```bash
  npm run build
  npm run start
  # Test production bundle runs correctly
  ```

### Staging Environment
- [ ] **Deploy to staging:**
  - [ ] All env vars configured for staging
  - [ ] Connect to staging Supabase project
  - [ ] Run 24-hour soak test
  - [ ] Monitor error logs
  - [ ] Test all payment flows

- [ ] **Staging Verification:**
  - [ ] Upload and transcribe file successfully
  - [ ] Complete Paddle payment
  - [ ] Verify premium status updated in database
  - [ ] Check transcription saved in history
  - [ ] Export transcript in multiple formats
  - [ ] Sign out and sign back in
  - [ ] Verify history persists

---

## 🚀 LAUNCH SEQUENCE

### T-6 Hours: Final Preparation
- [ ] Take database backup
- [ ] Take code backup
- [ ] Notify team of launch time
- [ ] Have rollback plan ready

### T-1 Hour: Pre-Flight Check
- [ ] All critical fixes applied ✓
- [ ] All staging tests passed ✓
- [ ] Monitoring/alerting configured ✓
- [ ] Support team briefed ✓
- [ ] Backup running ✓

### T-0: Launch
1. **Deploy to production:**
   ```bash
   # From production environment
   git pull origin main
   npm install
   npm run build
   npm run start  # or use your deployment method
   ```

2. **Verify endpoints:**
   ```bash
   curl https://yourdomain.com/api/health
   # Should return: {"status":"ok","maxUploadSizeMb":100,"service":"ScribeSwift API"}
   ```

3. **Monitor first 30 minutes:**
   - Check server logs for errors
   - Monitor Groq API usage
   - Monitor Supabase database
   - Check error tracking dashboard
   - Respond to any support issues

### T+30 Min: Monitor
- [ ] No critical errors in logs
- [ ] API response times normal (<500ms)
- [ ] Database queries normal
- [ ] Groq API responding well
- [ ] No payment issues reported

### T+2 Hours: Check-in
- [ ] Verify users can sign up
- [ ] Verify transcriptions working
- [ ] Verify premium purchases working
- [ ] Check error logs summary

### T+24 Hours: Post-Launch Review
- [ ] Compile error/issue log
- [ ] Review user feedback
- [ ] Check payment success rate
- [ ] Plan for v1.1 improvements

---

## Rollback Plan (If Critical Issue Found)

If you need to rollback within 24 hours:

```bash
# Revert to previous code version
git revert HEAD  # or checkout previous tag
npm install
npm run build
npm run start

# Restore database from backup
# (depends on your Supabase backup strategy)

# Notify users of issue and ETA for fix
```

**Issues that warrant rollback:**
- Payment processing broken (all payments failing)
- Transcription endpoint down (all uploads failing)
- Database corruption detected
- Security breach confirmed

**Issues that DON'T warrant rollback:**
- Minor UI bugs
- Slow transcriptions
- Single user account issues
- Email notification delays

---

## Success Metrics (First 24 Hours)

Target these KPIs:
- [ ] **Uptime:** ≥99.5%
- [ ] **Transcription Success Rate:** ≥95%
- [ ] **Payment Success Rate:** ≥98%
- [ ] **API Response Time:** <500ms (p95)
- [ ] **Support Response:** <1 hour
- [ ] **Critical Issues:** 0 (by T+24h)

---

## Post-Launch: Monitoring URLs

Monitor these dashboards regularly:
- Supabase Dashboard: https://app.supabase.com
- Paddle Dashboard: https://dashboard.paddle.com
- Server Logs: `tail -f /var/log/scribeswift.log` (or your logging service)
- Error Tracking: [Sentry/LogRocket/etc.]
- Analytics: [Your analytics provider]

---

## Support Escalation

**If issues arise, escalate in this order:**

1. **Tier 1 (15 min response):**
   - Check error logs
   - Restart server if needed
   - Communicate status to users

2. **Tier 2 (30 min response):**
   - Review critical fixes were applied
   - Check database integrity
   - Review environment variables

3. **Tier 3 (60 min response):**
   - Review API logs
   - Check Groq/Paddle status
   - Consider rollback

4. **Escalation:**
   - Contact Groq support (transcription issues)
   - Contact Paddle support (payment issues)
   - Contact Supabase support (database issues)

---

## Critical Contacts

Keep these handy during launch:

- **Groq API Support:** support@groq.com
- **Paddle Support:** support@paddle.com
- **Supabase Support:** support@supabase.com
- **Your Team:** [add contact info]
- **On-call Engineer:** [add phone]

---

## Common Issues & Quick Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Transcription hangs | Groq timeout | Restart server, check GROQ_API_KEY |
| Payment fails silently | Invalid Paddle config | Verify PADDLE_NOTIFICATION_WEBHOOK_SECRET set |
| Users lose history | Supabase down | Check VITE_SUPABASE_URL is correct |
| 404 on /api/transcribe | Server not running | Check port 5173, restart with `npm run start` |
| Premium users can't export | Missing premium check | Verify tier sync in browser (check localStorage) |
| File upload limit errors | Wrong MAX_SIZE_BYTES | Check FileUpload.tsx line 25 (should be 100MB) |

---

## Post-Launch: Week 1 Priorities

After successful launch, focus on:
1. **Monitor stability:** Keep server running, address any issues
2. **User onboarding:** Support first-time users
3. **Payment verification:** Ensure all Paddle payments processed
4. **Feedback collection:** Gather user feedback for v1.1
5. **Performance tuning:** Optimize slow transcriptions

---

**Good luck with your launch! You've got this. 🚀**

