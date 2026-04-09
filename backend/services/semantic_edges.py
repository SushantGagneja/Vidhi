"""Utterance nodes + cosine similarity edges (VIDHI Feature 4)."""
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


def compute_semantic_edges(transcript_rows: list) -> dict:
    """
    transcript_rows: list of objects with .text, .chunk_index, optional stress_label
    """
    if len(transcript_rows) < 2:
        return {"nodes": [], "edges": []}

    from sentence_transformers import SentenceTransformer

    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    texts = [t.text for t in transcript_rows]
    embeddings = embedder.encode(texts)
    sim_matrix = cosine_similarity(embeddings)

    nodes = []
    for i, t in enumerate(transcript_rows):
        nodes.append({
            "id": f"U{i}",
            "label": (t.text[:40] + "…") if len(t.text) > 40 else t.text,
            "chunk_index": t.chunk_index,
            "stress_label": getattr(t, "stress_label", None) or "Moderate",
        })

    edges = []
    n = len(transcript_rows)
    for i in range(n):
        for j in range(i + 1, n):
            sim = float(sim_matrix[i][j])
            if sim > 0.35:
                edges.append({"source": f"U{i}", "target": f"U{j}", "weight": round(sim, 3)})

    return {"nodes": nodes, "edges": edges}
