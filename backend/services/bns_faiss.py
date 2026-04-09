"""In-memory FAISS + MiniLM semantic search over BNS section snippets."""
import json
from pathlib import Path

import numpy as np

_index = None
_embedder = None
_meta: list = []


def _ensure_index():
    global _index, _embedder, _meta
    if _index is not None:
        return
    import faiss
    from sentence_transformers import SentenceTransformer

    data_path = Path(__file__).resolve().parent.parent / "data" / "bns_sections.json"
    with open(data_path, encoding="utf-8") as f:
        sections = json.load(f)
    _meta = sections
    texts = [f"{s['id']} {s['title']}: {s['text']}" for s in sections]
    _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    emb = _embedder.encode(texts, normalize_embeddings=True)
    dim = int(emb.shape[1])
    _index = faiss.IndexFlatIP(dim)
    _index.add(np.asarray(emb, dtype=np.float32))


def _confidence_label(score: float, scores: list[float]) -> str:
    if score >= 0.45:
        return "High"
    if score >= 0.28:
        return "Medium"
    if len(scores) >= 2 and (scores[0] - scores[1]) < 0.05:
        return "Low"
    return "Low"


def search_bns(query_text: str, top_k: int = 5) -> list[dict]:
    if not (query_text or "").strip():
        return []
    _ensure_index()
    q = _embedder.encode([query_text[:8000]], normalize_embeddings=True)
    scores, idx = _index.search(np.asarray(q, dtype=np.float32), min(top_k, len(_meta)))
    row = scores[0].tolist()
    ix = idx[0].tolist()
    out = []
    raw_scores = []
    for i, s in zip(ix, row):
        if i < 0:
            continue
        raw_scores.append(float(s))
    for i, s in zip(ix, row):
        if i < 0:
            continue
        sec = _meta[i]
        out.append({
            "id": sec["id"],
            "title": sec["title"],
            "snippet": sec["text"][:200],
            "score": round(float(s), 4),
            "confidence": _confidence_label(float(s), raw_scores),
        })
    return out
