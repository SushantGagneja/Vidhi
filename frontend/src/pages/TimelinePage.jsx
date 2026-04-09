import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api.js'
import ConversationGraph from '../components/ConversationGraph.jsx'
import EventPossibilityChart from '../components/EventPossibilityChart.jsx'
import KnowledgeGraph from '../components/KnowledgeGraph.jsx'
import { useCase } from '../context/CaseContext.jsx'
import { FORMULA_LABEL } from '../utils/possibility.js'

const PHASES = [
  { id: 'ingest', title: 'Fragment ingest', blurb: 'Voice or text fragments preserved without forcing chronology.' },
  { id: 'nlp', title: 'Anchor extraction', blurb: 'Sensory and temporal cues are separated instead of flattened.' },
  { id: 'fuse', title: 'Confidence scoring', blurb: FORMULA_LABEL },
  { id: 'chrono', title: 'Linear presentation', blurb: 'Likely order is ranked while uncertainty stays visible.' },
]

export default function TimelinePage() {
  const { caseId, refreshCase, ensure } = useCase()
  const [phaseIdx, setPhaseIdx] = useState(-1)
  const [running, setRunning] = useState(false)
  const [pitch, setPitch] = useState(null)
  const [conv, setConv] = useState({ nodes: [], edges: [] })
  const [kg, setKg] = useState({ nodes: [], edges: [] })
  const [err, setErr] = useState('')

  useEffect(() => {
    ensure()
  }, [ensure])

  const runEngine = useCallback(async () => {
    setErr('')
    setRunning(true)
    setPhaseIdx(0)
    setPitch(null)
    for (let i = 0; i < PHASES.length; i++) {
      /* eslint-disable no-await-in-loop */
      await new Promise((r) => setTimeout(r, i === 0 ? 400 : 700))
      setPhaseIdx(i)
    }
    try {
      const [p, se, kgJson] = await Promise.all([
        api.pitchTimeline(caseId),
        api.semanticEdges(caseId),
        api.knowledgeGraph(caseId),
      ])
      setPitch(p)
      setConv(se || { nodes: [], edges: [] })
      setKg({ nodes: kgJson?.nodes || [], edges: kgJson?.edges || [] })
      setPhaseIdx(PHASES.length)
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setRunning(false)
    }
  }, [caseId])

  const events = pitch?.events || []
  const recon = pitch?.reconstructed_timeline || []

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '1.25rem' }}>
      <header style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>Vidhi timeline engine</h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.88rem' }}>
          Collect non-linearly, present linearly.{' '}
          <Link to="/legal" style={{ color: 'var(--accent)' }}>
            Cross-exam prep →
          </Link>
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {PHASES.map((ph, i) => (
            <div
              key={ph.id}
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: phaseIdx === i ? 'rgba(255,255,255,0.08)' : 'var(--panel)',
                opacity: phaseIdx < i && running ? 0.35 : 1,
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 700 }}>0{i + 1}</div>
              <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{ph.title}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 4 }}>{ph.blurb}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: 'linear-gradient(160deg, rgba(20,20,20,0.95) 0%, rgba(8,8,8,0.98) 100%)',
            borderRadius: 16,
            border: '1px solid var(--border)',
            padding: '1.25rem',
            minHeight: 200,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--dim)' }}>
            {phaseIdx < 0 && 'Run the engine to rank fragments, generate reasoning traces, and surface weak nodes.'}
            {running && phaseIdx >= 0 && phaseIdx < PHASES.length && (
              <span style={{ color: '#f1f1f1' }}>Running: {PHASES[phaseIdx].title}…</span>
            )}
            {!running && phaseIdx >= PHASES.length && pitch && (
              <span>
                <strong style={{ color: '#fff' }}>Ready.</strong> {pitch.formula} - {events.length} fragments,{' '}
                {recon.length} ranks in reconstructed timeline.
              </span>
            )}
            {err && <span style={{ color: '#d0d0d0' }}>{err}</span>}
          </p>
          <button
            type="button"
            disabled={running}
            onClick={runEngine}
            style={{
              marginTop: '1rem',
              alignSelf: 'flex-start',
              padding: '0.6rem 1.2rem',
              borderRadius: 3,
              border: 'none',
              fontWeight: 700,
              cursor: running ? 'wait' : 'pointer',
              background: 'var(--accent)',
              color: 'var(--black)',
              boxShadow: '0 8px 28px rgba(255, 255, 255, 0.18)',
            }}
          >
            {running ? 'Resolving…' : 'Run Vidhi engine'}
          </button>
          <button
            type="button"
            onClick={() => api.loadDemo().then(() => refreshCase())}
            style={{
              marginTop: '0.5rem',
              alignSelf: 'flex-start',
              padding: '0.4rem 0.9rem',
              borderRadius: 3,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--muted)',
              fontSize: '0.8rem',
            }}
          >
            Load demo data first
          </button>
        </div>
      </div>

      {events.length > 0 && (
        <>
          <section style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Confidence graph · per-fragment</h2>
            <div
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '1rem',
                overflow: 'auto',
              }}
            >
              <EventPossibilityChart events={events} width={720} height={240} />
            </div>
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Fragment similarity graph</h3>
              <ConversationGraph graph={conv} width={480} height={260} />
            </div>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Corroboration graph</h3>
              <KnowledgeGraph nodes={kg.nodes} edges={kg.edges} width={480} height={260} />
            </div>
          </section>

          <section style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Ranked timeline</h2>
            <ol style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--dim)' }}>
              {recon.map((r) => (
                <li key={r.event_id} style={{ marginBottom: '0.65rem' }}>
                  <strong style={{ color: '#ffffff' }}>#{r.rank}</strong> · {r.event_id} · confidence={r.confidence_score} ·{' '}
                  <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>[{r.confidence_band}]</span>
                  <div style={{ fontSize: '0.82rem', marginTop: 4 }}>{r.summary}</div>
                  <div style={{ fontSize: '0.76rem', marginTop: 4, color: '#9fe1cb' }}>{r.reasoning_trace}</div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Fragment detail</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {events.map((ev) => (
                <details
                  key={ev.id}
                  style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '0.65rem 1rem',
                  }}
                >
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                    {ev.id} · confidence={ev.confidence_score}{' '}
                    <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: '0.8rem' }}>
                      distress {ev.distress_score} · anchor {ev.sensory_anchor}
                    </span>
                  </summary>
                  <div style={{ marginTop: '0.55rem', display: 'grid', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--dim)' }}>
                    <div>{ev.summary}</div>
                    <div>Reasoning trace: {ev.reasoning_trace}</div>
                    <div>Temporal anchor: {ev.temporal_anchor}</div>
                    <div>Legal flag: {ev.legal_flag}</div>
                    <div>Hash: {ev.fragment_hash}</div>
                  </div>
                </details>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
