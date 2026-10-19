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
  // each video response is capped to this many bytes so access is re-checked every few seconds
  mediaChunkBytes: Number(env.MEDIA_CHUNK_BYTES || 2 * 1024 * 1024),
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
