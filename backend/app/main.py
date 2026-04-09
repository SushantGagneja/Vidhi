import base64
import hashlib
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

load_dotenv()

from app.database import get_db, init_db
from app.models import Case, Transcript
from app.schemas import (
    AnnotationBundleIn,
    BrainMappingRequest,
    CaseCreate,
    ConsentUpdateIn,
    GuidanceRequest,
    SyntheticBrainRequest,
    TranscriptChunkIn,
    TranscriptUpdateIn,
    VerifyBnsRequest,
)

from services.brain_mapping_plotter import plot_brain_mapping_figure
from services.bayesian_timeline import reconstruct_timeline
from services.bns_faiss import search_bns
from services.gemini_service import (
    counselor_guidance,
    extract_knowledge_graph,
    structured_testimony_for_pdf,
)
from services.pdf_export import build_pdf_bytes
from services.pitch_timeline import build_pitch_timeline
from services.semantic_edges import compute_semantic_edges
from services.tribe_synthetic import (
    project_modalities_from_text,
    synthesize_wave_from_text,
    synthetic_trauma_description,
    tribe_notes,
)


def _ordered_rows(db: Session, case_id: str):
    return (
        db.query(Transcript)
        .filter(Transcript.case_id == case_id)
        .order_by(Transcript.chunk_index)
        .all()
    )


def _case_or_404(db: Session, case_id: str):
    case = db.query(Case).filter(Case.case_id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    return case


def _compute_fragment_hash(case_id: str, idx: int, text: str) -> str:
    return hashlib.sha256(f"{case_id}:{idx}:{text}".encode("utf-8")).hexdigest()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Vidhi API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/brain-mapping", tags=["Analysis"])
def brain_mapping(body: BrainMappingRequest):
    """
    Matplotlib figure: 4 brain heatmaps + 15-segment stimulus bar (fire cmap, p99 norm).
    Random fields seeded from voice/words/face/P and optional stress trace.
    """
    png, meta = plot_brain_mapping_figure(
        body.voice,
        body.words,
        body.face,
        body.possibility,
        body.stress_points or None,
        n_timesteps=body.n_timesteps,
        norm_percentile=99,
        vmin=0.6,
        alpha_cmap=(0.0, 0.2),
        show_stimuli=True,
    )
    return {
        "image_b64": base64.b64encode(png).decode("ascii"),
        "meta": meta,
    }


@app.post("/api/brain-mapping/synthetic", tags=["Analysis"])
def synthetic_brain_mapping(body: SyntheticBrainRequest):
    """
    Build a realistic synthetic testimony paragraph, convert it to a simple
    playable waveform, derive proxy modality scores, and return a 2x2 brain map.
    """
    description = synthetic_trauma_description(body.spoken_sample or "")
    projection = project_modalities_from_text(description)
    wav = synthesize_wave_from_text(description)
    png, meta = plot_brain_mapping_figure(
        projection.voice,
        projection.words,
        projection.face,
        projection.possibility,
        projection.stress_points,
        n_timesteps=body.n_timesteps,
        norm_percentile=99,
        vmin=0.6,
        alpha_cmap=(0.0, 0.2),
        show_stimuli=True,
    )

    variants = [
        (projection.voice, projection.words, projection.face, projection.possibility),
        (min(1.0, projection.voice + 0.08), projection.words, projection.face, min(1.0, projection.possibility + 0.04)),
        (projection.voice, min(1.0, projection.words + 0.08), projection.face, min(1.0, projection.possibility + 0.04)),
        (projection.voice, projection.words, min(1.0, projection.face + 0.08), min(1.0, projection.possibility + 0.04)),
    ]
    grid = []
    for v, w, f, p in variants:
        panel_png, _ = plot_brain_mapping_figure(
            v,
            w,
            f,
            p,
            projection.stress_points,
            n_timesteps=body.n_timesteps,
            norm_percentile=99,
            vmin=0.6,
            alpha_cmap=(0.0, 0.2),
            show_stimuli=False,
        )
        grid.append(base64.b64encode(panel_png).decode("ascii"))

    return {
        "description": description,
        "audio_wav_b64": base64.b64encode(wav).decode("ascii"),
        "brain_image_b64": base64.b64encode(png).decode("ascii"),
        "brain_grid_b64": grid,
        "modalities": {
            "voice": projection.voice,
            "words": projection.words,
            "face": projection.face,
            "possibility": projection.possibility,
            "stress_points": projection.stress_points,
            "method": projection.method,
        },
        "meta": {
            **meta,
            "layout": "2x2",
            "tribe_mode": projection.method,
            "tribe_usage_notes": tribe_notes(),
        },
    }


@app.post("/api/cases", tags=["Cases"])
def create_case(body: CaseCreate, db: Session = Depends(get_db)):
    existing = db.query(Case).filter(Case.case_id == body.case_id).first()
    if existing:
        existing.survivor_name = body.survivor_name or existing.survivor_name
        existing.access_policy = body.access_policy or existing.access_policy
        db.commit()
        return {
            "case_id": existing.case_id,
            "counselor_name": existing.counselor_name,
            "survivor_name": existing.survivor_name,
            "access_policy": existing.access_policy,
        }
    c = Case(
        case_id=body.case_id,
        counselor_name=body.counselor_name,
        survivor_name=body.survivor_name,
        access_policy=body.access_policy,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {
        "case_id": c.case_id,
        "counselor_name": c.counselor_name,
        "survivor_name": c.survivor_name,
        "access_policy": c.access_policy,
    }


@app.get("/api/cases/{case_id}", tags=["Cases"])
def get_case(case_id: str, db: Session = Depends(get_db)):
    c = _case_or_404(db, case_id)
    rows = _ordered_rows(db, case_id)
    pitch = build_pitch_timeline(rows)
    return {
        "case_id": c.case_id,
        "counselor_name": c.counselor_name,
        "survivor_name": c.survivor_name,
        "access_policy": c.access_policy,
        "case_summary": c.case_summary,
        "pdf_hash": c.pdf_hash,
        "verified_bns": json.loads(c.verified_bns or "[]"),
        "dashboard": {
            "timeline": pitch.get("reconstructed_timeline", []),
            "cross_exam_targets": pitch.get("cross_exam_targets", []),
            "distress_peaks": pitch.get("distress_peaks", []),
            "contradiction_explanations": pitch.get("contradiction_explanations", []),
        },
        "transcripts": [
            {
                "id": t.id,
                "chunk_index": t.chunk_index,
                "text": t.text,
                "stress_label": t.stress_label,
                "stress_score": t.stress_score,
                "signal_voice": t.signal_voice,
                "signal_words": t.signal_words,
                "signal_face": t.signal_face,
                "possibility": t.possibility,
                "fragment_hash": t.fragment_hash,
                "source_session": t.source_session,
                "source_mode": t.source_mode,
                "speaker_language": t.speaker_language,
                "temporal_anchor": t.temporal_anchor,
                "sensory_anchor": t.sensory_anchor,
                "confidence_score": t.confidence_score,
                "sensory_weight": t.sensory_weight,
                "legal_flag": t.legal_flag,
                "review_status": t.review_status,
                "contradiction_note": t.contradiction_note,
                "lawyer_note": t.lawyer_note,
                "consent_visible": t.consent_visible,
            }
            for t in rows
        ],
    }


@app.post("/api/cases/{case_id}/transcripts", tags=["Cases"])
def append_transcript(case_id: str, body: TranscriptChunkIn, db: Session = Depends(get_db)):
    c = _case_or_404(db, case_id)
    max_idx = db.query(func.max(Transcript.chunk_index)).filter(Transcript.case_id == case_id).scalar()
    next_idx = (max_idx + 1) if max_idx is not None else 0
    idx = body.chunk_index if body.chunk_index is not None else next_idx
    fragment_hash = _compute_fragment_hash(case_id, idx, body.text)
    t = Transcript(
        case_id=case_id,
        chunk_index=idx,
        text=body.text,
        stress_label=body.stress_label,
        stress_score=body.stress_score,
        signal_voice=body.signal_voice,
        signal_words=body.signal_words,
        signal_face=body.signal_face,
        possibility=body.possibility,
        fragment_hash=fragment_hash,
        source_session=body.source_session or "session-1",
        source_mode=body.source_mode or "voice",
        speaker_language=body.speaker_language or "en-IN",
        temporal_anchor=body.temporal_anchor,
        sensory_anchor=body.sensory_anchor,
        consent_visible=True if body.consent_visible is None else body.consent_visible,
        lawyer_note=body.lawyer_note,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    pitch = build_pitch_timeline(_ordered_rows(db, case_id))
    ranked = next((item for item in pitch.get("events", []) if item["chunk_index"] == idx), None)
    if ranked:
        t.confidence_score = ranked.get("confidence_score")
        t.sensory_weight = ranked.get("sensory_weight")
        t.legal_flag = ranked.get("legal_flag")
        t.review_status = ranked.get("review_status")
        t.contradiction_note = ranked.get("contradiction_note")
        db.commit()
    return {"ok": True, "id": t.id, "chunk_index": t.chunk_index, "fragment_hash": fragment_hash}


@app.patch("/api/cases/{case_id}/consent", tags=["Cases"])
def update_consent(case_id: str, body: ConsentUpdateIn, db: Session = Depends(get_db)):
    case = _case_or_404(db, case_id)
    if body.access_policy is not None:
        case.access_policy = body.access_policy
    if body.survivor_name is not None:
        case.survivor_name = body.survivor_name
    db.commit()
    return {"ok": True, "access_policy": case.access_policy, "survivor_name": case.survivor_name}


@app.patch("/api/cases/{case_id}/transcripts/{transcript_id}", tags=["Cases"])
def update_transcript(case_id: str, transcript_id: int, body: TranscriptUpdateIn, db: Session = Depends(get_db)):
    _case_or_404(db, case_id)
    transcript = (
        db.query(Transcript)
        .filter(Transcript.case_id == case_id, Transcript.id == transcript_id)
        .first()
    )
    if not transcript:
        raise HTTPException(404, "Transcript not found")
    if body.consent_visible is not None:
        transcript.consent_visible = body.consent_visible
    if body.lawyer_note is not None:
        transcript.lawyer_note = body.lawyer_note
    if body.review_status is not None:
        transcript.review_status = body.review_status
    if body.legal_flag is not None:
        transcript.legal_flag = body.legal_flag
    db.commit()
    return {"ok": True}


@app.post("/api/cases/{case_id}/annotations", tags=["Cases"])
def save_annotations(case_id: str, body: AnnotationBundleIn, db: Session = Depends(get_db)):
    _case_or_404(db, case_id)
    transcripts = {
        str(t.id): t
        for t in db.query(Transcript).filter(Transcript.case_id == case_id).all()
    }
    updated = 0
    for key, note in body.notes.items():
        transcript = transcripts.get(str(key))
        if transcript is None:
            continue
        transcript.lawyer_note = note
        updated += 1
    db.commit()
    return {"ok": True, "updated": updated}


@app.post("/api/demo/load", tags=["Demo"])
def load_demo(db: Session = Depends(get_db)):
    path = Path(__file__).resolve().parent.parent / "data" / "demo_testimony.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    cid = data["case_id"]
    c = db.query(Case).filter(Case.case_id == cid).first()
    if not c:
        c = Case(
            case_id=cid,
            counselor_name=data.get("counselor_name", "Sunita Sharma"),
            survivor_name=data.get("survivor_name", "Survivor"),
            access_policy=data.get("access_policy", "legal-team"),
        )
        db.add(c)
    else:
        c.counselor_name = data.get("counselor_name", c.counselor_name)
        c.survivor_name = data.get("survivor_name", c.survivor_name)
        c.access_policy = data.get("access_policy", c.access_policy)
    db.query(Transcript).filter(Transcript.case_id == cid).delete()
    for ch in data["chunks"]:
        fragment_hash = _compute_fragment_hash(cid, ch["chunk_index"], ch["text"])
        db.add(
            Transcript(
                case_id=cid,
                chunk_index=ch["chunk_index"],
                text=ch["text"],
                stress_label=ch.get("stress_label"),
                stress_score=ch.get("stress_score"),
                signal_voice=ch.get("signal_voice"),
                signal_words=ch.get("signal_words"),
                signal_face=ch.get("signal_face"),
                possibility=ch.get("possibility"),
                fragment_hash=fragment_hash,
                source_session=ch.get("source_session", "session-1"),
                source_mode=ch.get("source_mode", "voice"),
                speaker_language=ch.get("speaker_language", "en-IN"),
                temporal_anchor=ch.get("temporal_anchor"),
                sensory_anchor=ch.get("sensory_anchor"),
                consent_visible=ch.get("consent_visible", True),
            )
        )
    db.commit()
    return {"ok": True, "case_id": cid}


@app.post("/api/pitch-timeline", tags=["Analysis"])
def pitch_timeline(case_id: str = Query(...), db: Session = Depends(get_db)):
    rows = _ordered_rows(db, case_id)
    return build_pitch_timeline(rows)


@app.post("/api/bayesian-timeline", tags=["Analysis"])
def bayesian_timeline(case_id: str = Query(...), db: Session = Depends(get_db)):
    rows = _ordered_rows(db, case_id)
    text = " ".join(t.text for t in rows if t.consent_visible is not False)
    if not text.strip():
        return []
    return reconstruct_timeline(text)


@app.post("/api/semantic-edges", tags=["Analysis"])
def semantic_edges(case_id: str = Query(...), db: Session = Depends(get_db)):
    rows = _ordered_rows(db, case_id)
    return compute_semantic_edges(rows)


@app.post("/api/gemini/guidance", tags=["Gemini"])
def api_guidance(body: GuidanceRequest):
    return {"guidance": counselor_guidance(body.transcript_window)}


@app.post("/api/gemini/knowledge-graph", tags=["Gemini"])
def api_knowledge_graph(case_id: str = Query(...), db: Session = Depends(get_db)):
    rows = _ordered_rows(db, case_id)
    text = " ".join(t.text for t in rows if t.consent_visible is not False)
    return extract_knowledge_graph(text)


@app.get("/api/bns/suggest", tags=["BNS"])
def bns_suggest(case_id: str = Query(...), db: Session = Depends(get_db)):
    rows = _ordered_rows(db, case_id)
    text = " ".join(t.text for t in rows if t.consent_visible is not False)
    return {"suggestions": search_bns(text, top_k=5)}


@app.post("/api/cases/{case_id}/verify-bns", tags=["Cases"])
def verify_bns(case_id: str, body: VerifyBnsRequest, db: Session = Depends(get_db)):
    c = _case_or_404(db, case_id)
    c.verified_bns = json.dumps(body.section_ids)
    db.commit()
    return {"ok": True, "verified_bns": body.section_ids}


@app.post("/api/cases/{case_id}/pdf", tags=["Cases"])
def generate_pdf(case_id: str, db: Session = Depends(get_db)):
    c = _case_or_404(db, case_id)
    verified_ids = json.loads(c.verified_bns or "[]")
    if not verified_ids:
        raise HTTPException(400, "Select at least one BNS section before generating PDF")

    rows = _ordered_rows(db, case_id)
    visible_rows = [t for t in rows if t.consent_visible is not False]
    full_text = " ".join(t.text for t in visible_rows)
    timeline = reconstruct_timeline(full_text)
    pitch = build_pitch_timeline(visible_rows)
    structured = structured_testimony_for_pdf(full_text, timeline)
    kg = extract_knowledge_graph(full_text)
    kg_summary = json.dumps(kg, ensure_ascii=False, indent=2)[:4000]

    path = Path(__file__).resolve().parent.parent / "data" / "bns_sections.json"
    with open(path, encoding="utf-8") as f:
        all_sections = {s["id"]: s for s in json.load(f)}
    verified_bns = [all_sections[i] for i in verified_ids if i in all_sections]

    pdf_bytes, digest = build_pdf_bytes(
        case_id,
        c.counselor_name,
        structured,
        timeline,
        kg_summary,
        verified_bns,
        pitch_reconstructed=pitch.get("reconstructed_timeline"),
        pitch_formula=pitch.get("formula", ""),
        survivor_name=c.survivor_name,
        access_policy=c.access_policy,
        contradiction_explanations=pitch.get("contradiction_explanations"),
        cross_exam_targets=pitch.get("cross_exam_targets"),
        fragment_rows=[
            {
                "chunk_index": row.chunk_index,
                "hash": row.fragment_hash,
                "source_session": row.source_session,
                "consent_visible": row.consent_visible,
            }
            for row in visible_rows
        ],
    )
    c.pdf_hash = digest
    db.commit()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="vidhi-{case_id}.pdf"',
            "X-Content-Fingerprint": digest,
        },
    )
