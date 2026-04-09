/** Pitch formula: P = 0.54·V + 0.32·W + 0.14·F */
const WV = 0.54
const WW = 0.32
const WF = 0.14

export function possibility(voice, words, face) {
  const c = (x) => Math.max(0, Math.min(1, x))
  return c(WV * c(voice) + WW * c(words) + WF * c(face))
}

export function wordsHeuristic(text) {
  const t = (text || '').toLowerCase()
  if (!t.trim()) return 0.45
  const hedge = /\b(maybe|perhaps|i think|i guess|not sure|shayad|lagta)\b/g
  const assert = /\b(always|never|definitely|forced|locked|threat|rape|hit)\b/g
  const temporal = /\b(then|after|before|next|january|march|phir|pehle|baad)\b/g
  const h = (t.match(hedge) || []).length
  const a = (t.match(assert) || []).length
  const tl = temporal.test(t) ? 1 : 0
  let raw = 0.42 + 0.08 * Math.min(a, 4) - 0.06 * Math.min(h, 4) + 0.05 * tl
  raw += 0.04 * Math.min(t.length / 200, 1)
  return Math.max(0, Math.min(1, raw))
}

export const FORMULA_LABEL = `P = ${WV}·voice + ${WW}·words + ${WF}·facial`

/** Counselor-facing stress band from audio + face proxies (not clinical). */
export function stressLabel(voice, face) {
  const fused = 0.6 * Math.max(0, Math.min(1, voice)) + 0.4 * Math.max(0, Math.min(1, face))
  if (fused < 0.15) return 'Withdrawn'
  if (fused < 0.35) return 'Calm'
  if (fused < 0.65) return 'Moderate'
  return 'High Distress'
}
