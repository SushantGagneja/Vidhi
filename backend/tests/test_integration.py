"""
API integration tests — full pipeline: case, demo load, analysis, BNS, PDF.
Heavy first-time imports (sentence-transformers, FAISS) may take 1–2 minutes.
"""
import pytest
from fastapi.testclient import TestClient


def test_brain_mapping_png(client: TestClient):
    r = client.post(
        "/api/brain-mapping",
        json={
            "voice": 0.62,
            "words": 0.55,
            "face": 0.48,
            "possibility": 0.71,
            "stress_points": [0.5, 0.6, 0.7],
            "n_timesteps": 15,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert "image_b64" in data and "meta" in data
    assert data["meta"]["n_timesteps"] == 15
    assert data["meta"]["cmap"] == "fire"
    import base64

    raw = base64.b64decode(data["image_b64"])
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"


def test_openapi_available(client: TestClient):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    data = r.json()
    assert "paths" in data
    assert "/api/cases" in data["paths"]


def test_create_and_get_case(client: TestClient):
    r = client.post("/api/cases", json={"case_id": "TEST-INT", "counselor_name": "Test"})
    assert r.status_code == 200
    assert r.json()["case_id"] == "TEST-INT"

    r = client.get("/api/cases/TEST-INT")
    assert r.status_code == 200
    body = r.json()
    assert body["case_id"] == "TEST-INT"
    assert body["transcripts"] == []


def test_append_transcript_with_signals(client: TestClient):
    client.post("/api/cases", json={"case_id": "SIG-1", "counselor_name": "X"})
    r = client.post(
        "/api/cases/SIG-1/transcripts",
        json={
            "text": "He locked the door then in March things escalated.",
            "signal_voice": 0.7,
            "signal_words": 0.65,
            "signal_face": 0.55,
            "possibility": 0.66,
        },
    )
    assert r.status_code == 200
    g = client.get("/api/cases/SIG-1").json()
    assert len(g["transcripts"]) == 1
    t = g["transcripts"][0]
    assert t["text"].startswith("He locked")
    assert t["signal_voice"] == 0.7
    assert t["possibility"] == 0.66


def test_demo_load_and_pitch_timeline(client: TestClient):
    r = client.post("/api/demo/load")
    assert r.status_code == 200
    assert r.json().get("case_id") == "DEMO-001"

    r = client.post("/api/pitch-timeline?case_id=DEMO-001")
    assert r.status_code == 200
    data = r.json()
    assert "formula" in data
    assert "0.54" in data["formula"]
    assert len(data.get("events", [])) >= 1
    assert len(data.get("reconstructed_timeline", [])) >= 1
    ev = data["events"][0]
    assert "possibility" in ev
    assert "sub_nodes" in ev


def test_bayesian_timeline_fallback_without_gemini(client: TestClient):
    client.post("/api/demo/load")
    r = client.post("/api/bayesian-timeline?case_id=DEMO-001")
    assert r.status_code == 200
    out = r.json()
    assert isinstance(out, list)
    assert len(out) >= 1
    assert "event_id" in out[0]


@pytest.mark.slow
def test_semantic_edges(client: TestClient):
    client.post("/api/demo/load")
    r = client.post("/api/semantic-edges?case_id=DEMO-001")
    assert r.status_code == 200
    g = r.json()
    assert "nodes" in g and "edges" in g
    assert len(g["nodes"]) >= 2


@pytest.mark.slow
def test_bns_suggest(client: TestClient):
    client.post("/api/demo/load")
    r = client.get("/api/bns/suggest?case_id=DEMO-001")
    assert r.status_code == 200
    sug = r.json().get("suggestions", [])
    assert len(sug) >= 1
    assert "id" in sug[0] and "score" in sug[0]


def test_pdf_requires_verified_bns(client: TestClient):
    client.post("/api/demo/load")
    r = client.post("/api/cases/DEMO-001/pdf")
    assert r.status_code == 400


@pytest.mark.slow
def test_pdf_generation_end_to_end(client: TestClient):
    client.post("/api/demo/load")
    r = client.post(
        "/api/cases/DEMO-001/verify-bns",
        json={"section_ids": ["BNS-63"]},
    )
    assert r.status_code == 200

    r = client.post("/api/cases/DEMO-001/pdf")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert len(r.content) > 500
    assert r.headers.get("X-Content-Fingerprint")
