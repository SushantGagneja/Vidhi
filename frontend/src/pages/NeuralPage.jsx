import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api.js'
import neuralOne from '../assets/neural-1.jpeg'
import neuralTwo from '../assets/neural-2.jpeg'

export default function NeuralPage() {
  const [spokenSample, setSpokenSample] = useState(
    'He had been threatening me for weeks and I was afraid to report earlier.',
  )
  const [desc, setDesc] = useState('')
  const [audioSrc, setAudioSrc] = useState('')
  const [brainSrc, setBrainSrc] = useState('')
  const [brainGrid, setBrainGrid] = useState([])
  const [mods, setMods] = useState({ voice: 0.81, words: 0.74, face: 0.61, possibility: 0.81 })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const stressLevel = useMemo(() => {
    const p = Number(mods?.possibility || 0)
    if (p >= 0.65) return 'High Distress'
    if (p >= 0.35) return 'Moderate'
    return 'Calm'
  }, [mods])

  const runSynthetic = async () => {
    setLoading(true)
    setErr('')
    try {
      const out = await api.syntheticBrainMapping(spokenSample, 15)
      setDesc(out.description || '')
      setMods(out.modalities || mods)
      setAudioSrc(`data:audio/wav;base64,${out.audio_wav_b64 || ''}`)
      setBrainSrc(`data:image/png;base64,${out.brain_image_b64 || ''}`)
      setBrainGrid(
        Array.isArray(out.brain_grid_b64)
          ? out.brain_grid_b64.map((x) => `data:image/png;base64,${x}`)
          : [],
      )
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '1.25rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '65% 35%', gap: '0.85rem' }}>
        <section className="panel scanlines" style={{ padding: '0.85rem' }}>
          <div
            style={{
              height: 280,
              border: '1px solid var(--border)',
              borderRadius: 2,
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0,
              background: '#000',
            }}
          >
            <img
              src={neuralOne}
              alt="Neural analysis visual 1"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <img
              src={neuralTwo}
              alt="Neural analysis visual 2"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <p className="mono-note">TRIBE v2 NEURAL ENCODING - STIMULUS RESPONSE SIMULATION</p>

          <div className="sep" />
          <label className="mono-note" htmlFor="spoken-sample">SPOKEN SAMPLE</label>
          <textarea
            id="spoken-sample"
            value={spokenSample}
            onChange={(e) => setSpokenSample(e.target.value)}
            style={{
              width: '100%',
              minHeight: 82,
              resize: 'vertical',
              marginTop: 6,
              marginBottom: 8,
              border: '1px solid var(--border)',
              borderRadius: 2,
              background: 'rgba(0,0,0,0.45)',
              color: 'var(--white)',
              padding: 8,
              fontSize: 12,
            }}
          />
          <button type="button" className="cta" style={{ width: 'auto' }} onClick={runSynthetic} disabled={loading}>
            {loading ? 'GENERATING...' : 'GENERATE SYNTHETIC TRAUMA -> AUDIO -> 2x2 BRAIN MAP'}
          </button>
          {err ? <p style={{ color: 'var(--accent2)', fontSize: 12 }}>{err}</p> : null}
          {desc ? (
            <p style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.6, marginTop: 10 }}>
              {desc}
            </p>
          ) : null}
          {audioSrc ? (
            <audio controls src={audioSrc} style={{ width: '100%', marginTop: 8 }} />
          ) : null}
          {brainSrc ? (
            <div style={{ marginTop: 10 }}>
              {brainGrid.length === 4 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {brainGrid.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Synthetic brain panel ${i + 1}`}
                      style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 2 }}
                    />
                  ))}
                </div>
              ) : (
                <img
                  src={brainSrc}
                  alt="Synthetic 2x2 brain mapping"
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 2 }}
                />
              )}
            </div>
          ) : null}
        </section>
        <section className="panel scanlines" style={{ padding: '1rem' }}>
          <h2 className="panel-title">Neural Activation Signature</h2>
          {[
            ['AMYGDALA', 'Threat & fear processing', Math.round((mods.voice || 0) * 100), 'HIGH ACTIVATION'],
            ['ANTERIOR CINGULATE', 'Conflict monitoring - Pain response', Math.round((mods.words || 0) * 100), 'ELEVATED'],
            ['INSULA', 'Interoception - Disgust - Social pain', Math.round((mods.face || 0) * 100), 'MODERATE'],
          ].map(([name, desc, val, tag]) => (
            <article key={name} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{name}</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 6 }}>{desc}</div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${val}%` }} /></div>
              <div className="mono-note">{tag}</div>
            </article>
          ))}
          <div className="sep" />
          <div className="stress-pill">{stressLevel.toUpperCase()}</div>
          <p className="mono-note">Bayesian posterior: P(high | V,W,F) = {(mods.possibility || 0).toFixed(2)}</p>
          <div className="sep" />
          <p className="mono-note">Foundation model: TRIBE v2 - Fusion weights [0.54, 0.32, 0.14]</p>
          <Link to="/inference" className="cta-link">PROCEED TO INFERENCE ENGINE -&gt;</Link>
        </section>
      </div>
    </div>
  )
}
