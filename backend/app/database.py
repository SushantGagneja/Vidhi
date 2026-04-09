import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./vidhi.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sqlite_add_columns():
    if not str(engine.url).startswith("sqlite"):
        return
    from sqlalchemy import text

    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(transcripts)")).fetchall()
        names = {r[1] for r in rows}
        alters = [
            ("signal_voice", "FLOAT"),
            ("signal_words", "FLOAT"),
            ("signal_face", "FLOAT"),
            ("possibility", "FLOAT"),
            ("fragment_hash", "TEXT"),
            ("source_session", "TEXT"),
            ("source_mode", "TEXT"),
            ("speaker_language", "TEXT"),
            ("temporal_anchor", "TEXT"),
            ("sensory_anchor", "TEXT"),
            ("confidence_score", "FLOAT"),
            ("sensory_weight", "FLOAT"),
            ("legal_flag", "TEXT"),
            ("review_status", "TEXT"),
            ("contradiction_note", "TEXT"),
            ("lawyer_note", "TEXT"),
            ("consent_visible", "BOOLEAN DEFAULT 1"),
        ]
        for col, typ in alters:
            if col not in names:
                conn.execute(text(f"ALTER TABLE transcripts ADD COLUMN {col} {typ}"))

        case_rows = conn.execute(text("PRAGMA table_info(cases)")).fetchall()
        case_names = {r[1] for r in case_rows}
        case_alters = [
            ("survivor_name", "TEXT DEFAULT 'Survivor'"),
            ("access_policy", "TEXT DEFAULT 'legal-team'"),
            ("case_summary", "TEXT DEFAULT ''"),
        ]
        for col, typ in case_alters:
            if col not in case_names:
                conn.execute(text(f"ALTER TABLE cases ADD COLUMN {col} {typ}"))


def init_db():
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _sqlite_add_columns()
