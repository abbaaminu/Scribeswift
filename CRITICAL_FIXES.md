# ScribeSwift - Critical Fixes Implementation Guide

## Fix Priority: CRITICAL (Must do before launch)

---

## CRITICAL FIX #1: Usage Cap Race Condition

### Problem
Multiple concurrent uploads can bypass the monthly transcription limit because the check happens before upload starts, not atomically with recording the usage.

### Solution
Create a database function for atomic increment and use it:

**Step 1:** Add to your `supabase-setup.sql`:
```sql
-- Create function to atomically check and increment usage
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
  -- Set limit based on tier
  user_limit := CASE WHEN is_premium THEN 90 ELSE 5 END;
  
  -- Atomic check and increment
  INSERT INTO transcription_usage (user_id, period, count)
  VALUES (user_id, period_string, 1)
  ON CONFLICT (user_id, period)
  DO UPDATE SET count = count + 1
  RETURNING count INTO current_usage;
  
  -- Return result
  RETURN QUERY SELECT
    (current_usage <= user_limit)::BOOLEAN as allowed,
    current_usage as used_count,
    user_limit as limit_count;
END;
$$ LANGUAGE plpgsql;
```

**Step 2:** Update `server.ts` - Replace `checkUsageCap()` function:

```typescript
const checkAndIncrementUsageCap = async (userId: string) => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { allowed: true, limit: 0, used: 0 };

  let isPremium = false;
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', userId)
      .maybeSingle();
    isPremium = Boolean(profile?.is_premium);
  } catch {}

  const period = currentPeriod();

  try {
    const { data, error } = await supabase.rpc(
      'check_and_increment_transcription_usage',
      {
        user_id: userId,
        period_string: period,
        is_premium: isPremium,
      }
    );

    if (error || !data?.[0]) {
      console.error('[UsageCap] Error checking usage:', error);
      return { allowed: false, limit: 0, used: 0 };
    }

    const result = data[0];
    return {
      allowed: result.allowed,
      limit: result.limit_count,
      used: result.used_count,
    };
  } catch (e) {
    console.error('[UsageCap] Exception checking usage:', e);
    return { allowed: false, limit: 0, used: 0 };
  }
};

// Update the transcribe endpoint to use this:
app.post('/api/transcribe', async (req, res) => {
  try {
    // ... existing code ...

    const usageCap = await checkAndIncrementUsageCap(userId);
    if (!usageCap.allowed) {
      return res.status(429).json({
        error: `Monthly transcription limit reached (${usageCap.used}/${usageCap.limit}). Upgrade to Premium for higher limits.`,
      });
    }

    // ... continue with transcription ...
  } catch (e) {
    // ...
  }
});
```

---

## CRITICAL FIX #2: Paddle Webhook Security

### Problem
Webhooks can be forged to grant free premium access without actual payment.

### Solution
Add timestamp validation and make secret mandatory:

**Replace the `verifyPaddleSignature()` function in `server.ts`:**

```typescript
const verifyPaddleSignature = (req: any): boolean => {
  const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET;
  
  // CRITICAL: Webhook secret is mandatory
  if (!secret) {
    console.error('[CRITICAL] PADDLE_NOTIFICATION_WEBHOOK_SECRET environment variable is REQUIRED but not set.');
    console.error('[CRITICAL] Paddle webhooks will be rejected until this is configured.');
    return false;
  }

  const signatureHeader = req.headers['paddle-signature'];
  if (!signatureHeader || !req.rawBody) {
    console.warn('[Paddle Webhook] Missing signature header or raw body');
    return false;
  }

  // Parse the signature header: "ts=1234567890;h1=signature_hash"
  const parts = Object.fromEntries(
    String(signatureHeader)
      .split(';')
      .filter(Boolean)
      .map((p) => {
        const [key, value] = p.split('=');
        return [key?.trim(), value?.trim()];
      })
  );

  const ts = parts.ts ? parseInt(parts.ts) : null;
  const h1 = parts.h1;

  if (!ts || !h1) {
    console.warn('[Paddle Webhook] Invalid signature format');
    return false;
  }

  // ADD TIMESTAMP VALIDATION: Reject old webhooks (replay attack prevention)
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageDifference = Math.abs(nowSeconds - ts);
  const maxAgeSeconds = 300; // 5 minutes

  if (ageDifference > maxAgeSeconds) {
    console.warn(
      `[Paddle Webhook] Timestamp too old: ${ageDifference} seconds. Max allowed: ${maxAgeSeconds} seconds`
    );
    return false;
  }

  // Compute expected signature
  const rawBodyStr = req.rawBody.toString('utf8');
  const signedPayload = `${ts}:${rawBodyStr}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Timing-safe comparison
  try {
    const result = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(h1, 'hex')
    );
    
    if (result) {
      console.log('[Paddle Webhook] ✓ Signature verified successfully');
    }
    
    return result;
  } catch (e) {
    console.warn('[Paddle Webhook] Signature verification failed - invalid format or mismatch');
    return false;
  }
};
```

Also, add this before the webhook handler to ensure the secret exists:

```typescript
// Add this near the top of the app setup, BEFORE defining webhook routes
const validatePaddleConfig = () => {
  if (!process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET) {
    console.error(
      '[CRITICAL] PADDLE_NOTIFICATION_WEBHOOK_SECRET is not set in environment variables.'
    );
    console.error(
      '[CRITICAL] Paddle webhook authentication will fail. Set this immediately for production.'
    );
    // Don't crash, but warn clearly
  }
};

// Call this on app startup
validatePaddleConfig();

// In webhook handler, also add rate limiting:
const webhookRateLimiter = {}; // { userId: { count: number; resetTime: number } }

app.post('/api/webhooks/paddle', async (req, res) => {
  try {
    if (!verifyPaddleSignature(req)) {
      console.warn('[Paddle Webhook] Rejected request with invalid or missing signature.');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const payload = req.body || {};
    const userId = payload.data?.custom_data?.userId || payload.custom_data?.userId;

    // Rate limit per user: max 10 webhook events per 60 seconds
    if (userId) {
      const now = Date.now();
      if (!webhookRateLimiter[userId]) {
        webhookRateLimiter[userId] = { count: 0, resetTime: now + 60000 };
      }
      
      if (now > webhookRateLimiter[userId].resetTime) {
        webhookRateLimiter[userId] = { count: 0, resetTime: now + 60000 };
      }
      
      webhookRateLimiter[userId].count++;
      
      if (webhookRateLimiter[userId].count > 10) {
        console.warn(`[Paddle Webhook] Rate limit exceeded for user ${userId}`);
        return res.status(429).json({ error: 'Too many webhook requests' });
      }
    }

    // ... rest of webhook handler
  } catch (err: any) {
    // ...
  }
});
```

---

## CRITICAL FIX #3: Groq Transcription Timeout & Retry

### Problem
Transcription calls to Groq API can hang indefinitely with no timeout or retry logic.

### Solution
Add timeout wrapper and retry logic:

**Add this to `server.ts` after the imports:**

```typescript
// Timeout wrapper for async operations
const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number = 30000,
  operationName: string = 'Operation'
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
      timeoutMs
    )
  );
  return Promise.race([promise, timeoutPromise]);
};

// Retry wrapper for transient failures
const withRetry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
  operationName: string = 'Operation'
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `[${operationName}] Attempt ${attempt}/${maxAttempts}`
      );
      return await fn();
    } catch (err: any) {
      lastError = err;
      console.warn(
        `[${operationName}] Attempt ${attempt} failed:`,
        err.message
      );

      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(
          `[${operationName}] Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`${operationName} failed after ${maxAttempts} attempts`);
};
```

**Update `transcribeChunkWithGroq()` function:**

```typescript
const transcribeChunkWithGroq = async (
  groq: Groq,
  filePath: string,
  language: string
): Promise<{ text: string; duration: number; segments: Array<{ start: number; end: number; text: string }> }> => {
  const langCode = LANGUAGE_CODE_MAP[language];

  return withRetry(
    async () => {
      const response: any = await withTimeout(
        groq.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: 'whisper-large-v3-turbo',
          response_format: 'verbose_json',
          timestamp_granularities: ['segment'],
          ...(langCode ? { language: langCode } : {}),
        } as any),
        40000, // 40 second timeout
        'Groq transcription'
      );

      const segments = (response.segments || []).map((seg: any) => ({
        start: typeof seg.start === 'number' ? seg.start : 0,
        end: typeof seg.end === 'number' ? seg.end : 0,
        text: (seg.text || '').trim(),
      }));

      return {
        text: (response.text || '').trim(),
        duration: typeof response.duration === 'number' ? response.duration : 0,
        segments,
      };
    },
    3, // 3 attempts
    1000, // 1 second initial delay
    `Groq transcription for file ${path.basename(filePath)}`
  );
};
```

**Update speaker/summary generation similarly:**

```typescript
const generateSpeakersAndSummary = async (
  groq: Groq,
  segments: Array<{ startTime: number; endTime: number; text: string }>,
  detectedLanguage: string
): Promise<{
  speakers: string[];
  summary: { overview: string; keyPoints: string[]; actionItems: string[]; keywords: string[] };
}> => {
  const fallback = {
    speakers: segments.map(() => 'Speaker 1'),
    summary: {
      overview: 'Transcription complete.',
      keyPoints: [],
      actionItems: [],
      keywords: [],
    },
  };

  if (segments.length === 0) return fallback;

  try {
    const transcriptForPrompt = segments
      .map((seg, idx) => `[${idx}] (${seg.startTime.toFixed(1)}s-${seg.endTime.toFixed(1)}s) ${seg.text}`)
      .join('\n');

    const completion = await withTimeout(
      withRetry(
        async () =>
          groq.chat.completions.create({
            model: 'openai/gpt-oss-120b',
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'You are ScribeSwift, a world-class transcript analyst. You infer speaker turns from context and produce concise executive summaries. Always respond with strict JSON only, matching the requested schema exactly.',
              },
              {
                role: 'user',
                content: `The transcript below (language: ${detectedLanguage}) is a numbered list of timestamped segments...
                ${transcriptForPrompt}
                ...Respond with ONLY this JSON shape...`,
              },
            ],
          }),
        2, // 2 attempts for LLM
        500,
        'Speaker/summary generation'
      ),
      20000, // 20 second timeout for LLM
      'Speaker/summary generation'
    );

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    const speakers: string[] = Array.isArray(parsed.speakers) ? parsed.speakers : [];

    return {
      speakers:
        speakers.length === segments.length
          ? speakers.map((s) => (typeof s === 'string' && s.trim() ? s.trim() : 'Speaker 1'))
          : fallback.speakers,
      summary: {
        overview: parsed.summary?.overview || fallback.summary.overview,
        keyPoints: Array.isArray(parsed.summary?.keyPoints) ? parsed.summary.keyPoints : [],
        actionItems: Array.isArray(parsed.summary?.actionItems) ? parsed.summary.actionItems : [],
        keywords: Array.isArray(parsed.summary?.keywords) ? parsed.summary.keywords : [],
      },
    };
  } catch (err) {
    console.error('[ScribeSwift] Speaker/summary generation failed, using fallback:', err);
    return fallback;
  }
};
```

---

## CRITICAL FIX #4: Remove Simulated Payment Form

### Problem
The subscription modal has a hardcoded fake payment form that grants premium access without actual payment.

### Solution
Delete this function entirely from `src/components/SubscriptionModal.tsx`:

**Remove lines 95-140 (the entire `handleSubscribeDirect` function and form):**

```typescript
// DELETE THIS ENTIRE SECTION:
/*
const handleSubscribeDirect = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!user) {
    setStatusNotice('Please sign in before upgrading to Premium.');
    return;
  }
  setLoading(true);
  
  // ... all of this should be deleted ...
  
  onSubscribeSuccess();
  onClose();
};
*/
```

Also remove these state variables that were only used for the fake form:
```typescript
// DELETE THESE:
const [cardNumber, setCardNumber] = useState('');
const [expDate, setExpDate] = useState('');
const [cvc, setCvc] = useState('');
const [name, setName] = useState('');
const [loading, setLoading] = useState(false); // (keep setPaddleLoading though)
```

And remove this button:
```typescript
// DELETE: The "Card Payment", "Quick Fill", etc. section in the form
```

**Result:** Only Paddle checkout should be the payment method:

```typescript
export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  user,
  onClose,
  onSubscribeSuccess,
}) => {
  const [paddleLoading, setPaddleLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const isPaddleConfigured = Boolean(paddleClientToken && (paddleMonthlyPriceId || paddleYearlyPriceId || paddlePriceId));
  
  // ... rest of component - ONLY Paddle payment UI ...
};
```

---

## Testing Checklist for Critical Fixes

```
BEFORE LAUNCHING, TEST:

□ Usage Cap Fix
  □ Upload file as free user (should work)
  □ Upload 5 more files (6th should be blocked with 429)
  □ Try 2 simultaneous uploads (both should be counted)
  □ Verify error message is user-friendly

□ Paddle Webhook Security
  □ Send webhook without signature header (should reject)
  □ Send webhook with invalid secret (should reject)
  □ Send old webhook (>5 min old timestamp) (should reject)
  □ Send valid webhook (should succeed)
  □ Verify premium status updates in database

□ Groq Timeout & Retry
  □ Test with 100MB file (should complete with retries if needed)
  □ Simulate Groq API timeout (kill connection) (should retry)
  □ Test with 3-hour audio file (should chunk and transcribe all)
  □ Verify error message if all retries fail

□ Remove Fake Payment
  □ Verify no "Quick Fill Card" button exists
  □ Verify no card input fields exist
  □ Verify only Paddle checkout is available
  □ Test complete Paddle payment flow

□ Deployment
  □ All env vars set correctly
  □ Database function created and working
  □ Paddle webhook configured in dashboard
  □ Paddle webhook secret set in environment
  □ Supabase RLS policies enabled
```

---

**Apply these fixes immediately to avoid critical security/reliability issues before launch.**

