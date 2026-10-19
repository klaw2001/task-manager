export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.code;
    this.body = body;
  }
}

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new ApiError(res.status, data?.error);
    // let the app react: sign-out (session ended / access removed) or re-check the shift
    if (res.status === 401 && url !== '/api/auth/login') window.dispatchEvent(new CustomEvent('lms:signed-out', { detail: err }));
    if (err.code === 'OUTSIDE_SHIFT') window.dispatchEvent(new Event('lms:refresh-me'));
    throw err;
  }
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  patch: (url, body) => request('PATCH', url, body),
  delete: (url) => request('DELETE', url),
};

/** Uploads a file via a server-issued slot (S3 presigned URL in production, this server locally). Returns the storage key. */
export async function uploadFile(file, kind) {
  const slot = await api.post('/api/admin/uploads', { kind, filename: file.name, contentType: file.type });
  const res = await fetch(slot.url, { method: slot.method, headers: { 'Content-Type': file.type, ...(slot.headers || {}) }, body: file, credentials: slot.url.startsWith('/') ? 'same-origin' : 'omit' });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return slot.key;
}

/** Reads a video file's length in seconds in the browser. */
export const videoDuration = (file) =>
  new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(Math.round(v.duration) || null); };
    v.onerror = () => resolve(null);
    v.src = URL.createObjectURL(file);
  });
