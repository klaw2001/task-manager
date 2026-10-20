import { useState } from 'react';
import { api, uploadFile } from './api.js';
import { Confirm, Card, useToast } from './ui.jsx';
import VideoUpload, { VideoStatus } from './VideoUpload.jsx';

const ICON = { pdf: '📄', image: '🖼️', video: '🎬' };
const ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';
const kindOf = (type) => (type === 'application/pdf' ? 'pdf' : type.startsWith('image/') ? 'image' : null);
const baseName = (name) => name.replace(/\.[^.]+$/, '');

/** Add / rename / remove PDF, image and video attachments. Changes are saved straight away. owner = { moduleId } or { recipeId } */
export default function AttachmentsEditor({ owner, items, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const ownerKey = Object.keys(owner)[0];
  const ownerId = owner[ownerKey];

  async function addFile(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const kind = kindOf(file.type);
    if (!kind) return toast.error(new Error('Choose a PDF or an image (PNG, JPEG, WebP).'));
    setBusy(true);
    try {
      const fileKey = await uploadFile(file, kind);
      await api.post('/api/admin/attachments', { [ownerKey]: ownerId, kind, title: baseName(file.name), fileKey, sizeBytes: file.size });
      toast(`${kind === 'pdf' ? 'PDF' : 'Image'} added`);
      onChanged();
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function addVideo(videoId, file) {
    try {
      await api.post('/api/admin/attachments', { [ownerKey]: ownerId, kind: 'video', title: baseName(file.name), videoId });
      toast('Video uploaded — it will be playable once Bunny has converted it');
      onChanged();
    } catch (err) {
      toast.error(err);
    }
  }

  const rename = async (a, title) => {
    if (!title.trim() || title === a.title) return;
    try { await api.patch(`/api/admin/attachments/${a.id}`, { title: title.trim() }); onChanged(); } catch (err) { toast.error(err); }
  };

  return (
    <Card>
      <h2>Attachments</h2>
      <p className="muted small">Supporting PDFs, images and videos shown to staff under the lesson. Videos are hosted on Bunny and cannot be downloaded.</p>
      {items.length === 0 && <p className="muted">No attachments yet.</p>}
      {items.map((a) => (
        <div className="row" key={a.id} style={{ margin: '.5rem 0', flexWrap: 'nowrap' }}>
          <span aria-hidden style={{ fontSize: '1.3rem' }}>{ICON[a.kind]}</span>
          <input defaultValue={a.title} onBlur={(e) => rename(a, e.target.value)} aria-label="Attachment title" style={{ flex: 1 }} />
          {a.kind === 'video' && <VideoStatus videoId={a.video_id} />}
          <button className="btn small" onClick={() => setRemoving(a)}>Remove</button>
        </div>
      ))}
      <div className="form-grid" style={{ marginTop: '1rem' }}>
        <label className="field">
          <span className="label">Add a PDF or image</span>
          <input type="file" accept={ACCEPT} onChange={addFile} disabled={busy} />
        </label>
        <VideoUpload label="Add a video" onUploaded={addVideo} />
      </div>
      {removing && (
        <Confirm danger title="Remove attachment" confirmLabel="Remove" message={`Remove “${removing.title}” from this content? Staff will no longer see it. Earlier versions keep their copy.`}
          onClose={() => setRemoving(null)} onConfirm={async () => { await api.delete(`/api/admin/attachments/${removing.id}`); toast('Removed'); onChanged(); }} />
      )}
    </Card>
  );
}
