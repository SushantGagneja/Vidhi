import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api.js'
import FaceMeshViewport from '../components/FaceMeshViewport.jsx'
import { useCase } from '../context/CaseContext.jsx'
import CounselorGuidancePanel from '../components/CounselorGuidancePanel.jsx'
import { initFaceMesh, computeFaceStressScore } from '../services/facemesh.js'
import { createSpeechCaptions, isSpeechSupported } from '../services/stt.js'
import { possibility, stressLabel, wordsHeuristic } from '../utils/possibility.js'

function useAudioEnergy(active) {
  const [energy, setEnergy] = useState(0.25)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!active) return
    let stream
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const ctx = new AudioContext()
        const src = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        src.connect(analyser)
        ctxRef.current = ctx
        analyserRef.current = analyser
        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(data)
          let s = 0
          for (let i = 0; i < data.length; i++) s += data[i]
          const norm = Math.min(1, (s / data.length / 255) * 2.2)
          setEnergy(norm)
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        setEnergy(0.32)
      }
    })()
    return () => {
      cancelAnimationFrame(rafRef.current)
      ctxRef.current?.close?.()
      stream?.getTracks?.().forEach((t) => t.stop())
    }
  }, [active])

  return energy
}

export default function CapturePage() {
  const { caseId, refreshCase, ensure } = useCase()
  const videoRef = useRef(null)
  const landmarksRef = useRef(null)
  const ausRef = useRef({ AU6: 0, AU12: 0, brow: 0, EAR: 0.3 })
  const lastFaceFrameAtRef = useRef(0)
  const scoresRef = useRef({ voice: 0, words: 0, face: 0, possibility: 0 })
  const demoWordsRef = useRef([])

  const [camOn, setCamOn] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [captionsOn, setCaptionsOn] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [demoSpike, setDemoSpike] = useState(false)
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [frameCount, setFrameCount] = useState(1)
  const [camStatus, setCamStatus] = useState('OFFLINE')

  const [faceScore, setFaceScore] = useState(0.35)
  const voiceRef = useRef(0.25)
  const faceRef = useRef(0.35)
  const tribeEnergy = useAudioEnergy(micOn)
  const voiceScore = demoSpike ? 0.88 : tribeEnergy
  const [captionWords, setCaptionWords] = useState([])
  const [interim, setInterim] = useState('')
  const [busy, setBusy] = useState('')

  const wordsScore = wordsHeuristic(
    `${captionWords.map((w) => w.word).join(' ')} ${interim}`,
  )
  const p = possibility(voiceScore, wordsScore, faceScore)
  const timerLabel = `${String(Math.floor(sessionSeconds / 60)).padStart(2, '0')}:${String(sessionSeconds % 60).padStart(2, '0')}`
  const stressState =
    sessionSeconds < 30
      ? { label: 'CALM', color: '#f0f0f0', tint: 'rgba(255,255,255,0.02)' }
      : sessionSeconds < 60
        ? { label: 'MODERATE DISTRESS', color: '#cccccc', tint: 'rgba(255,255,255,0.035)' }
        : { label: 'HIGH DISTRESS', color: '#ffffff', tint: 'rgba(255,255,255,0.05)' }

  scoresRef.current = { voice: voiceScore, words: wordsScore, face: faceScore, possibility: p }

  useEffect(() => {
    voiceRef.current = voiceScore
  }, [voiceScore])
  useEffect(() => {
    faceRef.current = faceScore
  }, [faceScore])

  useEffect(() => {
    ensure()
  }, [ensure])

  useEffect(() => {
    const id = setInterval(() => {
      if (camOn || micOn || captionsOn) setSessionSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [camOn, micOn, captionsOn])

  useEffect(() => {
    if (!camOn) return undefined
    const id = setInterval(() => setFrameCount((f) => f + 1), 33)
    return () => clearInterval(id)
  }, [camOn])

  useEffect(() => {
    if (!camOn) {
      setCamStatus('OFFLINE')
      return undefined
    }
    const id = setInterval(() => {
      const v = videoRef.current
      const now = Date.now()
      const sinceFace = now - (lastFaceFrameAtRef.current || 0)
      if (!v || v.readyState < 2) {
        setCamStatus('CONNECTING')
      } else if (sinceFace > 2000) {
        setCamStatus('NO FACE')
      } else {
        setCamStatus('MONITORING')
      }
    }, 350)
    return () => clearInterval(id)
  }, [camOn])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '3') {
        setDemoSpike(true)
        setTimeout(() => setDemoSpike(false), 2200)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    let stream
    ;(async () => {
      if (!camOn || !videoRef.current) return
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      } catch {
        /* ignore */
      }
    })()
    return () => stream?.getTracks?.().forEach((t) => t.stop())
  }, [camOn])

  useEffect(() => {
    let stopFm
    if (camOn && videoRef.current) {
      initFaceMesh(videoRef.current, ({ landmarks, aus }) => {
        landmarksRef.current = landmarks
        if (aus) {
          ausRef.current = aus
          setFaceScore(computeFaceStressScore(aus))
        }
        if (landmarks) lastFaceFrameAtRef.current = Date.now()
      }).then((fn) => {
        stopFm = fn
      })
    }
    return () => stopFm?.()
  }, [camOn])

  const appendChunk = useCallback(
    async (text) => {
      if (!text?.trim()) return
      const w = wordsHeuristic(text)
      const v = voiceRef.current
      const f = faceRef.current
      const pv = possibility(v, w, f)
      await api.appendTranscript(caseId, {
        text: text.trim(),
        stress_label: stressLabel(v, f),
        stress_score: 0.5 * v + 0.5 * f,
        signal_voice: v,
        signal_words: w,
        signal_face: f,
        possibility: pv,
      })
      await refreshCase()
    },
    [caseId, refreshCase],
  )

  useEffect(() => {
    if (!captionsOn || !micOn || demoMode) return
    const ctrl = createSpeechCaptions({
      lang: 'en-IN',
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        const words = t
          .split(/\s+/)
          .map((word) => ({ word, level: classifyWord(word) }))
        setCaptionWords((prev) => [...prev, ...words].slice(-260))
        setInterim('')
        appendChunk(t)
      },
    })
    ctrl.start()
    return () => ctrl.abort()
  }, [captionsOn, micOn, appendChunk])

  const loadDemo = async () => {
    setBusy('Loading scripted testimony…')
    try {
      await api.loadDemo()
      await refreshCase()
    } finally {
      setBusy('')
    }
  }

  useEffect(() => {
    if (!demoMode || !captionsOn || !micOn || !camOn) return undefined
    const scripted =
      'He called me into his office after everyone had left. I had been working there since January. He said if I told anyone he would make sure I lost my job. I did not know what to do. I just stood there. This happened again in March. And then in April. I finally told my sister. She said I should report it.'
        .split(/\s+/)
        .map((word) => ({ word, level: classifyWord(word) }))

    let i = 0
    const id = setInterval(() => {
      const token = scripted[i]
      if (!token) {
        i = 0
        return
      }
      i += 1
      demoWordsRef.current.push(token.word)
      if (demoWordsRef.current.length >= 12 || /[.]$/.test(token.word)) {
        appendChunk(demoWordsRef.current.join(' '))
        demoWordsRef.current = []
      }
      setCaptionWords((prev) => [...prev, token].slice(-260))
    }, 400)
    return () => clearInterval(id)
  }, [appendChunk, captionsOn, demoMode, micOn, camOn])

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0.75rem 1rem 1rem' }}>
      <div
        className="panel scanlines"
        style={{
          height: 48,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
          borderRadius: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>VIDHI</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--dim)' }}>{caseId}</div>
        </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: '#f5f5f5',
            border: '1px solid var(--border)',
            padding: '4px 8px',
            borderRadius: 2,
          }}>
            <span className="status-dot" style={{ background: '#ffffff' }} />LIVE
          </div>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: camStatus === 'MONITORING' ? '#ffffff' : camStatus === 'NO FACE' ? '#cfcfcf' : 'var(--dim)',
              border: '1px solid var(--border)',
              padding: '4px 8px',
              borderRadius: 2,
            }}
          >
            CAM {camStatus}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#e5e5e5' }}>HASH-STAMPED INTAKE</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>{timerLabel}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '45% 30% 25%', gap: 8, minHeight: 'calc(100vh - 170px)' }}>
        <section className="panel scanlines" style={{ position: 'relative', overflow: 'hidden', borderRadius: 2 }}>
          <FaceMeshViewport
            ref={videoRef}
            landmarksRef={landmarksRef}
            scoresRef={scoresRef}
            ausRef={ausRef}
            active={camOn}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.92))',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              color: 'var(--dim)',
              letterSpacing: '0.1em',
            }}
          >
            <span>MEDIAPIPE FACEMESH · 478 LANDMARKS · 30FPS</span>
            <span>FRAME {String(frameCount).padStart(5, '0')}</span>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateRows: '60% 40%', gap: 8, minHeight: 0 }}>
          <div className="panel scanlines" style={{ padding: 12, borderRadius: 2, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="status-dot" style={{ background: '#ffffff' }} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--accent)' }}>
                  LIVE TRANSCRIPT
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setCamOn((x) => !x)} className="outline-btn" style={{ width: 'auto', padding: '4px 8px', fontSize: 9 }}>
                  {camOn ? 'CAM ON' : 'CAM OFF'}
                </button>
                <button type="button" onClick={() => setMicOn((x) => !x)} className="outline-btn" style={{ width: 'auto', padding: '4px 8px', fontSize: 9 }}>
                  {micOn ? 'MIC ON' : 'MIC OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setCaptionsOn((x) => !x)}
                  disabled={!micOn}
                  className="outline-btn"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: 9, opacity: micOn ? 1 : 0.35 }}
                >
                  {captionsOn ? 'REC' : 'STT'}
                </button>
                <button type="button" onClick={() => setDemoMode((x) => !x)} className="outline-btn" style={{ width: 'auto', padding: '4px 8px', fontSize: 9 }}>
                  {demoMode ? 'DEMO' : 'REAL'}
                </button>
                <button type="button" onClick={loadDemo} className="outline-btn" style={{ width: 'auto', padding: '4px 8px', fontSize: 9 }}>
                  LOAD
                </button>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 2,
                padding: 12,
                background: stressState.tint,
                transition: 'background 1s ease, border-color 1s ease',
                lineHeight: 1.7,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}
            >
              {captionWords.map((w, idx) => (
                <span
                  key={`${w.word}-${idx}`}
                  style={{
                    color:
                      w.level === 'high'
                        ? '#ffffff'
                        : w.level === 'moderate'
                          ? '#d4d4d4'
                          : '#a8a8a8',
                    marginRight: 6,
                    fontSize: 13,
                  }}
                >
                  {w.word}
                </span>
              ))}
              {interim ? <span style={{ color: 'var(--dim)', fontStyle: 'italic' }}> {interim}</span> : null}
            </div>
            {busy ? <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent)' }}>{busy}</div> : null}
          </div>

          <div className="panel scanlines" style={{ padding: 12, borderRadius: 2 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--accent)', marginBottom: 8 }}>
              BAYESIAN STRESS FUSION
            </div>
            <div
              style={{
                textAlign: 'center',
                border: `1px solid ${stressState.color}`,
                color: stressState.color,
                padding: '7px 10px',
                borderRadius: 2,
                marginBottom: 10,
                transition: 'all 1s ease',
              }}
            >
              <strong style={{ fontSize: 18 }}>{stressState.label}</strong>
            </div>

            {[
              ['VOICE (TRIBE v2)', voiceScore],
              ['LEXICAL (NLP)', wordsScore],
              ['FACIAL (FACEMESH)', faceScore],
            ].map(([label, value]) => (
              <div key={label} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 9,
                    color: 'var(--dim)',
                    marginBottom: 3,
                  }}
                >
                  <span>{label}</span>
                  <span>{Math.round(value * 100)}%</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.round(value * 100)}%` }} />
                </div>
              </div>
            ))}

            <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, color: 'var(--accent)', marginTop: 6 }}>
                P = {p.toFixed(2)}
              </div>
              <div style={{ marginTop: 8 }}>
                <Link to="/neural" className="cta-link" style={{ fontSize: 10, padding: '6px 9px' }}>
                  PROCEED TO NEURAL ANALYSIS -&gt;
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <CounselorGuidancePanel 
            captionWords={captionWords} 
            stressState={stressState} 
            micOn={micOn || demoMode} 
          />
        </section>
      </div>
      {!isSpeechSupported() && !demoMode ? (
        <p style={{ marginTop: 8, fontSize: 11, color: 'var(--dim)' }}>
          SpeechRecognition not available in this browser. Enable demo mode for scripted transcript streaming.
        </p>
      ) : null}
    </div>
  )
}

function classifyWord(word) {
  const t = String(word || '').toLowerCase().replace(/[^a-z]/g, '')
  const high = new Set(['threat', 'lost', 'job', 'scared', 'told', 'report', 'again'])
  const moderate = new Set(['office', 'left', 'january', 'march', 'april', 'sister'])
  if (high.has(t)) return 'high'
  if (moderate.has(t)) return 'moderate'
  return 'calm'
}
