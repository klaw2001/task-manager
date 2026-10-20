import path from 'node:path';

const env = process.env;
const production = env.NODE_ENV === 'production';

if (production && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production');
}

export const config = {
  production,
  port: Number(env.PORT || 3000),
  databaseUrl: env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/lms',
  databaseSsl: env.DATABASE_SSL === 'true',
  databaseSslCaFile: env.DATABASE_SSL_CA_FILE || '',
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me-dev-only-secret',
  // only FAILED sign-ins count (a whole outlet shares one IP), per 15 minutes
  loginFailuresPerIp: Number(env.LOGIN_FAILURES_PER_IP || 50),
  loginFailuresPerAccount: Number(env.LOGIN_FAILURES_PER_ACCOUNT || 10),
  sessionHours: Number(env.SESSION_HOURS || 8),
  // shift windows are evaluated in this timezone
  timezone: env.APP_TIMEZONE || 'Asia/Kolkata',
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : production,
  // public address of the app, used for links in emails
  appUrl: (env.APP_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  // Bunny Stream: all video is uploaded to, transcoded by and streamed (HLS) from Bunny
  bunny: {
    libraryId: env.BUNNY_STREAM_LIBRARY_ID || '',
    apiKey: env.BUNNY_STREAM_API_KEY || '',
    // the library's CDN hostname (Stream > API), e.g. vz-1234abcd-xyz.b-cdn.net
    cdnUrl: env.BUNNY_CDN_HOSTNAME ? (/^https?:\/\//.test(env.BUNNY_CDN_HOSTNAME) ? env.BUNNY_CDN_HOSTNAME : `https://${env.BUNNY_CDN_HOSTNAME}`).replace(/\/+$/, '') : '',
    // the pull zone's "URL Token Authentication Key" (CDN > pull zone > Security)
    tokenKey: env.BUNNY_TOKEN_KEY || '',
    // how long a playback URL works. Access removal / shift end stops playback within about this long.
    tokenTtlSeconds: Number(env.BUNNY_TOKEN_TTL_SECONDS || 600),
    apiBase: (env.BUNNY_API_BASE || 'https://video.bunnycdn.com').replace(/\/+$/, ''),
    tusEndpoint: env.BUNNY_TUS_ENDPOINT || 'https://video.bunnycdn.com/tusupload',
  },
  // Brevo SMTP relay (leave SMTP_USER / SMTP_PASS empty to keep email switched off)
  smtp: {
    host: env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : Number(env.SMTP_PORT) === 465,
    requireTls: env.SMTP_REQUIRE_TLS !== 'false',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    // must be a sender / domain you have validated in Brevo, e.g. "Staff Training <training@yourcompany.com>"
    from: env.MAIL_FROM || '',
  },
  reminders: {
    enabled: env.REMINDERS_ENABLED !== 'false',
    intervalMinutes: Number(env.REMINDER_INTERVAL_MINUTES || 30),
    // emails are only sent between these hours (APP_TIMEZONE)
    startHour: Number(env.REMINDER_START_HOUR || 8),
    endHour: Number(env.REMINDER_END_HOUR || 20),
    dueSoonDays: Number(env.REMINDER_DUE_SOON_DAYS || 3),
  },
  storage: {
    driver: env.STORAGE_DRIVER || 'local', // 'local' | 's3'
    bucket: env.S3_BUCKET || '',
    region: env.AWS_REGION || 'ap-south-1',
    // only for S3-compatible stores such as MinIO / LocalStack in development
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    localDir: path.resolve(env.LOCAL_STORAGE_DIR || 'uploads'),
    maxUploadMb: Number(env.MAX_UPLOAD_MB || 1024),
    uploadUrlSeconds: 15 * 60,
  },
};
