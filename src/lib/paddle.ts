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

export const paddleEnvironment = (
  getEnvVar('NEXT_PUBLIC_PADDLE_ENV') ||
  getEnvVar('PADDLE_ENV') ||
  'sandbox'
) as 'sandbox' | 'production';

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
        }
      },
    });
  }

  return paddleInstancePromise;
}

export interface OpenPaddleCheckoutOptions {
  priceId?: string;
  userId?: string;
  userEmail?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

/**
 * Open Paddle Checkout modal with customData containing userId
 */
export async function openPaddleCheckout(options: OpenPaddleCheckoutOptions): Promise<boolean> {
  const priceId = options.priceId || paddlePriceId;
  const paddle = await getPaddleInstance();

  if (!paddle || !priceId) {
    console.warn('[Paddle] Cannot open checkout: missing paddle instance or price ID.');
    return false;
  }

  activeCheckoutCallbacks = { onSuccess: options.onSuccess, onClose: options.onClose };

  try {
    paddle.Checkout.open({
      items: [
        {
          priceId: priceId,
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
