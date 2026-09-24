export const VERCEL_DEPLOYMENT = !!process.env.VERCEL_URL;

// Use secure cookies on Vercel deployments and HTTPS NEXTAUTH_URL (self-hosted Coolify)
export const USE_SECURE_COOKIES =
  VERCEL_DEPLOYMENT ||
  (process.env.NEXTAUTH_URL?.startsWith("https://") ?? false);

export const SESSION_COOKIE_NAME = `${
  USE_SECURE_COOKIES ? "__Secure-" : ""
}next-auth.session-token`;
