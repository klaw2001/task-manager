import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth.jsx';

/**
 * Shows a PDF as pictures of its pages, so there is no browser PDF toolbar with Download / Print, and every page
 * carries the viewer's name and employee ID. (Anyone determined can still photograph the screen.)
 */
export default function PdfViewer({ url }) {
  const { user } = useAuth();
  const host = useRef(null);
  const [state, setState] = useState({ loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;
    let task;
    const el = host.current;
    (async () => {
      try {
        // The "legacy" build runs on older phones too (the standard one needs very recent JavaScript features).
        // Loaded only when someone opens a PDF.
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.min.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
        task = pdfjs.getDocument({ url, withCredentials: true, isEvalSupported: false, disableRange: true, disableStream: true });
        const doc = await task.promise;
        if (cancelled) return;
        setState({ loading: false, error: '' });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= Math.min(doc.numPages, 150); n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const width = el.clientWidth || 600;
          const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * ratio });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const wrap = document.createElement('div');
          wrap.className = 'pdf-page';
          const mark = document.createElement('div');
          mark.className = 'pdf-mark';
          mark.textContent = `${user.name} · ${user.employee_id}`;
          wrap.append(canvas, mark);
          el.append(wrap);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err?.message || 'This document could not be opened.' });
      }
    })();
    return () => { cancelled = true; task?.destroy(); el.replaceChildren(); };
  }, [url, user.name, user.employee_id]);

  return (
    <div className="pdf-viewer protected" onContextMenu={(e) => e.preventDefault()}>
      {state.loading && <div className="center"><div className="spinner" role="progressbar" aria-label="Loading document" /></div>}
      {state.error && <div className="notice bad">{state.error}</div>}
      <div className="pdf-host" ref={host} />
    </div>
  );
}
