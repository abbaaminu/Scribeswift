// Constants and environment configuration
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

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

export const PREMIUM_MONTHLY_PRICE_USD = Number(
  getEnvVar('VITE_SUBSCRIPTION_MONTHLY_PRICE_USD') ||
    getEnvVar('NEXT_PUBLIC_SUBSCRIPTION_MONTHLY_PRICE_USD') ||
    '5'
);

export const PREMIUM_YEARLY_PRICE_USD = Number(
  getEnvVar('VITE_SUBSCRIPTION_YEARLY_PRICE_USD') ||
    getEnvVar('NEXT_PUBLIC_SUBSCRIPTION_YEARLY_PRICE_USD') ||
    '55'
);

export const PREMIUM_PRICE_USD = PREMIUM_MONTHLY_PRICE_USD;
export const PREMIUM_PRICE_TEXT = `${formatCurrency(PREMIUM_PRICE_USD)}/mo`;
export const PREMIUM_PRICE_VALUE = formatCurrency(PREMIUM_PRICE_USD);
export const PREMIUM_YEARLY_PRICE_TEXT = `${formatCurrency(PREMIUM_YEARLY_PRICE_USD)}/yr`;
export const PREMIUM_YEARLY_PRICE_VALUE = formatCurrency(PREMIUM_YEARLY_PRICE_USD);

export const CONTACT_EMAIL =
  getEnvVar('VITE_CONTACT_EMAIL') ||
  getEnvVar('NEXT_PUBLIC_CONTACT_EMAIL') ||
  'abbaaminu201215@gmail.com';
