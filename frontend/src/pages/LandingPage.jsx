import { Link } from 'react-router-dom'

const pillars = [
  ['Collect non-linearly', 'Survivors can speak in fragments, pause, return later, and stay out of rigid forms.'],
  ['Present linearly', 'Vidhi reconstructs a ranked event timeline with confidence bands and reasoning traces.'],
  ['Defend in court', 'Paralegals get cross-exam prep, contradiction explanations, and a Daubert-ready export.'],
]

export default function LandingPage() {
  return (
    <div
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        minHeight: 'calc(100vh - 2rem)',
        padding: '1.25rem',
        display: 'grid',
        gap: '1rem',
        alignContent: 'center',
      }}
    >
      <section
        style={{
          padding: '2rem',
          border: '1px solid var(--border)',
          borderRadius: 18,
          background:
            'radial-gradient(circle at top left, rgba(177, 232, 211, 0.14), transparent 35%), linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.01))',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.28em',
            fontSize: '0.7rem',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          Trauma-informed evidentiary engine
        </p>
        <h1
          style={{
            margin: '0.8rem 0 0.65rem',
            fontSize: 'clamp(3rem, 11vw, 7rem)',
            lineHeight: 0.94,
            fontWeight: 800,
            color: '#ffffff',
          }}
        >
          VIDHI
        </h1>
        <p style={{ margin: '0 0 1rem', fontSize: '1.05rem', color: '#d8e6df', maxWidth: 680 }}>
          Collect non-linearly, present linearly. A survivor-safe intake flow for fragmented memory, paired with a
          courtroom-facing reconstruction engine built for cross-examination and admissibility review.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            to="/consent"
            style={{
              padding: '0.8rem 1.4rem',
              borderRadius: 999,
              background: '#9fe1cb',
              color: '#05241d',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Start survivor intake
          </Link>
          <Link
            to="/legal"
            style={{
              padding: '0.8rem 1.4rem',
              borderRadius: 999,
              border: '1px solid var(--border)',
              color: 'var(--text)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Open legal dashboard
          </Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {pillars.map(([title, copy]) => (
          <article
            key={title}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '1rem',
              background: 'rgba(255,255,255,0.025)',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: '#9fe1cb', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              Core promise
            </div>
            <h2 style={{ margin: '0.5rem 0 0.45rem', fontSize: '1.15rem' }}>{title}</h2>
            <p style={{ margin: 0, color: 'var(--dim)', fontSize: '0.92rem', lineHeight: 1.6 }}>{copy}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
