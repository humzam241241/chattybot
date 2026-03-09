'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { listFiles, uploadFiles, reprocessFile, deleteFile, getSite } from '../../../../../lib/api';
import SiteLayout from '../../../../../components/SiteLayout';

export default function SiteFilesPage() {
  const { id } = useParams();
  const [site, setSite] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [siteData, fileData] = await Promise.all([getSite(id), listFiles(id)]);
      setSite(siteData.site);
      setFiles(fileData.files || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [id]);

  async function onUpload(e) {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setUploading(true);
    setError('');
    try {
      await uploadFiles(id, selected);
      await refresh();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <SiteLayout siteName={site?.company_name || 'Loading...'}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Files</h1>
          <p className="page-subtitle">PDF, DOCX, XLSX knowledge base uploads</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="text-muted">Loading...</p>}

      {!loading && (
        <>
          <div className="card">
            <div className="card-title">Upload Knowledge Base Files</div>
            <div className="card-meta">
              Supported: PDF, DOCX, XLSX. Files are stored in Supabase Storage and embedded into pgvector.
            </div>
            <div className="mt-4">
              <input type="file" multiple accept=".pdf,.docx,.xlsx" onChange={onUpload} disabled={uploading} />
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                        No files uploaded yet.
                      </td>
                    </tr>
                  )}
                  {files.map((f) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 500 }}>{f.original_name}</td>
                      <td>
                        <span className="badge">{f.status}</span>
                        {f.error ? <div className="text-muted" style={{ marginTop: 4 }}>{f.error}</div> : null}
                      </td>
                      <td className="text-muted">{new Date(f.created_at).toLocaleString()}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={async () => { await reprocessFile(f.id); await refresh(); }}
                            disabled={f.status === 'processing'}
                          >
                            Reprocess
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={async () => { if (confirm('Delete this file and its embeddings?')) { await deleteFile(f.id); await refresh(); } }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </SiteLayout>
  );
}

