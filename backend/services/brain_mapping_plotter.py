"""
Flatmap-style brain panels inspired by neuro plot_timesteps APIs:
  n_timesteps=15, cmap='fire', norm_percentile=99, vmin~0.6, alpha band, show_stimuli.

Generates 4 brain heatmaps + a 15-segment stimulus bar; activity is stochastic but
seeded from modality scores so it reacts to live stress inputs.
"""
from __future__ import annotations

import io

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.cm import ScalarMappable
from matplotlib.patches import Rectangle


def _fire_cmap() -> LinearSegmentedColormap:
    return LinearSegmentedColormap.from_list(
        "fire",
        [
            (0.0, "#000000"),
            (0.18, "#1a0008"),
            (0.38, "#8b0000"),
            (0.58, "#ff3b00"),
            (0.78, "#ffcc33"),
            (1.0, "#fff8e8"),
        ],
        N=256,
    )


def _brain_blob(rng: np.random.Generator, shape: tuple[int, int], intensity: float) -> np.ndarray:
    h, w = shape
    g = rng.random((max(5, h // 5), max(5, w // 5)))
    rep_r = int(np.ceil(h / g.shape[0]))
    rep_c = int(np.ceil(w / g.shape[1]))
    z = np.tile(g, (rep_r, rep_c))[:h, :w].astype(np.float64)
    z *= intensity
    yy, xx = np.ogrid[:h, :w]
    cy, cx = (h - 1) / 2, (w - 1) / 2
    ry, rx = h * 0.43, w * 0.39
    mask = ((yy - cy) ** 2 / ry**2 + (xx - cx) ** 2 / rx**2) <= 1
    z = np.where(mask, z, np.nan)
    return z


def plot_brain_mapping_figure(
    voice: float,
    words: float,
    face: float,
    possibility: float,
    stress_points: list[float] | None = None,
    *,
    n_timesteps: int = 15,
    norm_percentile: int = 99,
    vmin: float = 0.6,
    alpha_cmap: tuple[float, float] = (0.0, 0.2),
    show_stimuli: bool = True,
) -> tuple[bytes, dict]:
    """
    Mimics: plot_timesteps(preds[:n], segments[:n], cmap='fire', norm_percentile=99,
    vmin=.6, alpha_cmap=(0,.2), show_stimuli=True) with 4 brain panels.
    """
    stress_points = stress_points or []
    # Deterministic across runs (avoid PYTHONHASHSEED affecting hash()).
    seed = int(
        (voice * 1_000_000 + words * 999_983 + face * 999_961 + possibility * 999_599) % (2**31 - 1)
    ) + sum(int(min(1.0, max(0.0, s)) * 10_007) for s in stress_points[:20])
    seed %= 2**31 - 1
    rng = np.random.default_rng(seed)

    # preds[t][b] — one 2D map per timestep per brain slot (like decoded volumes flattened)
    preds: list[list[np.ndarray]] = []
    for t in range(n_timesteps):
        frame = []
        wave = 0.42 + possibility * 0.45 + 0.12 * np.sin(t / 2.8) + voice * 0.18 * np.sin(t / 1.4)
        for b in range(4):
            r = np.random.default_rng(seed + 1000 * t + 17 * b)
            bias = (1.0 + 0.12 * b) * (0.9 + 0.2 * words) + face * 0.15 * (b % 2)
            frame.append(_brain_blob(r, (46, 42), float(wave * bias)))
        preds.append(frame)

    # Roll up timesteps → one map per brain (mean over time; like plot_timesteps summary)
    brains = []
    for b in range(4):
        stack = np.stack([preds[t][b] for t in range(n_timesteps)])
        with np.errstate(invalid="ignore"):
            rolled = np.nanmean(stack, axis=0)
        rolled = np.where(np.isfinite(rolled), rolled, vmin)
        brains.append(rolled)

    segments = np.clip(
        vmin
        + (possibility * 0.35 + voice * 0.25)
        * rng.random(n_timesteps)
        + 0.08 * np.sin(np.linspace(0, 3.2, n_timesteps)),
        0.0,
        1.0,
    )

    fire = _fire_cmap()
    flat = np.concatenate([x[np.isfinite(x)] for x in brains])
    hi = float(np.percentile(flat, norm_percentile)) if flat.size else 1.0
    hi = max(hi, vmin + 0.08)
    norm = Normalize(vmin=vmin, vmax=hi)
    sm = ScalarMappable(norm=norm, cmap=fire)

    fig = plt.figure(figsize=(10, 7.2), facecolor="black", dpi=120)
    fig.subplots_adjust(left=0.06, right=0.94, top=0.86, bottom=0.20 if show_stimuli else 0.12)

    titles = ["Early visual", "Parahippocampal / place", "Temporal language", "Limbic / arousal"]
    for b in range(4):
        ax = fig.add_subplot(2, 2, b + 1)
        ax.set_facecolor("black")
        ax.imshow(brains[b], cmap=fire, norm=norm, origin="lower", interpolation="bilinear")
        ax.axis("off")
        ax.set_title(titles[b], color="#d0d0d0", fontsize=9, pad=3)

    if show_stimuli:
        ax_stim = fig.add_axes([0.1, 0.07, 0.8, 0.08])
        ax_stim.set_facecolor("black")
        ax_stim.set_xlim(0, n_timesteps)
        ax_stim.set_ylim(0, 1)
        a0, a1 = alpha_cmap
        for i in range(n_timesteps):
            val = float(segments[i])
            rgba = sm.to_rgba(val)
            span = max(hi - vmin, 1e-6)
            a = a0 + (a1 - a0) * min(1.0, max(0.0, (val - vmin) / span))
            a = float(np.clip(a, 0.04, 0.45))
            rect = Rectangle(
                (i, 0.12),
                0.9,
                0.76,
                facecolor=rgba,
                alpha=a,
                edgecolor="#444444",
                linewidth=0.4,
            )
            ax_stim.add_patch(rect)
        ax_stim.set_xticks(np.arange(n_timesteps) + 0.45)
        ax_stim.set_xticklabels([f"t{t + 1}" for t in range(n_timesteps)], color="#666666", fontsize=6)
        ax_stim.tick_params(left=False, labelleft=False)
        for s in ax_stim.spines.values():
            s.set_visible(False)
        ax_stim.set_title("Stimulus-aligned segments (15 timesteps)", color="#888888", fontsize=8, pad=2)

    sp_preview = stress_points[:8]
    sp_str = ", ".join(f"{x:.2f}" for x in sp_preview) + ("…" if len(stress_points) > 8 else "")
    fig.suptitle(
        "In-silico brain mapping · random field conditioned on stress modalities",
        color="#eeeeee",
        fontsize=11,
        y=0.96,
    )
    fig.text(
        0.5,
        0.925,
        f"voice={voice:.2f}  words={words:.2f}  face={face:.2f}  P={possibility:.2f}"
        + (f"  | stress_trace: [{sp_str}]" if sp_str else ""),
        ha="center",
        color="#8a8a8a",
        fontsize=7.5,
        family="monospace",
    )

    buf = io.BytesIO()
    fig.savefig(buf, format="png", facecolor="black", pad_inches=0.06)
    plt.close(fig)
    buf.seek(0)
    png = buf.read()

    meta = {
        "n_timesteps": n_timesteps,
        "cmap": "fire",
        "norm_percentile": norm_percentile,
        "vmin": vmin,
        "vmax_effective": hi,
        "alpha_cmap": list(alpha_cmap),
        "show_stimuli": show_stimuli,
        "segment_means": segments.round(4).tolist(),
        "stress_points_n": len(stress_points),
    }
    return png, meta
