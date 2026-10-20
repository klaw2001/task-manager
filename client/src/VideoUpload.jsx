import { useEffect, useRef, useState } from 'react';
import * as tus from 'tus-js-client';
import { api } from './api.js';
import { Badge, fmtDuration, useLoad, useToast } from './ui.jsx';

/** Live conversion status of a video on Bunny. Polls until it is ready (or has failed). */
export function VideoStatus({ videoId, onReady }) {
  const [info, setInfo] = useState(null);
  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    let stop = false;
    let timer;
    async function poll() {
      try {
        const s = await api.get(`/api/admin/videos/${videoId}`);
        if (stop) return;
        setInfo(s);
        if (s.ready) ready.current?.(s);
        else if (s.state !== 'error' && s.state !== 'upload_failed') timer = setTimeout(poll, 4000);
      } catch (err) {
        if (!stop) setInfo({ state: 'unknown', message: err.message });
      }
    }
    poll();
    return () => { stop = true; clearTimeout(timer); };
  }, [videoId]);

  if (!info) return <Badge>Checking…</Badge>;
  if (info.ready) return <><Badge tone="green">Ready to stream</Badge><span className="muted small">length {fmtDuration(info.length)}</span></>;
  if (info.state === 'error' || info.state === 'upload_failed') return <Badge tone="red">Conversion failed — upload again</Badge>;
  if (info.state === 'unknown') return <Badge tone="amber">{info.message}</Badge>;
  if (info.state === 'created') return <Badge tone="amber">Waiting for the file</Badge>;
  return <Badge tone="blue">Converting for streaming{info.progress ? ` ${info.progress}%` : '…'}</Badge>;
}

/**
 * Uploads a video straight from the browser to Bunny Stream (resumable). Bunny then converts it to HLS.
 *  videoId    – the video currently attached (its conversion status is shown)
 *  onUploaded – called with (videoId, file) once the file has reached Bunny
 *  onRemove   – optional: shows a Remove button for the current video
 */
export default function VideoUpload({ videoId, onUploaded, onRemove, label = 'Video' }) {
  const toast = useToast();
  const config = useLoad(() => api.get('/api/admin/videos/config'));
  const [pct, setPct] = useState(null); // null = not uploading
  const upload = useRef(null);
  useEffect(() => () => upload.current?.abort(), []);

  async function pick(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) return toast.error(new Error('Please choose a video file.'));
    setPct(0);
    try {
      const { videoId: id, upload: auth } = await api.post('/api/admin/videos', { title: file.name });
      upload.current = new tus.Upload(file, {
        endpoint: auth.endpoint,
        headers: auth.headers,
        metadata: { filetype: file.type, title: file.name },
        retryDelays: [0, 3000, 5000, 10000, 20000],
        onProgress: (sent, total) => setPct(Math.round((sent / total) * 100)),
        onError: (err) => { setPct(null); toast.error(new Error(`Upload failed: ${err.message}`)); },
        onSuccess: () => { setPct(null); onUploaded(id, file); },
      });
      upload.current.start();
    } catch (err) {
      setPct(null);
      toast.error(err);
    }
  }

  if (config.data && !config.data.enabled) {
    return <div className="notice warn">Video hosting is not set up yet. Add the Bunny Stream settings to the server (see docs/BUNNY.md), then videos can be uploaded here.</div>;
  }
  return (
    <div className="stack">
      <label className="field">
        <span className="label">{label}</span>
        <input type="file" accept="video/*" onChange={pick} disabled={pct !== null || !config.data} />
        <span className="hint">Any common format. Bunny converts it for smooth streaming on slow connections. Staff cannot download it.</span>
      </label>
      {pct !== null && <div><div className="bar"><i style={{ width: `${pct}%` }} /></div><p className="muted small">Uploading… {pct}% — keep this page open.</p></div>}
      {videoId && pct === null && (
        <div className="row"><VideoStatus videoId={videoId} />{onRemove && <button type="button" className="btn small" onClick={onRemove}>Remove</button>}</div>
      )}
    </div>
  );
}
