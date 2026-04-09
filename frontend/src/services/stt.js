/**
 * Browser Web Speech API — live captions (Chrome / Edge best).
 */
export function isSpeechSupported() {
  return typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function createSpeechCaptions({ lang = 'en-IN', onFinal, onInterim } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return { start: () => {}, stop: () => {}, abort: () => {} }

  const rec = new SR()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = lang

  rec.onresult = (ev) => {
    let interim = ''
    let final = ''
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i]
      const t = r[0]?.transcript || ''
      if (r.isFinal) final += t
      else interim += t
    }
    if (interim) onInterim?.(interim)
    if (final.trim()) onFinal?.(final.trim())
  }

  rec.onerror = () => {
    /* noisy in dev */
  }

  return {
    start: () => {
      try {
        rec.start()
      } catch {
        /* already started */
      }
    },
    stop: () => {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    },
    abort: () => {
      try {
        rec.abort()
      } catch {
        /* ignore */
      }
    },
  }
}
