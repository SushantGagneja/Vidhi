"""
Bayesian Temporal Inference — reconstructs chronological order from non-linear testimony.
See VIDHI_ADVANCED_ARCHITECTURE.md Feature 1.
"""
import json
import os
import re

import google.generativeai as genai

TEMPORAL_CUE_WORDS = [
    "after", "before", "then", "next", "following", "later",
    "previously", "earlier", "finally", "eventually", "meanwhile",
    "phir", "pehle", "baad mein", "uske baad",
    "phir toh", "pehlan", "baad",
]


def _configure_genai():
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    genai.configure(api_key=key)
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    return genai.GenerativeModel(model_name)


def _parse_json_array(text: str) -> list:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def extract_events_with_cues(transcript: str) -> list:
    model = _configure_genai()
    if not model:
        return _fallback_events(transcript)

    prompt = f"""
Extract discrete events from this testimony and identify temporal cue phrases.
A cue phrase is any word/phrase that hints at sequence ("after", "then", "next morning", etc.)

TRANSCRIPT:
\"\"\"{transcript[:12000]}\"\"\"

Return JSON array only:
[
  {{
    "event_id": "E1",
    "event_text": "concise description",
    "cue_phrases": ["list of temporal cues found near this event"],
    "calendar_ref": "any date/day/month mentioned or null",
    "logical_constraints": ["this must happen AFTER: ...", "this must happen BEFORE: ..."]
  }}
]
"""
    resp = model.generate_content(prompt)
    raw = (resp.text or "").strip()
    try:
        return _parse_json_array(raw)
    except (json.JSONDecodeError, ValueError):
        return _fallback_events(transcript)


def _fallback_events(transcript: str) -> list:
    sentences = [s.strip() for s in re.split(r"[.!?।]\s+", transcript) if len(s.strip()) > 20]
    out = []
    for i, s in enumerate(sentences[:12]):
        cues = [w for w in TEMPORAL_CUE_WORDS if w in s.lower()]
        out.append({
            "event_id": f"E{i+1}",
            "event_text": s[:200],
            "cue_phrases": cues or ["narrative fragment"],
            "calendar_ref": None,
            "logical_constraints": [],
        })
    return out if out else [{
        "event_id": "E1",
        "event_text": transcript[:300],
        "cue_phrases": [],
        "calendar_ref": None,
        "logical_constraints": [],
    }]


def compute_bayesian_order(events: list) -> list:
    n = len(events)
    if n == 0:
        return []
    order_matrix = [[0.5] * n for _ in range(n)]

    months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

    for i in range(n):
        for j in range(i + 1, n):
            score = 0.5
            Ei = events[i]
            Ej = events[j]
            cri, crj = Ei.get("calendar_ref") or "", Ej.get("calendar_ref") or ""
            if cri and crj:
                mi = next((k for k, m in enumerate(months) if m in str(cri).lower()), None)
                mj = next((k for k, m in enumerate(months) if m in str(crj).lower()), None)
                if mi is not None and mj is not None:
                    if mi < mj:
                        score = 0.92
                    elif mi > mj:
                        score = 0.08
                    else:
                        score = 0.5

            for constraint in Ei.get("logical_constraints") or []:
                c = str(constraint)
                if "AFTER" in c.upper() and str(Ej.get("event_id", "")) in c:
                    score = max(score, 0.85)
                if "BEFORE" in c.upper() and str(Ej.get("event_id", "")) in c:
                    score = min(score, 0.15)

            order_matrix[i][j] = score
            order_matrix[j][i] = 1.0 - score

    marginals = []
    for i in range(n):
        prob = 1.0
        for j in range(n):
            if i != j:
                prob *= order_matrix[i][j]
        marginals.append((prob, i))

    marginals.sort(reverse=True)
    ordered = [events[idx] for _, idx in marginals]
    total = sum(p for p, _ in marginals) or 1.0
    for (prob, idx), ev in zip(marginals, ordered):
        ev["bayesian_certainty"] = round(prob / total, 3)
    return ordered


def reconstruct_timeline(transcript: str) -> list:
    events = extract_events_with_cues(transcript)
    return compute_bayesian_order(events)
