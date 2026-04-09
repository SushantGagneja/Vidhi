const base = () => ''

async function j(url, opts = {}) {
  const r = await fetch(`${base()}${url}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(t || r.statusText)
  }
  const ct = r.headers.get('content-type') || ''
  if (ct.includes('application/json')) return r.json()
  return r
}

export async function ensureCase(caseId, counselorName) {
  return j('/api/cases', {
    method: 'POST',
    body: JSON.stringify({
      case_id: caseId,
      counselor_name: counselorName,
      survivor_name: 'Survivor',
      access_policy: 'legal-team',
    }),
  })
}

export async function getCase(caseId) {
  return j(`/api/cases/${encodeURIComponent(caseId)}`)
}

export async function appendTranscript(caseId, payload) {
  return j(`/api/cases/${encodeURIComponent(caseId)}/transcripts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateConsent(caseId, payload) {
  return j(`/api/cases/${encodeURIComponent(caseId)}/consent`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function updateTranscript(caseId, transcriptId, payload) {
  return j(`/api/cases/${encodeURIComponent(caseId)}/transcripts/${encodeURIComponent(transcriptId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function saveAnnotations(caseId, notes) {
  return j(`/api/cases/${encodeURIComponent(caseId)}/annotations`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  })
}

export async function loadDemo() {
  return j('/api/demo/load', { method: 'POST' })
}

export async function bayesianTimeline(caseId) {
  return j(`/api/bayesian-timeline?case_id=${encodeURIComponent(caseId)}`, {
    method: 'POST',
  })
}

export async function pitchTimeline(caseId) {
  return j(`/api/pitch-timeline?case_id=${encodeURIComponent(caseId)}`, {
    method: 'POST',
  })
}

export async function semanticEdges(caseId) {
  return j(`/api/semantic-edges?case_id=${encodeURIComponent(caseId)}`, {
    method: 'POST',
  })
}

export async function guidance(transcriptWindow) {
  return j('/api/gemini/guidance', {
    method: 'POST',
    body: JSON.stringify({ transcript_window: transcriptWindow }),
  })
}

export async function knowledgeGraph(caseId) {
  return j(`/api/gemini/knowledge-graph?case_id=${encodeURIComponent(caseId)}`, {
    method: 'POST',
  })
}

export async function bnsSuggest(caseId) {
  return j(`/api/bns/suggest?case_id=${encodeURIComponent(caseId)}`)
}

export async function verifyBns(caseId, sectionIds) {
  return j(`/api/cases/${encodeURIComponent(caseId)}/verify-bns`, {
    method: 'POST',
    body: JSON.stringify({ section_ids: sectionIds }),
  })
}

export async function fetchBrainMapping(payload) {
  return j('/api/brain-mapping', {
    method: 'POST',
    body: JSON.stringify({
      voice: payload.voice,
      words: payload.words,
      face: payload.face,
      possibility: payload.possibility,
      stress_points: payload.stress_points ?? [],
      n_timesteps: payload.n_timesteps ?? 15,
    }),
  })
}

export async function syntheticBrainMapping(spokenSample, nTimesteps = 15) {
  return j('/api/brain-mapping/synthetic', {
    method: 'POST',
    body: JSON.stringify({ spoken_sample: spokenSample || '', n_timesteps: nTimesteps }),
  })
}

export async function downloadPdf(caseId) {
  const r = await fetch(`${base()}/api/cases/${encodeURIComponent(caseId)}/pdf`, {
    method: 'POST',
  })
  if (!r.ok) throw new Error(await r.text())
  const blob = await r.blob()
  const fp = r.headers.get('X-Content-Fingerprint') || ''
  return { blob, fingerprint: fp }
}
