import { createClient } from '@supabase/supabase-js';

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
