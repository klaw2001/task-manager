import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';

const listen = (server) => new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server.address().port)));
const body = (req) => new Promise((ok) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); });

/**
 * A stand-in for Bunny Stream: the management API, the TUS upload endpoint and the CDN that checks the signed
 * HLS tokens. The token check is written separately from the app's signer, straight from Bunny's documented rule.
 */
export async function startFakeBunny({ libraryId = '4242', apiKey = 'lib-api-key', tokenKey = 'cdn-token-key', autoEncodeMs = 0, defaultLength = 12, defaultDir = null } = {}) {
  const videos = new Map(); // guid -> { title, status, progress, length, files }
  const uploads = new Map(); // tus id -> { videoId, length, offset }
  const log = [];

  const cdnAllowed = (segment, rest) => {
    const p = new URLSearchParams(segment);
    const token = p.get('bcdn_token');
    const expires = p.get('expires');
    const tokenPath = p.get('token_path');
    if (!token?.startsWith('HS256-') || !expires || !tokenPath) return 'missing token';
    if (Number(expires) < Math.floor(Date.now() / 1000)) return 'expired';
    if (!rest.startsWith(tokenPath)) return 'outside token_path';
    const want = crypto.createHmac('sha256', tokenKey).update(`${tokenPath}${expires}token_path=${tokenPath}`).digest('base64url');
    const got = token.slice('HS256-'.length);
    return got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want)) ? null : 'bad signature';
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://fake');
    const send = (status, data, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data)); };
    log.push(`${req.method} ${url.pathname.slice(0, 60)}`);

    // ---- CDN: /bcdn_token=...&token_path=...&expires=.../<guid>/<file>
    if (url.pathname.startsWith('/bcdn_token=')) {
      const cors = { 'Access-Control-Allow-Origin': '*' };
      const cut = url.pathname.indexOf('/', 1);
      const problem = cdnAllowed(url.pathname.slice(1, cut), url.pathname.slice(cut));
      if (problem) return send(403, { error: problem }, cors);
      const [, guid, ...file] = url.pathname.slice(cut).split('/');
      const v = videos.get(guid);
      if (!v) return send(404, {}, cors);
      const name = file.join('/');
      const dir = v.dir ?? defaultDir;
      if (dir && fs.existsSync(path.join(dir, name))) {
        const type = name.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : name.endsWith('.m4s') ? 'video/iso.segment' : name.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream';
        return send(200, fs.readFileSync(path.join(dir, name)), { 'Content-Type': type, ...cors });
      }
      return name === 'playlist.m3u8' ? send(200, '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-ENDLIST\n', { 'Content-Type': 'application/vnd.apple.mpegurl', ...cors }) : send(404, {}, cors);
    }

    // ---- TUS upload
    if (url.pathname.startsWith('/tusupload')) {
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': '*', 'Tus-Resumable': '1.0.0' };
      if (req.method === 'OPTIONS') return send(204, '', cors);
      if (req.method === 'POST') {
        const h = req.headers;
        const want = crypto.createHash('sha256').update(`${libraryId}${apiKey}${h.authorizationexpire}${h.videoid}`).digest('hex');
        if (h.authorizationsignature !== want || h.libraryid !== libraryId || !videos.has(h.videoid)) return send(401, { error: 'bad upload signature' }, cors);
        const id = crypto.randomUUID();
        uploads.set(id, { videoId: h.videoid, length: Number(h['upload-length']), offset: 0 });
        return send(201, '', { ...cors, Location: `http://127.0.0.1:${server.address().port}/tusupload/${id}` });
      }
      const up = uploads.get(url.pathname.split('/').pop());
      if (!up) return send(404, '', cors);
      if (req.method === 'HEAD') return send(200, '', { ...cors, 'Upload-Offset': String(up.offset), 'Upload-Length': String(up.length), 'Cache-Control': 'no-store' });
      if (req.method === 'PATCH') {
        up.offset += (await body(req)).length;
        if (up.offset >= up.length) {
          const v = videos.get(up.videoId);
          v.status = 2; v.progress = 0;
          if (autoEncodeMs) setTimeout(() => { v.status = 4; v.progress = 100; v.length = defaultLength; }, autoEncodeMs);
        }
        return send(204, '', { ...cors, 'Upload-Offset': String(up.offset) });
      }
    }

    // ---- Stream management API
    const m = /^\/library\/(\d+)\/videos(?:\/([^/]+))?$/.exec(url.pathname);
    if (!m) return send(404, {});
    if (req.headers.accesskey !== apiKey || m[1] !== libraryId) return send(401, {});
    if (req.method === 'POST' && !m[2]) {
      const guid = crypto.randomUUID();
      videos.set(guid, { title: JSON.parse((await body(req)).toString()).title, status: 0, progress: 0, length: 0 });
      return send(200, { guid, status: 0 });
    }
    if (req.method === 'GET' && m[2]) {
      const v = videos.get(m[2]);
      return v ? send(200, { guid: m[2], title: v.title, status: v.status, encodeProgress: v.progress, length: v.length, availableResolutions: v.status === 4 ? '360p,720p' : '' }) : send(404, {});
    }
    return send(405, {});
  });

  const port = await listen(server);
  return {
    libraryId, apiKey, tokenKey, log, videos,
    url: `http://127.0.0.1:${port}`,
    finish(guid, { length = defaultLength, dir } = {}) { Object.assign(videos.get(guid), { status: 4, progress: 100, length, dir }); },
    set(guid, status, progress = 0) { Object.assign(videos.get(guid), { status, progress }); },
    close: () => new Promise((ok) => server.close(ok)),
  };
}

/** An SMTP server that accepts the app's login and keeps every message it receives. */
export async function startFakeSmtp({ user = 'smtp-user', pass = 'smtp-pass' } = {}) {
  const messages = [];
  const server = new SMTPServer({
    authOptional: false,
    allowInsecureAuth: true,
    disabledCommands: ['STARTTLS'],
    onAuth(auth, _session, cb) {
      return auth.username === user && auth.password === pass ? cb(null, { user: auth.username }) : cb(new Error('Invalid login'));
    },
    onData(stream, _session, cb) {
      simpleParser(stream).then((m) => {
        messages.push({ from: m.from?.text, to: m.to?.text, subject: m.subject, text: m.text, html: m.html || '' });
        cb();
      }, cb);
    },
  });
  const port = await new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server.server.address().port)));
  return { messages, port, user, pass, close: () => new Promise((ok) => server.close(ok)) };
}
