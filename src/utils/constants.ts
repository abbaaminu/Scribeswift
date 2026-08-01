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

export const CONTACT_EMAIL =
  getEnvVar('VITE_CONTACT_EMAIL') ||
  getEnvVar('NEXT_PUBLIC_CONTACT_EMAIL') ||
  'abbaaminu201215@gmail.com';
