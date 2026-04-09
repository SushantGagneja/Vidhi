"""
Vidhi evidentiary timeline builder.

Core idea:
- collect fragments non-linearly
- preserve uncertainty
- rank likely order with sensory anchors weighted above temporal anchors
"""
from __future__ import annotations

import hashlib
import re

SENSORY = re.compile(
    r"\b(smell|odor|rain|wet|dark|light|blue|red|cold|hot|sound|heard|saw|felt|touched|taste|blood|door|car|perfume|smoke)\b",
    re.I,
)
TEMPORAL = re.compile(
    r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|before|after|then|next|later|earlier|night|morning|evening|january|february|march|april|may|june|july|august|september|october|november|december)\b",
    re.I,
)
UNCERTAINTY = re.compile(
    r"\b(maybe|perhaps|i think|not sure|unsure|might|possibly|i guess)\b",
    re.I,
)

SENSORY_WEIGHT = 0.46
VOICE_WEIGHT = 0.22
LANGUAGE_WEIGHT = 0.18
TEMPORAL_WEIGHT = 0.14


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _text_score(text: str) -> tuple[float, float, float]:
    text = (text or "").strip()
    sensory_hits = len(SENSORY.findall(text))
    temporal_hits = len(TEMPORAL.findall(text))
    uncertainty_hits = len(UNCERTAINTY.findall(text))

    sensory_score = clamp01(0.32 + 0.12 * min(sensory_hits, 4))
    temporal_score = clamp01(0.28 + 0.1 * min(temporal_hits, 3) - 0.05 * min(uncertainty_hits, 3))
    language_score = clamp01(0.46 + 0.06 * min(len(text) / 120.0, 2.0) - 0.05 * min(uncertainty_hits, 3))
    return sensory_score, temporal_score, language_score


def _extract_anchor(text: str, pattern: re.Pattern[str], fallback: str) -> str:
    match = pattern.search(text or "")
    if match:
        return match.group(0)
    return fallback


def _confidence_band(score: float) -> str:
    if score >= 0.75:
        return "high"
    if score >= 0.6:
        return "review"
    return "low"


def _reasoning_trace(sensory: float, temporal: float, voice: float, language: float) -> str:
    strongest = max(
        [
            ("sensory anchor", sensory),
            ("speech continuity", voice),
            ("language stability", language),
            ("temporal cue", temporal),
        ],
        key=lambda item: item[1],
    )[0]
    weakest = min(
        [
            ("sensory anchor", sensory),
            ("speech continuity", voice),
            ("language stability", language),
            ("temporal cue", temporal),
        ],
        key=lambda item: item[1],
    )[0]
    return f"Weighted strongest on {strongest}; weakest signal came from {weakest}."


def build_pitch_timeline(rows: list) -> dict:
    if not rows:
        return {
            "formula": "confidence = 0.46*sensory + 0.22*voice + 0.18*language + 0.14*temporal",
            "events": [],
            "reconstructed_timeline": [],
            "cross_exam_targets": [],
            "distress_peaks": [],
        }

    events = []
    distress_peaks = []
    contradiction_buckets: dict[str, list[dict]] = {}

    for idx, row in enumerate(rows, start=1):
        if getattr(row, "consent_visible", True) is False:
            continue

        text = row.text or ""
        sensory_score, temporal_score, language_score = _text_score(text)
        voice_score = clamp01(getattr(row, "signal_voice", None) or getattr(row, "stress_score", None) or 0.38)
        face_score = clamp01(getattr(row, "signal_face", None) or 0.3)

        sensory_anchor = getattr(row, "sensory_anchor", None) or _extract_anchor(text, SENSORY, "none recorded")
        temporal_anchor = getattr(row, "temporal_anchor", None) or _extract_anchor(text, TEMPORAL, "uncertain timing")
        distress_score = round(clamp01(0.65 * voice_score + 0.35 * face_score), 3)
        confidence_score = round(
            clamp01(
                SENSORY_WEIGHT * sensory_score
                + VOICE_WEIGHT * (1 - distress_score * 0.35)
                + LANGUAGE_WEIGHT * language_score
                + TEMPORAL_WEIGHT * temporal_score
            ),
            3,
        )

        fragment_hash = getattr(row, "fragment_hash", None) or hashlib.sha256(
            f"{getattr(row, 'case_id', '')}:{getattr(row, 'chunk_index', idx)}:{text}".encode("utf-8")
        ).hexdigest()

        contradiction_key = sensory_anchor if sensory_anchor != "none recorded" else temporal_anchor
        contradiction_buckets.setdefault(contradiction_key, []).append(
            {
                "event_id": f"F{idx}",
                "text": text,
                "confidence_score": confidence_score,
                "temporal_anchor": temporal_anchor,
                "sensory_anchor": sensory_anchor,
            }
        )

        legal_flag = "prepare challenge response" if confidence_score < 0.6 else "stable core fact"
        event = {
            "id": f"F{idx}",
            "chunk_index": getattr(row, "chunk_index", idx - 1),
            "summary": text[:280] + ("…" if len(text) > 280 else ""),
            "fragment_hash": fragment_hash,
            "source_session": getattr(row, "source_session", None) or "session-1",
            "source_mode": getattr(row, "source_mode", None) or "voice",
            "speaker_language": getattr(row, "speaker_language", None) or "en-IN",
            "sensory_anchor": sensory_anchor,
            "temporal_anchor": temporal_anchor,
            "voice": round(voice_score, 3),
            "words": round(language_score, 3),
            "facial": round(face_score, 3),
            "voice_score": round(voice_score, 3),
            "distress_score": distress_score,
            "confidence_score": confidence_score,
            "possibility": confidence_score,
            "confidence_band": _confidence_band(confidence_score),
            "sensory_weight": round(sensory_score, 3),
            "legal_flag": getattr(row, "legal_flag", None) or legal_flag,
            "lawyer_note": getattr(row, "lawyer_note", None) or "",
            "review_status": getattr(row, "review_status", None) or ("flagged" if confidence_score < 0.6 else "active"),
            "reasoning_trace": _reasoning_trace(sensory_score, temporal_score, voice_score, language_score),
            "contradiction_note": getattr(row, "contradiction_note", None) or "",
        }
        events.append(event)

        if distress_score >= 0.62:
            distress_peaks.append(
                {
                    "event_id": event["id"],
                    "summary": event["summary"],
                    "distress_score": distress_score,
                    "marker": "Pause or switch modality",
                }
            )

    events.sort(key=lambda item: (-item["confidence_score"], item["chunk_index"]))

    reconstructed = []
    for rank, ev in enumerate(events, start=1):
        reconstructed.append(
            {
                "rank": rank,
                "event_id": ev["id"],
                "summary": ev["summary"],
                "confidence_score": ev["confidence_score"],
                "possibility": ev["confidence_score"],
                "confidence_band": ev["confidence_band"],
                "reasoning_trace": ev["reasoning_trace"],
                "sensory_anchor": ev["sensory_anchor"],
                "temporal_anchor": ev["temporal_anchor"],
            }
        )

    cross_exam_targets = []
    for ev in sorted(events, key=lambda item: (item["confidence_score"], -item["distress_score"]))[:3]:
        cross_exam_targets.append(
            {
                "event_id": ev["id"],
                "summary": ev["summary"],
                "attack_surface": ev["legal_flag"],
                "confidence_score": ev["confidence_score"],
                "distress_score": ev["distress_score"],
                "recommended_prep": "Support with trauma expert and corroborating fragment trail.",
            }
        )

    contradiction_explanations = []
    for anchor, bucket in contradiction_buckets.items():
        temporal_values = {item["temporal_anchor"] for item in bucket if item["temporal_anchor"] != "uncertain timing"}
        if len(bucket) > 1 and len(temporal_values) > 1:
            bucket_sorted = sorted(bucket, key=lambda item: item["confidence_score"], reverse=True)
            winner = bucket_sorted[0]
            contradiction_explanations.append(
                {
                    "anchor": anchor,
                    "explanation": (
                        f"Fragments disagree on timing around '{anchor}'. "
                        f"{winner['event_id']} ranked highest because its sensory anchor remained stable."
                    ),
                    "winner_event_id": winner["event_id"],
                }
            )

    return {
        "formula": "confidence = 0.46*sensory + 0.22*voice + 0.18*language + 0.14*temporal",
        "weights": {
            "sensory": SENSORY_WEIGHT,
            "voice": VOICE_WEIGHT,
            "language": LANGUAGE_WEIGHT,
            "temporal": TEMPORAL_WEIGHT,
        },
        "events": events,
        "reconstructed_timeline": reconstructed,
        "cross_exam_targets": cross_exam_targets,
        "distress_peaks": sorted(distress_peaks, key=lambda item: item["distress_score"], reverse=True)[:4],
        "contradiction_explanations": contradiction_explanations,
    }
