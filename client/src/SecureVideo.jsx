import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

/**
 * Plays a protected video.
 *  - no direct file URL: the browser only ever sees /api/media/..., which re-checks access on every request
 *  - download button, picture-in-picture and the context menu are disabled
 *  - the viewer's name and employee ID drift across the picture, so a leaked screen recording is traceable
 * Browsers cannot block screenshots or screen recording; the watermark is the deterrent.
 *
 * If `track` is set ({ moduleId, startAt, onUpdate }) viewing time is reported to the server every 10s.
 */
export default function SecureVideo({ src, track }) {
  const { user, refresh } = useAuth();
  const box = useRef(null);
  const video = useRef(null);
  const acc = useRef({ last: null, pos: 0, pending: 0, inflight: false });
  const [failed, setFailed] = useState(false);

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

  if (failed) {
    return (
      <div className="notice warn">
        This video can’t be played right now. Your access may have changed or your shift may have ended.
        <div><button className="btn small" onClick={() => { setFailed(false); refresh(); }}>Try again</button></div>
      </div>
    );
  }

  return (
    <div className="player protected" ref={box} onContextMenu={(e) => e.preventDefault()}>
      <video
        ref={video}
        src={src}
        controls
        controlsList="nodownload nofullscreen noremoteplayback"
        disablePictureInPicture
        disableRemotePlayback
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => {
          const t = track?.startAt;
          if (t > 1 && t < e.currentTarget.duration - 3) e.currentTarget.currentTime = t;
        }}
        onTimeUpdate={onTimeUpdate}
        onSeeked={() => { acc.current.last = video.current.currentTime; }}
        onPause={() => flush()}
        onEnded={() => flush(true)}
        onError={() => setFailed(true)}
      />
      <div className="watermark" aria-hidden>{user.name} · {user.employee_id}</div>
      {document.fullscreenEnabled && (
        <button className="fs-btn" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : box.current.requestFullscreen())} aria-label="Full screen">⛶</button>
      )}
    </div>
  );
}
