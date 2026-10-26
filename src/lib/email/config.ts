// Pure (no server-only import) so it can be unit-tested.

export type EmailConfig = { host: string; port: number; user: string; pass: string; from: string };

type Env = Record<string, string | undefined>;

/**
 * Brevo SMTP settings from the environment, or null when email isn't set up —
 * in which case the app simply doesn't send mail (nothing else changes).
 */
export function readEmailConfig(env: Env = process.env): EmailConfig | null {
  const user = env.BREVO_SMTP_LOGIN?.trim();
  const pass = env.BREVO_SMTP_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!user || !pass || !from) return null;
  return {
    host: env.BREVO_SMTP_HOST?.trim() || "smtp-relay.brevo.com",
    port: Number(env.BREVO_SMTP_PORT) || 587,
    user,
    pass,
    from,
  };
}

/** Public origin used for links in emails: `APP_URL` if set, else the host the request came in on. */
export function appBaseUrl(env: Env, request?: { host?: string | null; proto?: string | null }): string | null {
  const explicit = env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (!request?.host) return null;
  const proto = request.proto?.split(",")[0].trim() || (/^(localhost|127\.0\.0\.1)(:|$)/.test(request.host) ? "http" : "https");
  return `${proto}://${request.host.split(",")[0].trim()}`;
}
