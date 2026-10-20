import { lazy, Suspense, useState } from 'react';
import { useAuth } from './auth.jsx';
import SecureVideo from './SecureVideo.jsx';
import { Card, Spinner } from './ui.jsx';

const PdfViewer = lazy(() => import('./PdfViewer.jsx'));
const ICON = { pdf: '📄', image: '🖼️', video: '🎬' };

function Image({ item }) {
  const { user } = useAuth();
  return (
    <figure className="att-image protected" onContextMenu={(e) => e.preventDefault()}>
      <img src={`/api/media/attachments/${item.id}/file`} alt={item.title} loading="lazy" draggable="false" />
      <span className="watermark static" aria-hidden>{user.name} · {user.employee_id}</span>
    </figure>
  );
}

/** Supporting material for a module or recipe: images show inline; PDFs and videos open on demand. */
export default function Attachments({ items }) {
  const [open, setOpen] = useState({});
  if (!items?.length) return null;
  return (
    <Card>
      <h2>Resources</h2>
      <div className="stack">
        {items.map((a) => (
          <div key={a.id}>
            <div className="row between">
              <b>{ICON[a.kind]} {a.title}</b>
              {a.kind !== 'image' && (
                <button className="btn small" onClick={() => setOpen({ ...open, [a.id]: !open[a.id] })}>
                  {open[a.id] ? 'Close' : a.kind === 'pdf' ? 'View document' : '▶ Watch'}
                </button>
              )}
            </div>
            {a.kind === 'image' && <Image item={a} />}
            {a.kind === 'pdf' && open[a.id] && <Suspense fallback={<Spinner />}><PdfViewer url={`/api/media/attachments/${a.id}/file`} /></Suspense>}
            {a.kind === 'video' && open[a.id] && <div style={{ marginTop: '.5rem' }}><SecureVideo source={{ type: 'attachment', id: a.id }} /></div>}
          </div>
        ))}
      </div>
    </Card>
  );
}
