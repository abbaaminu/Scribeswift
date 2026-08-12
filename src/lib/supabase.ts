cat > src/lib/supabase.ts << 'SUPABASE_EOF'
import { createClient } from '@supabase/supabase-js';
import { TranscriptionData } from '../types';
 
// Environment variable accessor supporting NEXT_PUBLIC_ and VITE_ prefixes
const getEnvVar = (key: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key]!;
  }
  const metaEnv = (import.meta as any).env;
  if (metaEnv) {
    if (metaEnv[key]) return metaEnv[key];
    if (metaEnv[`VITE_${key}`]) return metaEnv[`VITE_${key}`];
  }
  return '';
};
 
export const supabaseUrl =
  getEnvVar('NEXT_PUBLIC_SUPABASE_URL') ||
  getEnvVar('VITE_SUPABASE_URL') ||
  'https://placeholder-project.supabase.co';
 
export const supabaseAnonKey =
  getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
  getEnvVar('VITE_SUPABASE_ANON_KEY') ||
  'placeholder-anon-key';
 
export const isSupabaseConfigured = Boolean(
  (getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL')) &&
  (getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY')) &&
  !supabaseUrl.includes('placeholder-project')
);
 
if (!getEnvVar('NEXT_PUBLIC_SUPABASE_URL') && !getEnvVar('VITE_SUPABASE_URL')) {
  console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL is missing or not configured.');
}
 
// Safely instantiate Supabase client with fallback check to prevent app crashes
const createSafeSupabaseClient = () => {
  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn('[Supabase] Failed to initialize Supabase client:', err);
    return createClient('https://placeholder-project.supabase.co', 'placeholder-anon-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
};
 
export const supabase = createSafeSupabaseClient();
 
export interface SupabaseProfile {
  id: string;
  is_premium: boolean;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  updated_at?: string;
}
 
/**
* Fetch profile record for a user from Supabase `profiles` table.
*/
export async function fetchUserProfile(userId: string): Promise<SupabaseProfile | null> {
  if (!isSupabaseConfigured) return null;
 
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, is_premium, email, full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();
 
    if (error && error.code !== 'PGRST116') {
      console.warn('Supabase profile fetch notice:', error.message);
    }
    return data as SupabaseProfile | null;
  } catch (err) {
    console.warn('Error querying Supabase profiles table:', err);
    return null;
  }
}
 
/**
* Create or update a user's profile in the `profiles` table.
*/
export async function updateUserPremiumStatus(userId: string, isPremium: boolean, userEmail?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
 
  try {
    const { error } = await supabase.from('profiles').upsert(
      {
        id: userId,
        is_premium: isPremium,
        email: userEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
 
    if (error) {
      console.warn('Supabase profile update warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to update user premium status in Supabase:', err);
    return false;
  }
}
 
// --- Per-account transcription history (synced across devices/browsers) ---
 
interface TranscriptionRow {
  id: string;
  user_id: string;
  title: string;
  file_name: string;
  file_size: number;
  file_type: string;
  duration_seconds: number;
  full_text: string;
  language: string;
  segments: TranscriptionData['segments'];
  summary: TranscriptionData['summary'];
  created_at: string;
}
 
const rowToTranscription = (row: TranscriptionRow): TranscriptionData => ({
  id: row.id,
  title: row.title,
  fileName: row.file_name,
  fileSize: row.file_size,
  fileType: row.file_type,
  durationSeconds: row.duration_seconds,
  fullText: row.full_text,
  language: row.language,
  segments: row.segments || [],
  summary: row.summary || { overview: '', keyPoints: [], actionItems: [], keywords: [] },
  createdAt: row.created_at,
});
 
/**
* Fetch a user's saved transcription history from Supabase, newest first.
*/
export async function fetchUserHistory(userId: string): Promise<TranscriptionData[]> {
  if (!isSupabaseConfigured) return [];
 
  try {
    const { data, error } = await supabase
      .from('transcriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
 
    if (error) {
      console.warn('Supabase history fetch notice:', error.message);
      return [];
    }
    return (data as TranscriptionRow[] || []).map(rowToTranscription);
  } catch (err) {
    console.warn('Error querying Supabase transcriptions table:', err);
    return [];
  }
}
 
/**
* Save (or overwrite) one transcription in a user's history.
*/
export async function saveTranscriptionToHistory(userId: string, item: TranscriptionData): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
 
  try {
    const { error } = await supabase.from('transcriptions').upsert(
      {
        id: item.id,
        user_id: userId,
        title: item.title,
        file_name: item.fileName,
        file_size: item.fileSize,
        file_type: item.fileType,
        duration_seconds: item.durationSeconds,
        full_text: item.fullText,
        language: item.language,
        segments: item.segments,
        summary: item.summary,
        created_at: item.createdAt,
      },
      { onConflict: 'user_id,id' }
    );
 
    if (error) {
      console.warn('Supabase history save warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to save transcription to Supabase history:', err);
    return false;
  }
}
 
/**
* Delete every saved transcription for a user (Clear History action).
*/
export async function clearUserHistory(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
 
  try {
    const { error } = await supabase.from('transcriptions').delete().eq('user_id', userId);
    if (error) {
      console.warn('Supabase history clear warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to clear Supabase history:', err);
    return false;
  }
}
SUPABASE_EOF