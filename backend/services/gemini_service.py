"""Gemini: counselor guidance, knowledge graph extraction, structured testimony for PDF."""
import json
import os
import re

import google.generativeai as genai


def _model():
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    genai.configure(api_key=key)
    return genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.0-flash"))


def _strip_json(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text


def counselor_guidance(transcript_window: str) -> str:
    m = _model()
    if not m:
        return (
            "Set GEMINI_API_KEY for live guidance. "
            "Suggest: offer pause, validate feelings, avoid 'why did you stay' framing."
        )
    prompt = f"""You are assisting an Indian trauma-informed counselor (Vidhi). The AI never speaks to the survivor.
In 2-4 short bullet points, suggest what the counselor might do in the next moments based ONLY on this recent transcript fragment.
Use a calm, professional tone. No clinical diagnosis.

RECENT TRANSCRIPT:
\"\"\"{transcript_window[:6000]}\"\"\"
"""
    r = m.generate_content(prompt)
    return (r.text or "").strip()


def extract_knowledge_graph(transcript: str) -> dict:
    m = _model()
    if not m:
        return _fallback_kg(transcript)
    prompt = f"""From this testimony, extract a small knowledge graph for legal/counseling structuring.
Return JSON ONLY with this shape:
{{"nodes":[{{"id":"string","label":"string","type":"person|location|organization|date"}}],"edges":[{{"source":"id","target":"id","relationship":"short verb phrase"}}]}}
Use anonymous labels for accused if names unknown (e.g. "Accused person 1"). Max 12 nodes, 16 edges.

TRANSCRIPT:
\"\"\"{transcript[:10000]}\"\"\"
"""
    r = m.generate_content(prompt)
    try:
        return json.loads(_strip_json(r.text or "{}"))
    except json.JSONDecodeError:
        return _fallback_kg(transcript)


def _fallback_kg(transcript: str) -> dict:
    return {
        "nodes": [
            {"id": "n1", "label": "Survivor", "type": "person"},
            {"id": "n2", "label": "Workplace", "type": "location"},
            {"id": "n3", "label": "Incident period", "type": "date"},
        ],
        "edges": [
            {"source": "n1", "target": "n2", "relationship": "associated with"},
        ],
    }


def structured_testimony_for_pdf(transcript: str, timeline_events: list | None) -> str:
    m = _model()
    tl = ""
    if timeline_events:
        tl = "\n".join(
            f"- {e.get('event_id')}: {e.get('event_text', '')[:200]} (certainty {e.get('bayesian_certainty', 'n/a')})"
            for e in timeline_events[:20]
        )
    if not m:
        return f"Structured summary (offline):\n\n{transcript[:2000]}\n\nTimeline hints:\n{tl}"

    prompt = f"""Convert the survivor testimony below into a neutral, court-oriented structured summary for a lawyer draft.
Use sections: Facts (chronological where possible), Key actors, Locations, Requests for investigation.
Do not add facts not in the text. Mark uncertainty explicitly.
If Bayesian timeline hints are provided, integrate them as "AI-suggested order — subject to legal review".

TESTIMONY:
\"\"\"{transcript[:12000]}\"\"\"

BAYESIAN TIMELINE HINTS:
{tl}
"""
    r = m.generate_content(prompt)
    return (r.text or "").strip()
