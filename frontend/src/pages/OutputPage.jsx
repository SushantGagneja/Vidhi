import { useEffect } from 'react'
import { useCase } from '../context/CaseContext.jsx'

export default function OutputPage() {
  const { caseData, ensure, refreshCase } = useCase()

  useEffect(() => {
    ensure().then(() => refreshCase())
  }, [ensure, refreshCase])

  const timeline = caseData?.dashboard?.timeline || []
  const crossExamTargets = caseData?.dashboard?.cross_exam_targets || []
  const transcripts = caseData?.transcripts || []
  const visibleCount = transcripts.filter((item) => item.consent_visible !== false).length
  const avgConfidence =
    timeline.length > 0
      ? Math.round((timeline.reduce((sum, item) => sum + (item.confidence_score || 0), 0) / timeline.length) * 100)
      : 0

  const stats = [
    [String(transcripts.length), 'Fragments captured'],
    [String(visibleCount), 'Visible with consent'],
    [`${avgConfidence}%`, 'Average confidence'],
    [String(crossExamTargets.length), 'Cross-exam targets'],
    [String(caseData?.verified_bns?.length || 0), 'Legal sections'],
    ['SHA-256', 'Provenance trail'],
  ]

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '1.25rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1rem' }}>
        <section
          style={{
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '1.2rem',
            background: 'rgba(255,255,255,0.025)',
          }}
        >
          <p className="eyebrow">Daubert-ready output</p>
          <h2 style={{ marginTop: 0 }}>What the final export contains</h2>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.8, color: 'var(--dim)' }}>
            <li>Structured testimony draft from non-linear fragments.</li>
            <li>Ranked timeline with confidence scores and reasoning trace.</li>
            <li>Cross-examination prep section highlighting weak nodes.</li>
            <li>Contradiction explanations in plain language.</li>
            <li>Fragment-level provenance ledger with SHA-256 hashes.</li>
          </ul>

          <div style={{ marginTop: '1rem', display: 'grid', gap: '0.65rem' }}>
            {timeline.slice(0, 4).map((item) => (
              <article
                key={item.event_id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '0.75rem',
                  background: 'rgba(159,225,203,0.04)',
                }}
              >
                <strong>
                  #{item.rank} {item.event_id}
                </strong>
                <p style={{ margin: '0.35rem 0', color: 'var(--dim)' }}>{item.summary}</p>
                <p style={{ margin: 0, color: '#9fe1cb', fontSize: '0.82rem' }}>{item.reasoning_trace}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel scanlines" style={{ padding: '1rem' }}>
          <div className="stats-grid">
            {stats.map(([v, l]) => (
              <div key={l}>
                <div className="stat-value">{v}</div>
                <div className="mono-note">{l}</div>
              </div>
            ))}
          </div>
          <div className="sep" />
          <p className="closing-line a">Trauma-aware.</p>
          <p className="closing-line b">Evidence-conscious.</p>
          <p className="closing-line c">Courtroom-defensible.</p>
          <div style={{ marginTop: '1rem', color: 'var(--muted)', fontSize: '0.82rem', wordBreak: 'break-all' }}>
            Latest fingerprint: {caseData?.pdf_hash || 'Generate the export from cross-exam prep.'}
          </div>
        </section>
      </div>
    </div>
  )
}
