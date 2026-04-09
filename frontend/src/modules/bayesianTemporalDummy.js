const TEMPORAL_CUES = {
  early: ['first', 'initially', 'earlier', 'before', 'at first', 'started'],
  late: ['after', 'later', 'then', 'finally', 'eventually', 'in april', 'in may'],
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export const DUMMY_STORY_SEGMENTS = [
  {
    id: 'S1',
    text: 'In January I joined the packaging unit and worked the morning shift for the first few weeks.',
  },
  {
    id: 'S2',
    text: 'By February my supervisor started asking me to stay after everyone left, saying it was for extra checks.',
  },
  {
    id: 'S3',
    text: 'In March he locked the office door and threatened to cut my wages if I did not obey him.',
  },
  {
    id: 'S4',
    text: 'After that he sent repeated late-night messages and warned that nobody would believe me.',
  },
  {
    id: 'S5',
    text: 'In early April he grabbed my arm in the storeroom and said he could remove my name from payroll.',
  },
  {
    id: 'S6',
    text: 'Two days later I told my sister, and finally in May I met a counselor and decided to report the incidents.',
  },
]

function cueScore(text, list) {
  const t = text.toLowerCase()
  return list.reduce((acc, cue) => acc + (t.includes(cue) ? 1 : 0), 0)
}

function monthIndex(text) {
  const t = text.toLowerCase()
  for (let i = 0; i < MONTHS.length; i += 1) {
    if (t.includes(MONTHS[i])) return i
  }
  return -1
}

function bayesPosterior(prior, likelihoodRatio) {
  const odds = (prior / (1 - prior)) * likelihoodRatio
  return odds / (1 + odds)
}

function pairwiseBeforeProbability(a, b, ia, ib) {
  let lr = 1.0

  const aMonth = monthIndex(a.text)
  const bMonth = monthIndex(b.text)
  if (aMonth >= 0 && bMonth >= 0) {
    if (aMonth < bMonth) lr *= 5.4
    if (aMonth > bMonth) lr *= 0.19
  }

  const aEarly = cueScore(a.text, TEMPORAL_CUES.early)
  const aLate = cueScore(a.text, TEMPORAL_CUES.late)
  const bEarly = cueScore(b.text, TEMPORAL_CUES.early)
  const bLate = cueScore(b.text, TEMPORAL_CUES.late)

  lr *= 1 + 0.45 * aEarly
  lr *= 1 + 0.45 * bLate
  lr *= 1 / (1 + 0.4 * aLate)
  lr *= 1 / (1 + 0.4 * bEarly)

  if (ia < ib) lr *= 1.08
  if (ia > ib) lr *= 0.92

  const p = bayesPosterior(0.5, lr)
  return Math.max(0.02, Math.min(0.98, p))
}

export function computeBayesianTemporalInference(segments = DUMMY_STORY_SEGMENTS) {
  const n = segments.length
  if (!n) return { segments: [], pairwise: [], ordered: [] }

  const pairwise = Array.from({ length: n }, () => Array.from({ length: n }, () => 0.5))
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const p = pairwiseBeforeProbability(segments[i], segments[j], i, j)
      pairwise[i][j] = p
      pairwise[j][i] = 1 - p
    }
  }

  const raw = segments.map((seg, i) => {
    let score = 1
    for (let j = 0; j < n; j += 1) {
      if (j !== i) score *= pairwise[i][j]
    }
    return { ...seg, raw_score: score }
  })

  raw.sort((a, b) => b.raw_score - a.raw_score)
  const total = raw.reduce((acc, x) => acc + x.raw_score, 0) || 1
  const ordered = raw.map((x, idx) => ({
    ...x,
    rank: idx + 1,
    probability: x.raw_score / total,
  }))

  return { segments, pairwise, ordered }
}
