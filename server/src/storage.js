import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from './config.js';
import { badRequest } from './errors.js';

// Videos are not stored here: they go to Bunny Stream (see bunny.js). This is for images and PDFs.
const TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  pdf: ['application/pdf'],
};
export const UPLOAD_KINDS = Object.keys(TYPES);
const KEY_PATTERN = /^(image|pdf)s\/[0-9a-f-]{36}\/[\w.-]{1,120}$/;

export const isValidKey = (key) => KEY_PATTERN.test(key);

export function newKey(kind, filename, contentType) {
  if (!TYPES[kind]?.includes(contentType)) throw badRequest(`Unsupported ${kind} type: ${contentType}`);
  const safe = filename.replace(/[^\w.-]/g, '_').slice(-100) || kind;
  return `${kind}s/${randomUUID()}/${safe}`;
}

export const EXT_TYPES = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** Both drivers expose head(key) -> { size, contentType } | null and read(key, start, endInclusive) -> readable. */
function localDriver() {
  const resolve = (key) => {
    const p = path.resolve(config.storage.localDir, key);
    if (!p.startsWith(config.storage.localDir + path.sep)) throw badRequest('Invalid key');
    return p;
  };
  return {
    async createUpload(key) {
      return { url: `/api/admin/uploads/local/${key}`, method: 'PUT' };
    },
    async save(key, readable, maxBytes) {
      const file = resolve(key);
      await fsp.mkdir(path.dirname(file), { recursive: true });
      let bytes = 0;
      const limiter = new Transform({
        transform(chunk, _enc, cb) {
          bytes += chunk.length;
          if (bytes > maxBytes) return cb(badRequest('File too large', 'FILE_TOO_LARGE'));
          cb(null, chunk);
        },
      });
      try {
        await pipeline(readable, limiter, fs.createWriteStream(file));
      } catch (err) {
        await fsp.rm(file, { force: true });
        throw err;
      }
    },
    async head(key) {
      const stat = await fsp.stat(resolve(key)).catch(() => null);
      if (!stat) return null;
      const contentType = EXT_TYPES[path.extname(key).toLowerCase()] || 'application/octet-stream';
      return { size: stat.size, contentType };
    },
    async read(key, start, end) {
      return fs.createReadStream(resolve(key), { start, end });
    },
  };
}

function s3Driver() {
  const { bucket, region, uploadUrlSeconds, endpoint, forcePathStyle } = config.storage;
  if (!bucket) throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
  const s3 = new S3Client({ region, endpoint, forcePathStyle }); // credentials come from the task/instance IAM role
  return {
    async createUpload(key, contentType) {
      const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: uploadUrlSeconds });
      return { url, method: 'PUT', headers: { 'Content-Type': contentType } };
    },
    async head(key) {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })).catch(() => null);
      return head ? { size: head.ContentLength, contentType: head.ContentType || 'application/octet-stream' } : null;
    },
    async read(key, start, end) {
      const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=${start}-${end}` }));
      return obj.Body;
    },
  };
}

export const storage = config.storage.driver === 's3' ? s3Driver() : localDriver();
