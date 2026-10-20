import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

/**
 * Plays a protected video from Bunny Stream (HLS).
 *  - no file URL is ever shown: the app asks the server for a short-lived signed playlist URL (the server runs
 *    every access check first: signed in, active, in shift, assigned, brand/role) and renews it before it expires
 *  - download button, Picture-in-Picture and the context menu are disabled
 *  - the viewer's name and employee ID drift across the picture, so a leaked recording is traceable
 * Browsers cannot block screenshots or screen recording; the watermark is the deterrent.
 *
 * source: { type: 'module' | 'recipe' | 'attachment', id }
 * track (optional): { moduleId, startAt, onUpdate } - reports viewing time to the server every 10 seconds
 */
export default function SecureVideo({ source, track }) {
  const { user } = useAuth();
  const box = useRef(null);
  const video = useRef(null);
  const acc = useRef({ last: null, pos: 0, pending: 0, inflight: false });
  const [problem, setProblem] = useState('');
  const [attempt, setAttempt] = useState(0);

  /* ---------- playback: signed HLS URL, renewed before it expires ---------- */
  useEffect(() => {
    const v = video.current;
    const state = { cancelled: false, hls: null, renewTimer: null, lastRenew: 0 };
    const native = v.canPlayType('application/vnd.apple.mpegurl'); // Safari / iOS play HLS themselves

    const fetchUrl = (renew) => api.post('/api/media/playback', { type: source.type, id: Number(source.id), renew });

    async function load(url, resumeAt, autoplay) {
      if (native) {
        v.src = url;
        v.addEventListener('loadedmetadata', () => {
          if (resumeAt > 1 && resumeAt < v.duration - 3) v.currentTime = resumeAt;
          if (autoplay) v.play().catch(() => {});
        }, { once: true });
        return;
      }
      const { default: Hls } = await import('hls.js'); // loaded only where it is needed
      if (state.cancelled) return;
      if (!Hls.isSupported()) throw new Error('This browser cannot play this video');
      if (!state.hls) {
        state.hls = new Hls({ startPosition: resumeAt > 1 ? resumeAt : -1 });
        state.hls.attachMedia(v);
        state.hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && (data.response?.code === 403 || data.response?.code === 401)) renewNow(); // the URL expired, e.g. while paused
          else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) state.hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) state.hls.recoverMediaError();
          else setProblem('This video could not be played.');
        });
      } else {
        state.hls.config.startPosition = resumeAt > 1 ? resumeAt : -1;
      }
      if (autoplay) state.hls.once(Hls.Events.MANIFEST_PARSED, () => v.play().catch(() => {}));
      state.hls.loadSource(url);
    }

    function scheduleRenew(expiresAt) {
      clearTimeout(state.renewTimer);
      const wait = Math.max(15_000, (new Date(expiresAt) - Date.now()) * 0.8);
      state.renewTimer = setTimeout(renewNow, wait);
    }

    async function renewNow() {
      if (state.cancelled) return;
      if (Date.now() - state.lastRenew < 4000) return setProblem('This video could not be played.');
      state.lastRenew = Date.now();
      try {
        const pb = await fetchUrl(true); // the server re-checks access: a removed user / ended shift ends playback here
        const resumeAt = v.currentTime;
        const wasPlaying = !v.paused && !v.ended;
        await load(pb.url, resumeAt, wasPlaying);
        scheduleRenew(pb.expiresAt);
      } catch (err) {
        if (state.cancelled) return;
        if (err.status >= 500 || !err.status) state.renewTimer = setTimeout(renewNow, 10_000); // network hiccup: try again
        else setProblem(err.message);
      }
    }

    (async () => {
      try {
        const pb = await fetchUrl(false);
        if (state.cancelled) return;
        await load(pb.url, track?.startAt ?? 0, false);
        scheduleRenew(pb.expiresAt);
      } catch (err) {
        if (!state.cancelled) setProblem(err.message);
      }
    })();

    const onNativeError = () => native && renewNow();
    v.addEventListener('error', onNativeError);
    return () => {
      state.cancelled = true;
      clearTimeout(state.renewTimer);
      v.removeEventListener('error', onNativeError);
      state.hls?.destroy();
      v.removeAttribute('src');
      v.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.type, source.id, attempt]);

  /* ---------- viewing-time reporting ---------- */
  async function flush(ended = false) {
    const a = acc.current;
    if (!track || a.inflight || (a.pending < 0.5 && !ended)) return;
    a.inflight = true;
    const delta = a.pending;
    a.pending = 0;
    try {
      track.onUpdate(await api.post(`/api/learn/modules/${track.moduleId}/progress`, { position: a.pos, delta, ended }));
    } catch {
      a.pending += delta; // retry with the next heartbeat
    } finally {
      a.inflight = false;
    }
  }

  useEffect(() => {
    if (!track) return undefined;
    const timer = setInterval(() => flush(), 10_000);
    const onHide = () => document.hidden && flush();
    document.addEventListener('visibilitychange', onHide);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onHide); flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.moduleId]);

  function onTimeUpdate() {
    const v = video.current;
    const a = acc.current;
    // only count normal playback ticks, never jumps caused by seeking
    if (a.last != null && !v.seeking && !v.paused) {
      const dt = v.currentTime - a.last;
      if (dt > 0 && dt < 2) a.pending += dt;
    }
    a.last = v.currentTime;
    a.pos = v.currentTime;
  }

  if (problem) {
    return (
      <div className="notice warn">
        {problem} Your access may have changed or your shift may have ended.
        <div><button className="btn small" onClick={() => { setProblem(''); setAttempt((n) => n + 1); }}>Try again</button></div>
      </div>
    );
  }

  return (
    <div className="player protected" ref={box} onContextMenu={(e) => e.preventDefault()}>
      <video
        ref={video}
        controls
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        playsInline
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onSeeked={() => { acc.current.last = video.current.currentTime; }}
        onPause={() => flush()}
        onEnded={() => flush(true)}
      />
      <div className="watermark" aria-hidden>{user.name} · {user.employee_id}</div>
      {document.fullscreenEnabled && (
        <button className="fs-btn" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : box.current.requestFullscreen())} aria-label="Full screen">⛶</button>
      )}
    </div>
  );
}
