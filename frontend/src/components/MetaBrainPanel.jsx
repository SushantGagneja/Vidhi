import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchBrainMapping } from '../api.js'

/**
 * Meta-style research chrome: brain area shows server matplotlib 4-panel mapping
 * only after "Show brain mapping" (random fields seeded from stress modalities).
 */
function PillToggle({ options, value, onChange }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: '#1a1a1a',
        borderRadius: 999,
        padding: 3,
        gap: 2,
        border: '1px solid #2a2a2a',
      }}
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          style={{
            border: 'none',
            borderRadius: 999,
            padding: '6px 14px',
            fontSize: 12,
            cursor: 'pointer',
            background: value === o ? '#3a3a3a' : 'transparent',
            color: value === o ? '#fff' : '#888',
            fontWeight: value === o ? 600 : 400,
          }}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

function TabInfo({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: active ? '#fff' : '#777',
        fontSize: 13,
        padding: '8px 6px',
        cursor: 'pointer',
        borderBottom: active ? '2px solid #fff' : '2px solid transparent',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: '1px solid #555',
          fontSize: 9,
          color: '#888',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        i
      </span>
    </button>
  )
}

function HeadSilhouette() {
  return (
    <svg
      viewBox="0 0 200 240"
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: 0.15,
      }}
    >
      <path
        fill="none"
        stroke="#6b6b70"
        strokeWidth="1.2"
        d="M 118 38 C 155 42 178 78 176 118 C 175 145 168 162 158 178 C 148 198 132 212 108 218 C 88 222 72 214 62 198 C 52 182 48 158 50 132 C 52 88 78 52 118 38 Z"
      />
    </svg>
  )
}

export default function MetaBrainPanel({
  regionLabel,
  voice,
  words,
  face,
  possibility,
  stressPoints,
}) {
  const displayStim = Math.max(0.12, Math.min(1, possibility ?? 0.45))
  const [expanded, setExpanded] = useState(false)
  const [truthPred, setTruthPred] = useState('Predicted')
  const [openClose, setOpenClose] = useState('Close')
  const [meshMode, setMeshMode] = useState('Normal')
  const [tab, setTab] = useState('In-Silico')
  const [stimulusCat, setStimulusCat] = useState('Places')
  const [playhead, setPlayhead] = useState(0.08)

  const [mappingShown, setMappingShown] = useState(false)
  const [mappingLoading, setMappingLoading] = useState(false)
  const [mappingErr, setMappingErr] = useState('')
  const [imageSrc, setImageSrc] = useState('')
  const [meta, setMeta] = useState(null)
  const blobUrlRef = useRef(null)

  const viewerWrapRef = useRef(null)
  const [viewerMinH, setViewerMinH] = useState(300)

  const label = regionLabel || 'Parahippocampal Place Area'

  const measure = useCallback(() => {
    const el = viewerWrapRef.current
    if (!el) return
    const w = el.clientWidth
    setViewerMinH(Math.max(260, Math.round((w * 10) / 16)))
  }, [])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (viewerWrapRef.current) ro.observe(viewerWrapRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  const loadMapping = useCallback(async () => {
    setMappingErr('')
    setMappingLoading(true)
    try {
      const { image_b64: b64, meta: m } = await fetchBrainMapping({
        voice: voice ?? 0.35,
        words: words ?? 0.45,
        face: face ?? 0.35,
        possibility: possibility ?? displayStim,
        stress_points: stressPoints?.length ? stressPoints : [],
        n_timesteps: 15,
      })
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'image/png' })
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url
      setImageSrc(url)
      setMeta(m)
      setMappingShown(true)
    } catch (e) {
      setMappingErr(e.message || String(e))
    } finally {
      setMappingLoading(false)
    }
  }, [voice, words, face, possibility, displayStim, stressPoints])

  const panelInner = (
    <div
      style={{
        background: '#000',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #222',
        fontFamily: 'ui-sans-serif, system-ui, Segoe UI, Roboto, sans-serif',
      }}
    >
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => mappingShown && imageSrc && setExpanded(true)}
          disabled={!mappingShown || !imageSrc}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 5,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #333',
            background: '#141414',
            color: mappingShown ? '#e8e8e8' : '#555',
            fontSize: 13,
            cursor: mappingShown ? 'pointer' : 'not-allowed',
            opacity: mappingShown ? 1 : 0.55,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.85 }}>
            <path d="M3 3h4v4H3V3zm6 0h4v4H9V3zM3 9h4v4H3V9zm6 0h4v4H9V9z" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          Expand Demo
        </button>

        <div
          ref={viewerWrapRef}
          style={{
            position: 'relative',
            width: '100%',
            minHeight: viewerMinH,
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HeadSilhouette />
          {!mappingShown && (
            <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '2rem 1.5rem' }}>
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 1rem', maxWidth: 360 }}>
                Flatmap-style panels (fire cmap · 15 timesteps · p99 norm) generated on the server from your current
                modality scores. Press the button when ready.
              </p>
              <button
                type="button"
                disabled={mappingLoading}
                onClick={loadMapping}
                style={{
                  padding: '12px 22px',
                  borderRadius: 999,
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: mappingLoading ? 'wait' : 'pointer',
                  background: 'linear-gradient(135deg, #ff3b00, #ffcc33)',
                  color: '#1a0500',
                  boxShadow: '0 8px 28px rgba(255, 80, 0, 0.25)',
                }}
              >
                {mappingLoading ? 'Rendering…' : 'Show brain mapping'}
              </button>
              {mappingErr && (
                <p style={{ color: '#f87171', fontSize: 12, marginTop: 12, maxWidth: 400 }}>{mappingErr}</p>
              )}
            </div>
          )}
          {mappingShown && imageSrc && (
            <img
              src={imageSrc}
              alt="Brain mapping"
              style={{
                position: 'relative',
                zIndex: 2,
                width: '100%',
                height: 'auto',
                display: 'block',
                objectFit: 'contain',
              }}
            />
          )}
        </div>

        {mappingShown && meta && (
          <div
            style={{
              padding: '10px 16px 14px',
              borderTop: '1px solid #1f1f1f',
              fontSize: 11,
              color: '#7a7a7a',
              fontFamily: 'ui-monospace, monospace',
              lineHeight: 1.5,
            }}
          >
            <div>
              n_timesteps={meta.n_timesteps} · cmap={meta.cmap} · p{meta.norm_percentile}={meta.vmax_effective?.toFixed(3)}{' '}
              · vmin={meta.vmin} · α={JSON.stringify(meta.alpha_cmap)}
            </div>
            <div style={{ marginTop: 4 }}>
              voice={Number(voice).toFixed(2)} words={Number(words).toFixed(2)} face={Number(face).toFixed(2)} P=
              {Number(possibility).toFixed(2)}
              {stressPoints?.length ? ` · stress_pts=${stressPoints.length}` : ''}
            </div>
            {meta.segment_means && (
              <div style={{ marginTop: 6, wordBreak: 'break-all' }}>
                segments[:15]=[{meta.segment_means.map((x) => x.toFixed(2)).join(', ')}]
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 16px' }}>
          <span
            style={{
              padding: '8px 20px',
              borderRadius: 999,
              background: '#1c1c1c',
              border: '1px solid #333',
              color: '#f0f0f0',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {label}
          </span>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid #222',
          borderBottom: '1px solid #222',
          padding: '14px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px 20px',
          alignItems: 'center',
          background: '#080808',
        }}
      >
        <PillToggle options={['True', 'Predicted']} value={truthPred} onChange={setTruthPred} />
        <PillToggle options={['Open', 'Close']} value={openClose} onChange={setOpenClose} />
        <PillToggle options={['Normal', 'Inflated']} value={meshMode} onChange={setMeshMode} />

        <div style={{ flex: 1, minWidth: 200 }} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {['Examples', 'Performance', 'In-Silico', 'Multimodality'].map((t) => (
            <TabInfo key={t} label={t} active={tab === t} onClick={() => setTab(t)} />
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          padding: 16,
          background: '#000',
        }}
      >
        <div
          style={{
            borderRadius: 12,
            border: '1px solid #222',
            background: '#111',
            minHeight: 120,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E")`,
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '72%',
              paddingBottom: '72%',
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: '0 0 0 999px #1a1a1a',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 40%), url(https://images.unsplash.com/photo-1580582932707-520aed937d7b?w=400&q=80&auto=format&fit=crop)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'grayscale(1) contrast(1.1) brightness(0.85)',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
          <select
            value={stimulusCat}
            onChange={(e) => setStimulusCat(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #333',
              background: '#1a1a1a',
              color: '#eee',
              fontSize: 14,
            }}
          >
            {['Places', 'Faces', 'Objects', 'Threat audio', 'Vidhi · testimony'].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {[
              { icon: '▶' },
              { icon: '🔇' },
              { t: '2x' },
            ].map((b, i) => (
              <button
                key={i}
                type="button"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: '1px solid #333',
                  background: '#161616',
                  color: '#ddd',
                  cursor: 'pointer',
                  fontSize: b.t ? 12 : 14,
                }}
              >
                {b.t || b.icon}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={playhead}
            onChange={(e) => setPlayhead(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#666' }}
          />
        </div>
      </div>
    </div>
  )

  const expandModal =
    expanded &&
    imageSrc &&
    createPortal(
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
        onClick={() => setExpanded(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: 'min(1000px, 96vw)', maxHeight: '92vh', overflow: 'auto' }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #444',
                background: '#1a1a1a',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
          <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #333' }}>
            <img src={imageSrc} alt="Brain mapping expanded" style={{ width: '100%', display: 'block' }} />
            <div style={{ textAlign: 'center', padding: 16, background: '#000', color: '#ccc', fontSize: 13 }}>
              {label} · P {(displayStim * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )

  return (
    <>
      {panelInner}
      {expandModal}
    </>
  )
}
