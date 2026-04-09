from typing import Any, Optional

from pydantic import BaseModel, Field


class CaseCreate(BaseModel):
    case_id: str = "DEMO-001"
    counselor_name: str = "Sunita Sharma"
    survivor_name: str = "Survivor"
    access_policy: str = "legal-team"


class TranscriptChunkIn(BaseModel):
    text: str
    chunk_index: Optional[int] = None
    stress_label: Optional[str] = None
    stress_score: Optional[float] = None
    signal_voice: Optional[float] = Field(None, ge=0.0, le=1.0)
    signal_words: Optional[float] = Field(None, ge=0.0, le=1.0)
    signal_face: Optional[float] = Field(None, ge=0.0, le=1.0)
    possibility: Optional[float] = Field(None, ge=0.0, le=1.0)
    source_session: Optional[str] = None
    source_mode: Optional[str] = None
    speaker_language: Optional[str] = None
    temporal_anchor: Optional[str] = None
    sensory_anchor: Optional[str] = None
    consent_visible: Optional[bool] = True
    lawyer_note: Optional[str] = None


class TranscriptUpdateIn(BaseModel):
    consent_visible: Optional[bool] = None
    lawyer_note: Optional[str] = None
    review_status: Optional[str] = None
    legal_flag: Optional[str] = None


class ConsentUpdateIn(BaseModel):
    access_policy: Optional[str] = None
    survivor_name: Optional[str] = None


class AnnotationBundleIn(BaseModel):
    notes: dict[str, str] = Field(default_factory=dict)


class GuidanceRequest(BaseModel):
    transcript_window: str
    case_id: Optional[str] = None


class VerifyBnsRequest(BaseModel):
    section_ids: list[str] = Field(default_factory=list)


class TribeProxyRequest(BaseModel):
    """Optional server-side audio features; MVP often sends score from client."""
    audio_base64: Optional[str] = None
    energy_score: Optional[float] = Field(None, ge=0.0, le=1.0)


class BrainMappingRequest(BaseModel):
    """Seed random brain panels from live modality scores."""

    voice: float = Field(0.35, ge=0.0, le=1.0)
    words: float = Field(0.45, ge=0.0, le=1.0)
    face: float = Field(0.35, ge=0.0, le=1.0)
    possibility: float = Field(0.45, ge=0.0, le=1.0)
    stress_points: list[float] = Field(default_factory=list)
    n_timesteps: int = Field(15, ge=5, le=30)


class SyntheticBrainRequest(BaseModel):
    spoken_sample: str = ""
    n_timesteps: int = Field(15, ge=5, le=30)
