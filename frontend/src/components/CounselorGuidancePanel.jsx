import { useEffect, useRef, useState } from 'react'
import * as api from '../api.js'

export default function CounselorGuidancePanel({ captionWords, stressState, micOn }) {
  const [guidance, setGuidance] = useState('System initializing. Ready to analyze transcript patterns and stress indicators.')
  const [loading, setLoading] = useState(false)
  const lastFetchedLength = useRef(0)
  
  // High Distress override logic
  useEffect(() => {
    if (stressState.label === 'HIGH DISTRESS') {
      setGuidance(
        '[CRITICAL] Elevated stress detected.\n\n' +
        '-> PAUSE factual questioning immediately.\n' +
        '-> Employ 5-4-3-2-1 Grounding Method.\n' +
        '-> "You are safe here. Let\'s take a slow breath. Can you name 5 things you can see in this room right now?"'
      )
    }
  }, [stressState.label])

  useEffect(() => {
    if (!micOn) return undefined

    const id = setInterval(async () => {
      // Don't poll aggressively if very few new words
      if (captionWords.length - lastFetchedLength.current < 20) return
      
      // Don't override high distress manually until they stabilize, although periodic updates might be okay.
      if (stressState.label === 'HIGH DISTRESS') return

      lastFetchedLength.current = captionWords.length
      
      // Get the last ~100 words for context, but mapped back to string
      const contextWindow = captionWords
        .slice(-100)
        .map(w => w.word)
        .join(' ')

      if (!contextWindow.trim()) return

      try {
        setLoading(true)
        const res = await api.guidance(contextWindow)
        if (res?.guidance) {
          setGuidance(res.guidance)
        }
      } catch (err) {
        console.error('Failed to parse counselor guidance', err)
      } finally {
        setLoading(false)
      }
    }, 15000) // Poll every 15 seconds while active

    return () => clearInterval(id)
  }, [captionWords, micOn, stressState.label])

  const isWarning = stressState.label === 'HIGH DISTRESS'

  return (
    <div
      className="panel scanlines"
      style={{
        padding: 12,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        border: isWarning ? '1px solid #ff4444' : '1px solid var(--border)',
        boxShadow: isWarning ? '0 0 10px rgba(255, 68, 68, 0.2)' : 'none',
        transition: 'all 0.5s ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="status-dot"
            style={{ background: isWarning ? '#ff4444' : (loading ? 'var(--accent)' : '#ffffff') }}
          />
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: isWarning ? '#ff4444' : 'var(--accent)'
            }}
          >
            AI COUNSELOR COPILOT
          </span>
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
          background: isWarning ? 'rgba(255, 68, 68, 0.05)' : 'rgba(255, 255, 255, 0.02)',
          color: isWarning ? '#ffcccc' : '#dce7e2',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11
        }}
      >
        {guidance}
      </div>
      
      {loading && !isWarning && (
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--dim)', fontFamily: 'JetBrains Mono, monospace' }}>
          * Analyzing trauma fragments...
        </div>
      )}
    </div>
  )
}
