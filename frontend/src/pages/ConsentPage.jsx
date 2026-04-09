import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api.js'
import { useCase } from '../context/CaseContext.jsx'

const policies = [
  { value: 'legal-team', label: 'Legal team only' },
  { value: 'expert-review', label: 'Legal + expert witness' },
  { value: 'restricted', label: 'Restricted until explicit release' },
]

export default function ConsentPage() {
  const navigate = useNavigate()
  const { caseId, ensure, caseData, refreshCase } = useCase()
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [survivorName, setSurvivorName] = useState('Survivor')
  const [accessPolicy, setAccessPolicy] = useState('legal-team')

  useEffect(() => {
    ensure().then((data) => {
      setSurvivorName(data?.survivor_name || 'Survivor')
      setAccessPolicy(data?.access_policy || 'legal-team')
    })
  }, [ensure])

  const begin = async () => {
    if (!ok || busy) return
    setBusy(true)
    try {
      await api.updateConsent(caseId, { survivor_name: survivorName, access_policy: accessPolicy })
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      } catch {
        // fallback for demo environments
      }
      await refreshCase()
      navigate('/interview')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '1.25rem' }}>
      <section
        style={{
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '1.4rem',
          background: 'linear-gradient(180deg, rgba(159,225,203,0.08), rgba(255,255,255,0.02))',
        }}
      >
        <p className="eyebrow">Survivor control panel</p>
        <h1 style={{ marginTop: 0 }}>Set consent before intake</h1>
        <p style={{ color: 'var(--dim)', maxWidth: 700 }}>
          Vidhi records fragments, not forced narratives. The survivor decides what can be seen, who can access it, and
          whether a fragment stays visible to the legal team.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: '0.45rem' }}>
            <span>Survivor label</span>
            <input
              value={survivorName}
              onChange={(e) => setSurvivorName(e.target.value)}
              style={{
                padding: '0.85rem 0.95rem',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text)',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.45rem' }}>
            <span>Access policy</span>
            <select
              value={accessPolicy}
              onChange={(e) => setAccessPolicy(e.target.value)}
              style={{
                padding: '0.85rem 0.95rem',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: '#111',
                color: 'var(--text)',
              }}
            >
              {policies.map((policy) => (
                <option key={policy.value} value={policy.value}>
                  {policy.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            borderRadius: 16,
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.45rem' }}>Session guarantees</div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--dim)', lineHeight: 1.7 }}>
            <li>The survivor can pause and return in another session.</li>
            <li>Each fragment is hash-stamped for provenance and can still be hidden later through consent controls.</li>
            <li>Acoustic markers are used as fragment metadata, not as truth or lie labels.</li>
          </ul>
        </div>

        <label style={{ display: 'flex', gap: '0.7rem', marginTop: '1rem', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>
            I understand that Vidhi preserves uncertainty, records fragment-level provenance, and allows the survivor to
            revoke visible access later.
          </span>
        </label>

        <button
          type="button"
          disabled={!ok || busy}
          onClick={begin}
          style={{
            marginTop: '1rem',
            padding: '0.85rem 1.4rem',
            borderRadius: 999,
            border: 'none',
            background: !ok || busy ? '#365149' : '#9fe1cb',
            color: !ok || busy ? '#d1e0d8' : '#06241d',
            fontWeight: 700,
            cursor: !ok || busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Preparing intake...' : 'Continue to fragment intake'}
        </button>

        {caseData?.access_policy && (
          <p style={{ marginBottom: 0, marginTop: '0.85rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Current policy: {caseData.access_policy}
          </p>
        )}
      </section>
    </div>
  )
}
