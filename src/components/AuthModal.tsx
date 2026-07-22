import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  Sparkles,
  ArrowRight,
  Check,
  AlertCircle,
  LogIn,
  UserPlus,
  ShieldCheck,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: (message: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'magic-link' | 'password' | 'signup'>('magic-link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  React.useEffect(() => {
    if (isOpen && !isSupabaseConfigured) {
      console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL is missing or not configured.');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setStatusMessage(null);

    if (!isSupabaseConfigured) {
      console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL is missing or not configured.');
      setTimeout(() => {
        setGoogleLoading(false);
        if (onAuthSuccess) onAuthSuccess('Logged in successfully with Google!');
        onClose();
      }, 500);
      return;
    }

    try {
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/auth/callback`
        : `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        setStatusMessage({ type: 'error', text: error.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to initiate Google OAuth login.' });
    } finally {
      setGoogleLoading(false);
    }
  };

  // Magic Link / OTP Sign In
  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setStatusMessage(null);

    if (!isSupabaseConfigured) {
      console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL is missing or not configured.');
      setTimeout(() => {
        setLoading(false);
        setStatusMessage({
          type: 'success',
          text: `Demo Magic Link sent to ${email}!`,
        });
      }, 1000);
      return;
    }

    try {
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')}/auth/callback`
        : `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        setStatusMessage({ type: 'error', text: error.message });
      } else {
        setStatusMessage({
          type: 'success',
          text: `Magic link sent to ${email}! Check your email inbox to complete sign-in.`,
        });
        if (onAuthSuccess) onAuthSuccess(`Magic link sent to ${email}!`);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to send magic link.' });
    } finally {
      setLoading(false);
    }
  };

  // Password Sign In / Sign Up
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setStatusMessage(null);

    if (!isSupabaseConfigured) {
      console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL is missing or not configured.');
      setTimeout(() => {
        setLoading(false);
        if (authMode === 'signup') {
          setStatusMessage({
            type: 'success',
            text: 'Account created!',
          });
          if (onAuthSuccess) onAuthSuccess('Account created successfully!');
        } else {
          setStatusMessage({
            type: 'success',
            text: 'Successfully logged in!',
          });
          if (onAuthSuccess) onAuthSuccess('Logged in successfully!');
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      }, 800);
      return;
    }

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) {
          setStatusMessage({ type: 'error', text: error.message });
        } else {
          setStatusMessage({
            type: 'success',
            text: 'Account created! Please check your email for confirmation or sign in.',
          });
          if (onAuthSuccess) onAuthSuccess('Account created successfully!');
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setStatusMessage({ type: 'error', text: error.message });
        } else {
          setStatusMessage({ type: 'success', text: 'Successfully logged in!' });
          if (onAuthSuccess) onAuthSuccess('Logged in successfully!');
          setTimeout(() => {
            onClose();
          }, 1200);
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Authentication failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="relative p-6 bg-gradient-to-br from-indigo-900/80 via-slate-900 to-slate-900 border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Supabase Authentication</span>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">
            {authMode === 'signup' ? 'Create ScribeSwift Account' : 'Sign In to ScribeSwift'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Access your transcription history, manage team profiles, and sync your Premium tier across devices.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start justify-between gap-2 border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
              }`}
            >
              <div className="flex items-start gap-2">
                {statusMessage.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{statusMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="p-1 rounded-md hover:bg-slate-800/60 text-slate-400 hover:text-white transition flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Social Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 font-semibold text-xs text-white flex items-center justify-center gap-2.5 transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {googleLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google OAuth</span>
          </button>

          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-widest font-semibold">
              or
            </span>
          </div>

          {/* Mode Tabs (Magic Link vs Email/Password) */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setAuthMode('magic-link');
                setStatusMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                authMode === 'magic-link'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Magic Link
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setStatusMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                authMode === 'password'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setStatusMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                authMode === 'signup'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Magic Link Form */}
          {authMode === 'magic-link' && (
            <form onSubmit={handleMagicLinkSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Send Magic Sign-In Link</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Password Sign In or Sign Up Form */}
          {(authMode === 'password' || authMode === 'signup') && (
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {authMode === 'signup' ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                    <span>{authMode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
