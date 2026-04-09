import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCase } from '../context/CaseContext.jsx'

export default function DashboardPage() {
  const { caseData, ensure, refreshCase } = useCase()
  const [hoveredEventId, setHoveredEventId] = useState(null)

  useEffect(() => {
    ensure().then(() => refreshCase())
  }, [ensure, refreshCase])

  const transcripts = (caseData?.transcripts || []).filter(t => t.consent_visible !== false)
  const rankedTimeline = caseData?.dashboard?.timeline || []

  // Ensure transcripts are linear (by chunk_index or appearance)
  const sortedTranscripts = [...transcripts].sort((a, b) => a.chunk_index - b.chunk_index)

  return (
    <div style={{ maxWidth: 1380, margin: '0 auto', padding: '1.25rem', height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ marginBottom: '1.25rem', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Legal Defense Dashboard</h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.9rem', maxWidth: 860 }}>
          Split view analyzing the raw, distressed fragment delivery against the Bayesian-ranked chronological timeline. 
          Use this courtroom-defense engine to anticipate vulnerability while presenting methodology.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0 }}>
        
        {/* LEFT PANE: Transcript & Distress Overlay */}
        <section className="scanlines" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--accent)' }}>Raw Delivery & Distress Overlay</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--dim)' }}>Chronological ingest</span>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sortedTranscripts.map((fragment, idx) => {
              const eventId = `F${idx + 1}`
              const isHovered = hoveredEventId === eventId
              
              // Distress normalized 0..1 based on strict calculation or saved scores
              const distress = fragment.stress_score || 0
              
              // Map distress to a visual backgound intensity (red hue)
              const heat = Math.max(0, (distress - 0.3) * 1.5) // Accentuate higher distress
              const bgOverlay = `rgba(255, 68, 68, ${heat * 0.15})`
              const borderOverlay = distress > 0.6 ? `1px solid rgba(255, 68, 68, ${0.3 + heat*0.4})` : '1px solid var(--border)'
              
              return (
                <div 
                  key={fragment.id}
                  onMouseEnter={() => setHoveredEventId(eventId)}
                  onMouseLeave={() => setHoveredEventId(null)}
                  style={{
                    padding: '0.85rem',
                    borderRadius: 14,
                    border: isHovered ? '1px solid #ffffff' : borderOverlay,
                    background: bgOverlay,
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: isHovered ? '#fff' : 'var(--dim)' }}>
                      {eventId} · session {fragment.source_session || '1'}
                    </span>
                    {distress > 0.6 && (
                      <span style={{ fontSize: 10, background: '#ff4444', color: '#fff', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                        HIGH DISTRESS [{distress.toFixed(2)}]
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: '#e0e0e0' }}>
                    {fragment.text}
                  </div>
                </div>
              )
            })}
            {sortedTranscripts.length === 0 && (
              <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '2rem' }}>No intake data available.</p>
            )}
          </div>
        </section>

        {/* RIGHT PANE: Ranked Timeline */}
        <section className="scanlines" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg, rgba(20,20,20,0.95) 0%, rgba(8,8,8,0.98) 100%)', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#9fe1cb' }}>Resolved Ranked Timeline</h2>
            <Link to="/inference" style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'underline' }}>Engine settings</Link>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
            <ol style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--dim)', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {rankedTimeline.map((r) => {
                const isHovered = hoveredEventId === r.event_id
                return (
                  <li 
                    key={r.event_id} 
                    onMouseEnter={() => setHoveredEventId(r.event_id)}
                    onMouseLeave={() => setHoveredEventId(null)}
                    style={{ 
                      transition: 'all 0.2s ease', 
                      opacity: hoveredEventId && !isHovered ? 0.4 : 1,
                      borderLeft: isHovered ? '2px solid #9fe1cb' : '2px solid transparent',
                      paddingLeft: isHovered ? '0.5rem' : '0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        <strong style={{ color: '#ffffff' }}>#{r.rank}</strong> · {r.event_id}
                      </span>
                      <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 12, color: '#e0e0e0' }}>
                        p={r.confidence_score}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: 6, color: '#f0f0f0', lineHeight: 1.5 }}>{r.summary}</div>
                    <div style={{ fontSize: '0.75rem', marginTop: 6, color: 'var(--dim)' }}>
                      <strong>Trace:</strong> {r.reasoning_trace}
                    </div>
                  </li>
                )
              })}
            </ol>
            {rankedTimeline.length === 0 && (
              <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '2rem' }}>
                Run the Vidhi engine in the Timeline Engine page to surface ranked fragments.
              </p>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
