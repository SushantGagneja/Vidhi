import { useEffect, useMemo, useState } from 'react'
import * as api from '../api.js'
import { useCase } from '../context/CaseContext.jsx'

export default function StorySegmentsPage() {
  const { caseId, caseData, ensure, refreshCase } = useCase()
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    ensure().then(() => refreshCase())
  }, [ensure, refreshCase])

  const fragments = useMemo(
    () => [...(caseData?.transcripts || [])].sort((a, b) => a.chunk_index - b.chunk_index),
    [caseData],
  )

  const toggleVisibility = async (fragment) => {
    setBusyId(fragment.id)
    try {
      await api.updateTranscript(caseId, fragment.id, { consent_visible: !fragment.consent_visible })
      await refreshCase()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '1.25rem' }}>
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Fragment review</h1>
        <p style={{ margin: '0.4rem 0 0', color: 'var(--dim)', fontSize: '0.9rem' }}>
          The survivor controls which fragments stay visible. The legal team sees provenance, confidence, and anchor
          type for each fragment.
        </p>
      </header>

      <section className="panel scanlines" style={{ padding: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {fragments.map((fragment) => (
            <article
              key={fragment.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '0.9rem',
                background: fragment.consent_visible ? 'rgba(255,255,255,0.03)' : 'rgba(240,153,123,0.07)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--dim)' }}>
                    Fragment {fragment.chunk_index} · {fragment.source_session || 'session-1'} ·{' '}
                    {fragment.speaker_language || 'en-IN'}
                  </div>
                  <div style={{ fontSize: 15, marginTop: 6 }}>{fragment.text}</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleVisibility(fragment)}
                  disabled={busyId === fragment.id}
                  style={{
                    minWidth: 140,
                    alignSelf: 'flex-start',
                    padding: '0.65rem 0.95rem',
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    background: fragment.consent_visible ? 'transparent' : '#9fe1cb',
                    color: fragment.consent_visible ? 'var(--text)' : '#06241d',
                    fontWeight: 700,
                  }}
                >
                  {busyId === fragment.id
                    ? 'Updating...'
                    : fragment.consent_visible
                      ? 'Withdraw fragment'
                      : 'Restore fragment'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
                <Tag label={`Confidence ${fragment.confidence_score ?? 'pending'}`} />
                <Tag label={`Sensory ${fragment.sensory_anchor || 'none'}`} />
                <Tag label={`Temporal ${fragment.temporal_anchor || 'uncertain'}`} />
                <Tag label={`Status ${fragment.review_status || 'active'}`} />
              </div>

              <div style={{ marginTop: '0.7rem', fontSize: '0.8rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
                SHA-256: {fragment.fragment_hash || 'pending'}
              </div>
            </article>
          ))}
          {fragments.length === 0 && <p style={{ margin: 0, color: 'var(--muted)' }}>No fragments yet. Start the intake flow first.</p>}
        </div>
      </section>
    </div>
  )
}

function Tag({ label }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '0.35rem 0.65rem',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.05)',
        fontSize: '0.78rem',
        color: '#dce7e2',
      }}
    >
      {label}
    </span>
  )
}
