'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSite } from '../../../../lib/api';
import SiteLayout from '../../../../components/SiteLayout';

export default function RagEvaluationPage() {
  const { id } = useParams();
  const [site, setSite] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [siteData, reportRes] = await Promise.all([
        getSite(id),
        fetch(`/api/rag-eval/${id}`)
      ]);
      setSite(siteData.site);
      if (reportRes.ok) {
        const data = await reportRes.json();
        setReport(data);
      }
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runEvaluation() {
    if (!confirm('This will test the chatbot with auto-generated questions. Continue?')) return;
    
    setRunning(true);
    setError('');
    
    try {
      const res = await fetch(`/api/rag-eval/${id}`, { method: 'POST' });
      if (!res.ok) throw new Error('Evaluation failed');
      
      const data = await res.json();
      setReport(data);
      alert(`Evaluation complete! Accuracy: ${data.summary.accuracy_percent}%`);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <SiteLayout siteName={site?.company_name || 'Loading...'}><p className="text-muted">Loading...</p></SiteLayout>;

  const accuracy = report?.summary?.accuracy_percent || 0;
  const isHealthy = accuracy >= 75;

  return (
    <SiteLayout siteName={site?.company_name || 'Site'}>
      <div className="page-header">
        <div>
          <h1 className="page-title">RAG Evaluation</h1>
          <p className="page-subtitle">Automated chatbot accuracy testing</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={runEvaluation} 
            disabled={running}
          >
            {running ? '⏳ Running...' : '▶ Run New Evaluation'}
          </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!report ? (
        <div className="card">
          <div className="card-title">No Evaluation Reports Yet</div>
          <p className="card-meta">Click "Run New Evaluation" to test chatbot accuracy</p>
        </div>
      ) : (
        <>
          {/* Summary Card */}
          <div className="card">
            <div className="card-title">Latest Evaluation Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Accuracy</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: isHealthy ? 'var(--success)' : 'var(--danger)' }}>
                  {accuracy}%
                </div>
                {!isHealthy && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                    ⚠️ Below 75% threshold
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Questions</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{report.summary.total_questions}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Avg Score</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {report.summary.average_score.toFixed(1)}/3
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>KB Chunks</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{report.summary.chunks_loaded}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16 }}>
              Last run: {new Date(report.summary.timestamp).toLocaleString()}
            </div>
          </div>

          {/* Results Table */}
          <div className="card">
            <div className="card-title">Question Results</div>
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Intent</th>
                    <th>Keywords</th>
                    <th>Depth</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {report.results.slice(0, 20).map((result, idx) => (
                    <tr key={idx}>
                      <td style={{ maxWidth: 300 }}>
                        <div style={{ fontWeight: 500 }}>{result.question}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                          {result.response?.slice(0, 100)}...
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: result.intent === 'kb' ? 'var(--success)' : 'var(--bg)',
                          color: result.intent === 'kb' ? '#fff' : 'var(--muted)',
                        }}>
                          {result.intent}
                        </span>
                      </td>
                      <td>{result.keyword_match ? '✓' : '✗'}</td>
                      <td>{result.depth_ok ? '✓' : '✗'}</td>
                      <td>
                        <span style={{ 
                          fontWeight: 600, 
                          color: result.score === 3 ? 'var(--success)' : result.score >= 2 ? '#f59e0b' : 'var(--danger)' 
                        }}>
                          {result.score}/3
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.results.length > 20 && (
              <p className="text-muted" style={{ marginTop: 12, fontSize: 12 }}>
                Showing 20 of {report.results.length} results
              </p>
            )}
          </div>
        </>
      )}
    </SiteLayout>
  );
}
