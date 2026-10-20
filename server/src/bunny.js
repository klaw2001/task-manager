import crypto from 'node:crypto';
import { config } from './config.js';
import { HttpError, badRequest } from './errors.js';

/** Bunny Stream video IDs are GUIDs. */
export const VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const bunnyEnabled = () => {
  const b = config.bunny;
  return Boolean(b.libraryId && b.apiKey && b.cdnUrl && b.tokenKey);
};

export function requireBunny() {
  if (!bunnyEnabled()) {
    throw new HttpError(503, 'VIDEO_NOT_CONFIGURED', 'Video hosting is not set up yet. Add the Bunny Stream settings (see docs/BUNNY.md).');
  }
}

async function call(method, path, body) {
  const { apiBase, libraryId, apiKey } = config.bunny;
  let res;
  try {
    res = await fetch(`${apiBase}/library/${libraryId}${path}`, {
      method,
      headers: { AccessKey: apiKey, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new HttpError(502, 'VIDEO_SERVICE_UNREACHABLE', `Could not reach the video service (${err.name === 'TimeoutError' ? 'timed out' : err.message})`);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new HttpError(502, 'VIDEO_SERVICE_ERROR', res.status === 401 ? 'The video service rejected the API key' : `The video service returned an error (${res.status})`);
  }
  return res.json();
}

/** Creates an empty video object; the browser then uploads the file to it (see tusAuth). Returns the video GUID. */
export async function createVideo(title) {
  requireBunny();
  const video = await call('POST', '/videos', { title: title.slice(0, 200) });
  return video.guid;
}

// Bunny's numeric `status` -> what we show
const STATE = { 0: 'created', 1: 'uploaded', 2: 'processing', 3: 'transcoding', 4: 'ready', 5: 'error', 6: 'upload_failed', 7: 'processing', 8: 'ready' };

/** { state, ready, progress, length (seconds), resolutions } or null if Bunny has no such video. */
export async function getVideo(videoId) {
  requireBunny();
  const v = await call('GET', `/videos/${videoId}`);
  if (!v) return null;
  const state = STATE[v.status] ?? 'processing';
  return {
    state,
    ready: state === 'ready',
    progress: v.encodeProgress ?? 0,
    length: Math.round(v.length || 0),
    resolutions: v.availableResolutions || '',
  };
}

/**
 * Credentials the browser's TUS client needs to upload straight to Bunny. The signature proves the app
 * allowed this one upload; the library API key itself never leaves the server.
 */
export function tusAuth(videoId, ttlSeconds = 6 * 3600, nowMs = Date.now()) {
  requireBunny();
  const { libraryId, apiKey, tusEndpoint } = config.bunny;
  const expire = Math.floor(nowMs / 1000) + ttlSeconds;
  const signature = crypto.createHash('sha256').update(`${libraryId}${apiKey}${expire}${videoId}`).digest('hex');
  return {
    endpoint: tusEndpoint,
    headers: { AuthorizationSignature: signature, AuthorizationExpire: String(expire), VideoId: videoId, LibraryId: libraryId },
  };
}

/**
 * Bunny CDN "advanced" token (HS256), directory form, as documented at
 * https://docs.bunny.net/cdn/security/token-authentication/advanced :
 *   token = "HS256-" + base64url(HMAC-SHA256(key, token_path + expires + "token_path=" + token_path))
 */
export function directoryToken(key, directory, expires) {
  const digest = crypto.createHmac('sha256', key).update(`${directory}${expires}token_path=${directory}`).digest('base64');
  return `HS256-${digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

/**
 * Signed HLS playlist URL. The token sits in the URL path (/bcdn_token=...), so every segment the player
 * fetches relative to the playlist inherits it - this also works with iOS's built-in HLS player.
 * One token covers everything under /<videoId>/ and nothing else.
 */
export function signPlaybackUrl(videoId, ttlSeconds = config.bunny.tokenTtlSeconds, nowMs = Date.now()) {
  requireBunny();
  if (!VIDEO_ID.test(videoId)) throw badRequest('Invalid video');
  const { cdnUrl, tokenKey } = config.bunny;
  const expires = Math.floor(nowMs / 1000) + ttlSeconds;
  const directory = `/${videoId}/`;
  const token = directoryToken(tokenKey, directory, expires);
  return {
    url: `${cdnUrl}/bcdn_token=${token}&token_path=${encodeURIComponent(directory)}&expires=${expires}${directory}playlist.m3u8`,
    expiresAt: new Date(expires * 1000).toISOString(),
    ttlSeconds,
  };
}
