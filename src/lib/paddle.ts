import { initializePaddle, Paddle } from '@paddle/paddle-js';

// Environment variable helper
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

export const paddleClientToken =
  getEnvVar('NEXT_PUBLIC_PADDLE_CLIENT_TOKEN') ||
  getEnvVar('VITE_PADDLE_CLIENT_TOKEN') ||
  '';

if (!paddleClientToken) {
  console.warn('[Paddle] NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is missing or not configured.');
}

export const paddlePriceId =
  getEnvVar('NEXT_PUBLIC_PADDLE_PRICE_ID') ||
  getEnvVar('VITE_PADDLE_PRICE_ID') ||
  '';

export const paddleMonthlyPriceId =
  getEnvVar('NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID') ||
  getEnvVar('VITE_PADDLE_MONTHLY_PRICE_ID') ||
  paddlePriceId ||
  '';

export const paddleYearlyPriceId =
  getEnvVar('NEXT_PUBLIC_PADDLE_YEARLY_PRICE_ID') ||
  getEnvVar('VITE_PADDLE_YEARLY_PRICE_ID') ||
  paddlePriceId ||
  '';

// Validate price IDs are configured
if (!paddleMonthlyPriceId && !paddleYearlyPriceId) {
  console.warn(
    '[Paddle] Neither monthly nor yearly price IDs are configured. Set VITE_PADDLE_MONTHLY_PRICE_ID, VITE_PADDLE_YEARLY_PRICE_ID, or VITE_PADDLE_PRICE_ID in your environment.'
  );
}

export const paddleEnvironment = (
  getEnvVar('NEXT_PUBLIC_PADDLE_ENV') ||
  getEnvVar('PADDLE_ENV') ||
  'sandbox'
) as 'sandbox' | 'production';

// --- Diagnostics: catch the classic token/environment mismatch early ---
if (paddleClientToken) {
  const tokenLooksLive = paddleClientToken.startsWith('live_');
  const tokenLooksTest = paddleClientToken.startsWith('test_');
  if (paddleEnvironment === 'production' && tokenLooksTest) {
    console.error(
      '[Paddle] Mismatch: VITE_PADDLE_ENV is "production" but your client token starts with "test_" (a sandbox token). Use a "live_" token, or set VITE_PADDLE_ENV=sandbox.'
    );
  } else if (paddleEnvironment === 'sandbox' && tokenLooksLive) {
    console.error(
      '[Paddle] Mismatch: VITE_PADDLE_ENV is "sandbox" but your client token starts with "live_" (a production token). Use a "test_" token, or set VITE_PADDLE_ENV=production.'
    );
  }
  console.log(`[Paddle] Initializing in "${paddleEnvironment}" mode with a "${paddleClientToken.slice(0, 5)}..." token.`);
}

let paddleInstancePromise: Promise<Paddle | undefined> | null = null;

// Paddle.Initialize takes a single global eventCallback (it's not passed per
// Checkout.open call), so we keep a reference to whichever checkout is
// currently open and route Paddle's checkout.completed/closed events to it.
let activeCheckoutCallbacks: { onSuccess?: () => void; onClose?: () => void } = {};

/**
 * Get or initialize Paddle SDK instance singleton
 */
export async function getPaddleInstance(): Promise<Paddle | undefined> {
  if (!paddleClientToken) {
    console.warn('[Paddle] NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not configured.');
    return undefined;
  }

  if (!paddleInstancePromise) {
    paddleInstancePromise = initializePaddle({
      token: paddleClientToken,
      environment: paddleEnvironment,
      eventCallback: (event) => {
        if (event?.name === 'checkout.completed') {
          activeCheckoutCallbacks.onSuccess?.();
        } else if (event?.name === 'checkout.closed') {
          activeCheckoutCallbacks.onClose?.();
        } else if (event?.name === 'checkout.error') {
          console.error('[Paddle] checkout.error event:', event.data);
        }
      },
    });
  }

  return paddleInstancePromise;
}

export interface OpenPaddleCheckoutOptions {
  priceId?: string;
  billingPeriod?: 'monthly' | 'yearly';
  userId?: string;
  userEmail?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

/**
 * Open Paddle Checkout modal with customData containing userId
 */
export async function openPaddleCheckout(options: OpenPaddleCheckoutOptions): Promise<boolean> {
  const paddle = await getPaddleInstance();

  let selectedPriceId = options.priceId;
  if (!selectedPriceId) {
    if (options.billingPeriod === 'yearly') {
      selectedPriceId = paddleYearlyPriceId || paddleMonthlyPriceId || paddlePriceId;
    } else {
      selectedPriceId = paddleMonthlyPriceId || paddleYearlyPriceId || paddlePriceId;
    }
  }

  if (!paddle) {
    console.error('[Paddle] Cannot open checkout: Paddle SDK failed to initialize.');
    return false;
  }

  if (!selectedPriceId) {
    console.error(
      `[Paddle] Cannot open checkout: No price ID found for ${options.billingPeriod || 'monthly'} billing.`,
      `Monthly ID: ${paddleMonthlyPriceId}`,
      `Yearly ID: ${paddleYearlyPriceId}`,
      `General ID: ${paddlePriceId}`
    );
    return false;
  }

  console.log(`[Paddle] Opening checkout with price ID: ${selectedPriceId} (${options.billingPeriod || 'monthly'} billing)`);

  activeCheckoutCallbacks = { onSuccess: options.onSuccess, onClose: options.onClose };

  try {
    paddle.Checkout.open({
      items: [
        {
          priceId: selectedPriceId,
          quantity: 1,
        },
      ],
      customData: {
        userId: options.userId || '',
        user_id: options.userId || '',
        source: 'ScribeSwift',
      },
      customer: options.userEmail
        ? {
            email: options.userEmail,
          }
        : undefined,
      settings: {
        displayMode: 'overlay',
        theme: 'dark',
      },
    });

    return true;
  } catch (err) {
    console.error('[Paddle] Error launching Paddle checkout:', err);
    return false;
  }
}
