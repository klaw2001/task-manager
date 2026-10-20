// Checks your Bunny Stream settings against the real service.
//   npm run bunny:check                      checks the API key / library, prints what is missing
//   npm run bunny:check -- <videoId>         also signs a playback URL for that (finished) video and tests it
// Safe: it only reads. Run it after filling in the BUNNY_* settings.
import { bunnyEnabled, getVideo, signPlaybackUrl } from '../src/bunny.js';
import { config } from '../src/config.js';

const b = config.bunny;
const line = (ok, text) => console.log(`${ok === true ? '  OK  ' : ok === false ? ' FAIL ' : ' WARN '} ${text}`);
let failed = false;
const check = (ok, text) => { line(ok, text); if (ok === false) failed = true; };

console.log('Bunny Stream settings');
check(Boolean(b.libraryId), 'BUNNY_STREAM_LIBRARY_ID is set');
check(Boolean(b.apiKey), 'BUNNY_STREAM_API_KEY is set');
check(Boolean(b.cdnUrl), 'BUNNY_CDN_HOSTNAME is set');
check(Boolean(b.tokenKey), 'BUNNY_TOKEN_KEY is set');
if (!bunnyEnabled()) {
  console.log('\nFill in the missing settings (see docs/BUNNY.md) and run this again.');
  process.exit(1);
}

console.log('\nManagement API');
try {
  const missing = await getVideo('00000000-0000-0000-0000-000000000000'); // a video that cannot exist
  check(missing === null, 'API key and library ID are accepted by Bunny');
} catch (err) {
  check(false, `Bunny rejected the request: ${err.message}`);
  process.exit(1);
}

const videoId = process.argv[2];
if (!videoId) {
  console.log('\nTo test playback and security, upload a short video in the app (or the Bunny dashboard) and run:\n  npm run bunny:check -- <video id>');
  process.exit(failed ? 1 : 0);
}

console.log(`\nVideo ${videoId}`);
const video = await getVideo(videoId);
if (!video) { check(false, 'Bunny has no video with that ID in this library'); process.exit(1); }
check(video.ready, `video is converted and ready (state: ${video.state}${video.ready ? '' : ` ${video.progress}%`})`);

const get = (url, headers = {}) => fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(15000) });
const signed = signPlaybackUrl(videoId);

console.log('\nPlayback and security');
const withToken = await get(signed.url, { Origin: config.appUrl });
check(withToken.status === 200, `signed playlist URL is accepted (HTTP ${withToken.status})${withToken.status === 403 ? ' - check BUNNY_TOKEN_KEY and that token authentication is enabled' : ''}`);
const noToken = await get(`${b.cdnUrl}/${videoId}/playlist.m3u8`);
check(noToken.status === 200 ? false : [401, 403].includes(noToken.status) ? true : 'warn', `the playlist WITHOUT a token is ${noToken.status === 200 ? 'served - anyone with the link can watch: turn on CDN token authentication' : `refused (HTTP ${noToken.status})`}`);
const expired = await get(signPlaybackUrl(videoId, -60).url);
check(expired.status === 403, `an expired token is refused (HTTP ${expired.status})`);
const elsewhere = await get(signed.url.replace(`/${videoId}/playlist.m3u8`, '/00000000-0000-0000-0000-000000000000/playlist.m3u8'));
check([403, 404].includes(elsewhere.status), `a token for this video does not unlock another one (HTTP ${elsewhere.status})`);
const cors = withToken.headers.get('access-control-allow-origin');
check(Boolean(cors) && (cors === '*' || cors === new URL(config.appUrl).origin), `CORS allows the app (${cors || 'no Access-Control-Allow-Origin header'}) - enable CORS on the pull zone for ${new URL(config.appUrl).origin}`);

// MP4 fallbacks are plain downloadable files and the same token unlocks them
const mp4 = [];
for (const res of ['240p', '360p', '480p', '720p', '1080p']) {
  const r = await get(signed.url.replace('playlist.m3u8', `play_${res}.mp4`), { Range: 'bytes=0-0' }).catch(() => null);
  if (r && [200, 206].includes(r.status)) mp4.push(res);
}
check(mp4.length === 0 ? true : 'warn', mp4.length === 0 ? 'no downloadable MP4 fallback files are served' : `MP4 fallback is ON (${mp4.join(', ')}): anyone with a playback token could download these. Turn off "MP4 Fallback" in the library's encoding settings.`);

if (withToken.status === 200) {
  const text = await withToken.text();
  const first = text.split('\n').find((l) => l && !l.startsWith('#'));
  if (first) {
    const base = signed.url.slice(0, signed.url.lastIndexOf('/') + 1);
    const seg = await get(new URL(first, base).href);
    check(seg.status === 200, `a file referenced by the playlist loads with the same token (HTTP ${seg.status}) - this is what makes iPhone playback work`);
  }
}

console.log(failed ? '\nSome checks failed.' : '\nLooks good.');
process.exit(failed ? 1 : 0);
