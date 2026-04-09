"""
Synthetic trauma narrative + optional Tribe v2 projection hooks.

This module builds a realistic sample testimony, derives deterministic proxy
modality scores from text, and prepares optional audio bytes for future Tribe
audio ingestion.
"""
from __future__ import annotations

import io
import math
import struct
import wave
from dataclasses import dataclass

from services.pitch_timeline import words_score_from_text


def synthetic_trauma_description(spoken_sample: str = "") -> str:
    seed = (spoken_sample or "").strip()
    prefix = (
        f"Counselor note from speaking sample: {seed}. " if seed else ""
    )
    return (
        prefix
        + "I started working at a garment unit near Sector 17 in January. "
        + "For the first month everything seemed normal, but then my supervisor began asking me to stay late after other workers left. "
        + "In March he locked the office door and stood too close while threatening to cut my wages if I refused to obey him. "
        + "After that he kept sending messages at night saying nobody would believe me and that my family would be blamed if I complained. "
        + "I stopped sleeping properly, avoided the factory floor, and began having panic when I heard his footsteps near the storeroom. "
        + "In April he grabbed my arm in the packing room and said he could make me disappear from the payroll in one day. "
        + "I told my sister two days later, and with support from my counselor I came to report everything because I am afraid it will continue with other women if I stay silent."
    )


def synthesize_wave_from_text(text: str, sample_rate: int = 16000) -> bytes:
    """
    Lightweight deterministic waveform so backend can expose a playable
    speaking sample without requiring TTS system packages.
    """
    duration = max(4.0, min(18.0, len(text) / 34.0))
    n = int(sample_rate * duration)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        for i in range(n):
            t = i / sample_rate
            base = math.sin(2 * math.pi * 170 * t)
            vib = math.sin(2 * math.pi * 4.1 * t)
            tone = 0.42 * base + 0.19 * math.sin(2 * math.pi * (220 + 26 * vib) * t)
            env = min(1.0, i / (sample_rate * 0.22)) * min(1.0, (n - i) / (sample_rate * 0.35))
            sample = max(-1.0, min(1.0, tone * env))
            wav.writeframes(struct.pack("<h", int(sample * 32767)))
    return buf.getvalue()


@dataclass
class TribeProjection:
    voice: float
    words: float
    face: float
    possibility: float
    stress_points: list[float]
    method: str


def project_modalities_from_text(description: str) -> TribeProjection:
    words = max(0.0, min(1.0, float(words_score_from_text(description))))
    severe_terms = [
        "locked",
        "threat",
        "fear",
        "panic",
        "grabbed",
        "complained",
        "silent",
    ]
    n_hits = sum(1 for w in severe_terms if w in description.lower())
    voice = max(0.0, min(1.0, 0.52 + 0.055 * n_hits))
    face = max(0.0, min(1.0, 0.46 + 0.035 * n_hits))
    possibility = max(0.0, min(1.0, 0.54 * voice + 0.32 * words + 0.14 * face))
    stress_points = [
        round(max(0.0, min(1.0, possibility - 0.14 + i * 0.022)), 4)
        for i in range(15)
    ]
    return TribeProjection(
        voice=round(voice, 4),
        words=round(words, 4),
        face=round(face, 4),
        possibility=round(possibility, 4),
        stress_points=stress_points,
        method="text_proxy",
    )


def tribe_notes() -> str:
    return (
        "For full Tribe v2 audio inference, install tribev2 and use:\n"
        "from tribev2.demo_utils import TribeModel, download_file\n"
        "from tribev2.plotting import PlotBrain\n"
        "from pathlib import Path\n"
        "CACHE_FOLDER = Path('./cache')\n"
        "model = TribeModel.from_pretrained('facebook/tribev2', cache_folder=CACHE_FOLDER)\n"
        "plotter = PlotBrain(mesh='fsaverage5')"
    )
