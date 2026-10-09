#!/usr/bin/env python3
"""Genera un clip corto de figura de palitos (sentadilla simulada) para probar
`convert_video_to_v2.py` sin ningún dataset externo (Issue #38, Fase 1). No usa MM-Fit
ni video de ninguna persona real.
Uso: python make_synthetic_clip.py --out clip.mp4
"""
from __future__ import annotations

import argparse
import math
import os

import cv2
import numpy as np

W, H, FPS, DURATION_S = 480, 640, 30, 2.0
BONES = [
    ("sh_l", "sh_r"), ("sh_l", "hip_l"), ("sh_r", "hip_r"), ("hip_l", "hip_r"),
    ("hip_l", "knee_l"), ("hip_r", "knee_r"), ("knee_l", "ankle_l"), ("knee_r", "ankle_r"),
]

def _points(t: float) -> dict[str, tuple[int, int]]:
    """`t` en [0, 1]: 0 de pie, 0.5 punto más bajo, 1 de pie otra vez."""
    crouch = (1 - math.cos(2 * math.pi * t)) / 2
    hip_y = int(H * 0.45 + crouch * H * 0.18)
    cx = W // 2
    return {
        "head": (cx, int(hip_y - H * 0.32)), "sh_l": (cx - 40, int(hip_y - H * 0.22)),
        "sh_r": (cx + 40, int(hip_y - H * 0.22)), "hip_l": (cx - 25, hip_y), "hip_r": (cx + 25, hip_y),
        "knee_l": (cx - 30, hip_y + int(H * 0.16)), "knee_r": (cx + 30, hip_y + int(H * 0.16)),
        "ankle_l": (cx - 25, int(H * 0.85)), "ankle_r": (cx + 25, int(H * 0.85)),
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", required=True)
    p.add_argument("--duration-s", type=float, default=DURATION_S)
    p.add_argument("--fps", type=int, default=FPS)
    args = p.parse_args()

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    writer = cv2.VideoWriter(args.out, cv2.VideoWriter_fourcc(*"mp4v"), args.fps, (W, H))
    n_frames = int(args.duration_s * args.fps)
    for i in range(n_frames):
        pts = _points(i / max(n_frames - 1, 1))
        frame = np.full((H, W, 3), 230, dtype=np.uint8)
        for a, b in BONES:
            cv2.line(frame, pts[a], pts[b], (40, 40, 40), 6)
        cv2.circle(frame, pts["head"], 24, (40, 40, 40), -1)
        writer.write(frame)
    writer.release()
    print(f"Clip sintético escrito en {args.out} ({n_frames} frames, {args.fps} fps).")


if __name__ == "__main__":
    main()
