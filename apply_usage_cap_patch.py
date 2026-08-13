#!/usr/bin/env python3
"""Patch server.ts to add monthly transcription usage caps.
Run from your repo root: python3 apply_usage_cap_patch.py
Safe to run only once — it checks for existing markers and exits cleanly
if the patch is already applied.
"""
import sys

PATH = "server.ts"

HELPER_ANCHOR = """// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');"""

HELPER_BLOCK = """// --- Monthly transcription caps (adjust these two numbers to retune) ------
const FREE_MONTHLY_TRANSCRIPTION_LIMIT = 5;
const PREMIUM_MONTHLY_TRANSCRIPTION_LIMIT = 100;

const currentPeriod = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const verifyRequestUser = async (req) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
};

const checkUsageCap = async (userId) => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { allowed: true, limit: 0, used: 0 };
  let isPremium = false;
  try {
    const { data: profile } = await supabase.from('profiles').select('is_premium').eq('id', userId).maybeSingle();
    isPremium = Boolean(profile?.is_premium);
  } catch {}
  const limit = isPremium ? PREMIUM_MONTHLY_TRANSCRIPTION_LIMIT : FREE_MONTHLY_TRANSCRIPTION_LIMIT;
  const period = currentPeriod();
  try {
    const { data: usage } = await supabase.from('usage_counters').select('transcription_count').eq('user_id', userId).eq('period', period).maybeSingle();
    const used = usage?.transcription_count || 0;
    return { allowed: used < limit, limit, used };
  } catch {
    return { allowed: true, limit, used: 0 };
  }
};

const incrementUsage = async (userId) => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  const period = currentPeriod();
  try {
    const { data: existing } = await supabase.from('usage_counters').select('transcription_count').eq('user_id', userId).eq('period', period).maybeSingle();
    await supabase.from('usage_counters').upsert(
      { user_id: userId, period, transcription_count: (existing?.transcription_count || 0) + 1, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,period' }
    );
  } catch (err) {
    console.warn('[ScribeSwift] Failed to increment usage counter:', err);
  }
};

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');"""

CAP_CHECK_ANCHOR = """      if (req.file.size > 100 * 1024 * 1024) {
        return res.status(400).json({ error: 'File size exceeds maximum allowed capacity of 100MB.' });
      }

      const groq = getGroqClient();"""

CAP_CHECK_BLOCK = """      if (req.file.size > 100 * 1024 * 1024) {
        return res.status(400).json({ error: 'File size exceeds maximum allowed capacity of 100MB.' });
      }

      let authedUserId = null;
      if (getSupabaseServerClient()) {
        authedUserId = await verifyRequestUser(req);
        if (!authedUserId) {
          return res.status(401).json({ error: 'Please sign in to transcribe files.' });
        }
        const usage = await checkUsageCap(authedUserId);
        if (!usage.allowed) {
          return res.status(429).json({
            error: `You've reached your monthly transcription limit (${usage.used}/${usage.limit}). Upgrade to Premium for a higher limit, or try again next month.`,
          });
        }
      }

      const groq = getGroqClient();"""

INCREMENT_ANCHOR = "      res.json(transcriptionResult);"
INCREMENT_BLOCK = """      if (authedUserId) {
        await incrementUsage(authedUserId);
      }

      res.json(transcriptionResult);"""

def patch():
    with open(PATH, "r", encoding="utf-8") as f:
        content = f.read()

    if "FREE_MONTHLY_TRANSCRIPTION_LIMIT" in content:
        print("Already patched (FREE_MONTHLY_TRANSCRIPTION_LIMIT found) — nothing to do.")
        return

    if content.count(HELPER_ANCHOR) != 1:
        sys.exit("ABORT: helper anchor not found exactly once. No changes made. Contact for manual patch.")
    content = content.replace(HELPER_ANCHOR, HELPER_BLOCK, 1)

    if content.count(CAP_CHECK_ANCHOR) != 1:
        sys.exit("ABORT: cap-check anchor not found exactly once. Helper block WAS inserted — re-run may double it, check git diff before retrying.")
    content = content.replace(CAP_CHECK_ANCHOR, CAP_CHECK_BLOCK, 1)

    if content.count(INCREMENT_ANCHOR) != 1:
        sys.exit("ABORT: increment anchor not found exactly once (or found multiple times). Manual fix needed for this last step.")
    content = content.replace(INCREMENT_ANCHOR, INCREMENT_BLOCK, 1)

    with open(PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print("Patch applied successfully.")

if __name__ == "__main__":
    patch()
