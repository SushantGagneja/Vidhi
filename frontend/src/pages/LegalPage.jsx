import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api.js'
import { useCase } from '../context/CaseContext.jsx'

export default function LegalPage() {
  const { caseId, caseData, ensure, refreshCase } = useCase()
  const [bnsSuggestions, setBnsSuggestions] = useState([])
  const [selectedBns, setSelectedBns] = useState([])
  const [busy, setBusy] = useState('')
  const [notes, setNotes] = useState({})
  const [lastFingerprint, setLastFingerprint] = useState('')

  useEffect(() => {
    ensure().then(() => refreshCase())
  }, [ensure, refreshCase])

  useEffect(() => {
    if (Array.isArray(caseData?.verified_bns)) setSelectedBns(caseData.verified_bns)
    const seeded = {}
    ;(caseData?.transcripts || []).forEach((fragment) => {
      seeded[fragment.id] = fragment.lawyer_note || ''
    })
    setNotes(seeded)
  }, [caseData])

  const targets = caseData?.dashboard?.cross_exam_targets || []
  const contradictions = caseData?.dashboard?.contradiction_explanations || []
  const distressPeaks = caseData?.dashboard?.distress_peaks || []

  const fragmentsByEvent = useMemo(() => {
    const map = {}
    ;(caseData?.transcripts || []).forEach((fragment, idx) => {
      map[`F${idx + 1}`] = fragment
    })
    return map
  }, [caseData])

  const suggestBns = async () => {
    setBusy('Mapping legal sections...')
    try {
      const s = await api.bnsSuggest(caseId)
      setBnsSuggestions(s.suggestions || [])
    } finally {
      setBusy('')
    }
  }

  const toggleBns = async (id) => {
    const next = selectedBns.includes(id) ? selectedBns.filter((x) => x !== id) : [...selectedBns, id]
    setSelectedBns(next)
    await api.verifyBns(caseId, next)
  }

  const saveNote = async (fragmentId) => {
    setBusy('Saving annotations...')
    try {
      await api.updateTranscript(caseId, fragmentId, { lawyer_note: notes[fragmentId] || '' })
      await refreshCase()
    } finally {
      setBusy('')
    }
  }

  const saveAll = async () => {
    setBusy('Syncing annotation layer...')
    try {
      await api.saveAnnotations(caseId, notes)
      await refreshCase()
    } finally {
      setBusy('')
    }
  }

  const genPdf = async () => {
    if (!selectedBns.length) {
      alert('Select at least one legal section first.')
      return
    }
    setBusy('Generating Daubert-style export...')
    try {
      const { blob, fingerprint } = await api.downloadPdf(caseId)
      setLastFingerprint(fingerprint)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vidhi-${caseId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      await refreshCase()
    } catch (e) {
      alert(e.message || String(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem' }}>
      <header style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Cross-exam prep dashboard</h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.9rem', maxWidth: 760 }}>
          Left side of the pitch: where testimony is vulnerable. Right side of the pitch: why your methodology is still
          defensible. <Link to="/output" style={{ color: 'var(--accent)' }}>Open export view</Link>
        </p>
        {busy && <p style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>{busy}</p>}
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1rem', marginBottom: '1rem' }}>
        <Panel title="Attack surface">
          {targets.map((target) => {
            const fragment = fragmentsByEvent[target.event_id]
            return (
              <div key={target.event_id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <strong>{target.event_id}</strong>
                  <span style={{ color: '#f5c4b3' }}>
                    confidence {target.confidence_score} · distress {target.distress_score}
                  </span>
                </div>
                <p style={{ color: 'var(--dim)' }}>{target.summary}</p>
                <p style={{ margin: '0.35rem 0', color: '#f0b7a0' }}>{target.attack_surface}</p>
                <p style={{ margin: '0 0 0.65rem', color: 'var(--muted)', fontSize: '0.85rem' }}>{target.recommended_prep}</p>
                {fragment && (
                  <>
                    <textarea
                      value={notes[fragment.id] || ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [fragment.id]: e.target.value }))}
                      placeholder="Add lawyer note for this node..."
                      style={textareaStyle}
                    />
                    <button type="button" onClick={() => saveNote(fragment.id)} style={smallButtonStyle}>
                      Save note
                    </button>
                  </>
                )}
              </div>
            )
          })}
          {targets.length === 0 && <EmptyState text="Run intake and timeline reconstruction to surface cross-exam targets." />}
        </Panel>

        <Panel title="Distress overlay">
          {distressPeaks.map((peak) => (
            <div key={peak.event_id} style={cardStyle}>
              <strong>{peak.event_id}</strong>
              <p style={{ color: 'var(--dim)' }}>{peak.summary}</p>
              <p style={{ margin: 0, color: '#9fe1cb' }}>Distress marker {peak.distress_score} · {peak.marker}</p>
            </div>
          ))}
          {distressPeaks.length === 0 && <EmptyState text="No high-distress fragment markers yet." />}
        </Panel>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <Panel title="Contradiction explainer">
          {contradictions.map((item) => (
            <div key={item.anchor} style={cardStyle}>
              <strong>{item.anchor}</strong>
              <p style={{ color: 'var(--dim)' }}>{item.explanation}</p>
            </div>
          ))}
          {contradictions.length === 0 && <EmptyState text="No contradiction clusters yet. That is okay for a clean demo." />}
        </Panel>

        <Panel title="Legal section mapping">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
            <button type="button" onClick={suggestBns} style={smallButtonStyle}>
              Suggest legal sections
            </button>
            <button type="button" onClick={saveAll} style={smallButtonStyle}>
              Save annotation layer
            </button>
          </div>

          {(bnsSuggestions || []).map((s) => (
            <label key={s.id} style={{ ...cardStyle, display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
              <input type="checkbox" checked={selectedBns.includes(s.id)} onChange={() => toggleBns(s.id)} />
              <span>
                {s.id} - {s.title} <span style={{ color: 'var(--muted)' }}>[{s.confidence}]</span>
              </span>
            </label>
          ))}
          {bnsSuggestions.length === 0 && <EmptyState text="Pull legal sections after fragments are on the server." />}
        </Panel>
      </section>

      <button type="button" onClick={genPdf} disabled={!selectedBns.length} style={primaryButtonStyle(selectedBns.length > 0)}>
        Generate Daubert export
      </button>

      {(caseData?.pdf_hash || lastFingerprint) && (
        <p style={{ margin: '1rem 0 0', fontSize: '0.75rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
          Fingerprint: {lastFingerprint || caseData?.pdf_hash}
        </p>
      )}
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: '1rem' }}>
      <h2 style={{ marginTop: 0, fontSize: '1rem' }}>{title}</h2>
      <div style={{ display: 'grid', gap: '0.75rem' }}>{children}</div>
    </section>
  )
}

function EmptyState({ text }) {
  return <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{text}</p>
}

const cardStyle = {
  padding: '0.85rem',
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.025)',
}

const textareaStyle = {
  width: '100%',
  minHeight: 72,
  marginTop: '0.25rem',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: '#111',
  color: '#fff',
  padding: '0.75rem',
}

const smallButtonStyle = {
  padding: '0.55rem 0.9rem',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  fontWeight: 600,
}

const primaryButtonStyle = (enabled) => ({
  padding: '0.85rem 1.4rem',
  borderRadius: 999,
  border: 'none',
  fontWeight: 700,
  background: enabled ? '#9fe1cb' : '#2b2b2b',
  color: enabled ? '#06241d' : '#fff',
})
