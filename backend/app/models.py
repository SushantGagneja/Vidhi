from sqlalchemy import Boolean, Column, Float, Integer, String, Text, ForeignKey

from app.database import Base


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String(64), unique=True, nullable=False, index=True)
    counselor_name = Column(String(256), default="Sunita Sharma")
    pdf_hash = Column(String(128), nullable=True)
    verified_bns = Column(Text, default="[]")  # JSON array of section ids
    survivor_name = Column(String(256), default="Survivor")
    access_policy = Column(String(64), default="legal-team")
    case_summary = Column(Text, default="")


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String(64), ForeignKey("cases.case_id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    stress_label = Column(String(64), nullable=True)
    stress_score = Column(Float, nullable=True)
    signal_voice = Column(Float, nullable=True)
    signal_words = Column(Float, nullable=True)
    signal_face = Column(Float, nullable=True)
    possibility = Column(Float, nullable=True)
    fragment_hash = Column(String(128), nullable=True)
    source_session = Column(String(64), nullable=True)
    source_mode = Column(String(32), nullable=True)
    speaker_language = Column(String(32), nullable=True)
    temporal_anchor = Column(String(256), nullable=True)
    sensory_anchor = Column(String(256), nullable=True)
    confidence_score = Column(Float, nullable=True)
    sensory_weight = Column(Float, nullable=True)
    legal_flag = Column(String(64), nullable=True)
    review_status = Column(String(64), default="active")
    contradiction_note = Column(Text, nullable=True)
    lawyer_note = Column(Text, nullable=True)
    consent_visible = Column(Boolean, default=True)
