#!/usr/bin/env python3
"""Convierte un video RGB a JSON v2 de landmarks (Issue #38, Fase 1).
Usa `pose_landmarker_lite` (mismo `.task` que la app) con el paquete Python `mediapipe`
(Tasks API, modo VIDEO) -no es `@mediapipe/tasks-vision`; la equivalencia es por modelo,
no por paquete (ver `ml/README.md`). Esquema: `docs/ML-PIPELINE.md` §2. Una etiqueta
`exercise` por clip; segmentar varios ejercicios/etiquetas queda para la Fase 2.
Uso: python convert_video_to_v2.py --video clip.mp4 --exercise-id squat \
    --subject-id anon-smoke --synthetic --out out.json
"""
from __future__ import annotations

import argparse
import json
import os
import urllib.request
from datetime import datetime, timezone

import cv2

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
)
MODEL_CACHE = os.path.join("ml", ".cache", "pose_landmarker_lite.task")


def _ensure_model(path: str) -> str:
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        urllib.request.urlretrieve(MODEL_URL, path)
    return path

def _to_tuples(lms):
    return [[float(lm.x), float(lm.y), float(lm.z), float(getattr(lm, "visibility", 0.0) or 0.0)] for lm in lms]

def convert(video_path, exercise_id, subject_id, view, synthetic, notes):
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision

    options = mp_vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=_ensure_model(MODEL_CACHE)),
        running_mode=mp_vision.RunningMode.VIDEO, num_poses=1,
    )
    landmarker = mp_vision.PoseLandmarker.create_from_options(options)
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"No se pudo abrir el video: {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    frames, seq, skipped, frame_idx = [], 0, 0, 0
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        ts_ms = int(frame_idx * 1000 / fps)
        frame_idx += 1
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        result = landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), ts_ms)
        if not result.pose_landmarks:
            skipped += 1
            continue
        world = _to_tuples(result.pose_world_landmarks[0]) if result.pose_world_landmarks else None
        frames.append({"t": float(ts_ms), "seq": seq, "image": _to_tuples(result.pose_landmarks[0]), "world": world})
        seq += 1
    cap.release()
    landmarker.close()
    if not frames:
        raise RuntimeError("No se detectó ninguna persona en ningún frame; no se escribe JSON vacío.")

    notes = notes or ""
    if skipped:
        notes = f"{notes} ({skipped} frames sin persona se omitieron).".strip()
    meta = {
        "id": f"{exercise_id}_{view}_{'synthetic' if synthetic else 'converted'}_001",
        "exerciseId": exercise_id, "view": view, "fps": {"nominal": round(fps, 2)},
        "mediapipe": {"package": "mediapipe", "version": getattr(mp, "__version__", "unknown"), "model": "pose_landmarker_lite"},
        "synthetic": synthetic, "consentId": None,
        "recordedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "subjectId": subject_id, "notes": notes,
    }
    labels = [{"kind": "exercise", "exerciseId": exercise_id, "start": 0, "end": seq - 1}]
    return {"schemaVersion": "2", "meta": meta, "frames": frames, "labels": labels}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--video", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--exercise-id", required=True)
    p.add_argument("--subject-id", required=True)
    p.add_argument("--view", default="front", choices=["side", "front", "45"])
    p.add_argument("--synthetic", action="store_true")
    p.add_argument("--notes", default="")
    args = p.parse_args()
    result = convert(args.video, args.exercise_id, args.subject_id, args.view, args.synthetic, args.notes)
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(f"Escrito {args.out} ({len(result['frames'])} frames).")


if __name__ == "__main__":
    main()
