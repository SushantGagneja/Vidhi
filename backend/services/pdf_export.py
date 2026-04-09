"""Vidhi Daubert-style export with reasoning trace and fragment provenance."""
import hashlib
import io
import json
from datetime import datetime, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def _esc(text: str) -> str:
    return (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _story(
    case_id: str,
    counselor_name: str,
    survivor_name: str,
    access_policy: str,
    structured_testimony: str,
    timeline_events: list,
    knowledge_graph_summary: str,
    verified_bns: list[dict],
    content_hash: str,
    pitch_reconstructed: list | None,
    pitch_formula: str,
    contradiction_explanations: list | None,
    cross_exam_targets: list | None,
    fragment_rows: list | None,
) -> list:
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph("<b>Vidhi evidentiary packet</b>", styles["Title"]))
    story.append(Paragraph(f"Case: {case_id} &nbsp; Legal reviewer: {counselor_name}", styles["Normal"]))
    story.append(Paragraph(f"Survivor label: {survivor_name} &nbsp; Access: {access_policy}", styles["Normal"]))
    story.append(Paragraph(f"Generated (UTC): {datetime.now(timezone.utc).isoformat()}", styles["Normal"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("<b>Method summary</b>", styles["Heading2"]))
    story.append(
        Paragraph(
            _esc(
                "Vidhi collects testimony fragments non-linearly, preserves uncertainty, and presents a ranked linear timeline for legal review."
            ),
            styles["BodyText"],
        )
    )
    story.append(Paragraph(_esc(pitch_formula or ""), styles["BodyText"]))
    story.append(
        Paragraph(
            "<i>This output supports legal preparation and admissibility review. It is not a lie detector and does not claim factual certainty.</i>",
            styles["Italic"],
        )
    )
    story.append(Spacer(1, 12))

    story.append(Paragraph("<b>Structured testimony draft</b>", styles["Heading2"]))
    for block in structured_testimony.split("\n\n"):
        if block.strip():
            story.append(Paragraph(_esc(block).replace("\n", "<br/>")[:4000], styles["BodyText"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("<b>Ranked timeline with reasoning trace</b>", styles["Heading2"]))
    for row in pitch_reconstructed or []:
        line = (
            f"#{row.get('rank')} {row.get('event_id')} "
            f"[{row.get('confidence_band')}] "
            f"score={row.get('confidence_score')} "
            f"- {row.get('summary', '')[:300]}"
        )
        story.append(Paragraph(_esc(line), styles["BodyText"]))
        trace = row.get("reasoning_trace", "")
        if trace:
            story.append(Paragraph(_esc(f"Reasoning trace: {trace}"), styles["Italic"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("<b>Cross-examination prep</b>", styles["Heading2"]))
    for row in cross_exam_targets or []:
        line = (
            f"{row.get('event_id')} | confidence={row.get('confidence_score')} | "
            f"distress={row.get('distress_score')} | {row.get('attack_surface')}"
        )
        story.append(Paragraph(_esc(line), styles["BodyText"]))
        story.append(Paragraph(_esc(row.get("recommended_prep", "")), styles["Italic"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("<b>Contradiction explanations</b>", styles["Heading2"]))
    for row in contradiction_explanations or []:
        story.append(Paragraph(_esc(row.get("explanation", "")), styles["BodyText"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("<b>AI-reconstructed timeline (secondary chronology view)</b>", styles["Heading2"]))
    for ev in timeline_events or []:
        line = f"{ev.get('event_id', '')} certainty={ev.get('bayesian_certainty', '')}: {ev.get('event_text', '')[:400]}"
        story.append(Paragraph(_esc(line), styles["BodyText"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("<b>Verified legal sections</b>", styles["Heading2"]))
    for b in verified_bns:
        story.append(Paragraph(f"• {b.get('id', '')} — {b.get('title', '')}", styles["BodyText"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("<b>Fragment provenance ledger</b>", styles["Heading2"]))
    for row in fragment_rows or []:
        line = (
            f"Fragment {row.get('chunk_index')} | session={row.get('source_session')} | "
            f"visible={row.get('consent_visible')} | sha256={row.get('hash')}"
        )
        story.append(Paragraph(_esc(line), styles["BodyText"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("<b>Entity / relationship summary</b>", styles["Heading2"]))
    story.append(Paragraph(_esc(knowledge_graph_summary).replace("\n", "<br/>")[:3000], styles["BodyText"]))
    story.append(Spacer(1, 18))
    story.append(Paragraph(f"<b>Content fingerprint (SHA-256 canonical payload)</b><br/>{content_hash}", styles["Normal"]))
    return story


def compute_content_fingerprint(
    case_id: str,
    counselor_name: str,
    survivor_name: str,
    access_policy: str,
    structured_testimony: str,
    timeline_events: list,
    knowledge_graph_summary: str,
    verified_bns: list[dict],
    pitch_reconstructed: list | None = None,
    contradiction_explanations: list | None = None,
    cross_exam_targets: list | None = None,
    fragment_rows: list | None = None,
) -> str:
    payload = json.dumps(
        {
            "case_id": case_id,
            "counselor_name": counselor_name,
            "survivor_name": survivor_name,
            "access_policy": access_policy,
            "structured_testimony": structured_testimony,
            "timeline_events": timeline_events,
            "knowledge_graph_summary": knowledge_graph_summary,
            "verified_bns": verified_bns,
            "pitch_reconstructed": pitch_reconstructed or [],
            "contradiction_explanations": contradiction_explanations or [],
            "cross_exam_targets": cross_exam_targets or [],
            "fragment_rows": fragment_rows or [],
        },
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def build_pdf_bytes(
    case_id: str,
    counselor_name: str,
    structured_testimony: str,
    timeline_events: list,
    knowledge_graph_summary: str,
    verified_bns: list[dict],
    pitch_reconstructed: list | None = None,
    pitch_formula: str = "",
    survivor_name: str = "Survivor",
    access_policy: str = "legal-team",
    contradiction_explanations: list | None = None,
    cross_exam_targets: list | None = None,
    fragment_rows: list | None = None,
) -> tuple[bytes, str]:
    content_hash = compute_content_fingerprint(
        case_id,
        counselor_name,
        survivor_name,
        access_policy,
        structured_testimony,
        timeline_events,
        knowledge_graph_summary,
        verified_bns,
        pitch_reconstructed,
        contradiction_explanations,
        cross_exam_targets,
        fragment_rows,
    )
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=f"Vidhi — {case_id}")
    doc.build(
        _story(
            case_id,
            counselor_name,
            survivor_name,
            access_policy,
            structured_testimony,
            timeline_events,
            knowledge_graph_summary,
            verified_bns,
            content_hash,
            pitch_reconstructed,
            pitch_formula,
            contradiction_explanations,
            cross_exam_targets,
            fragment_rows,
        )
    )
    return buf.getvalue(), content_hash
