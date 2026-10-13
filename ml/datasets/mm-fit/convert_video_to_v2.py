#!/usr/bin/env python3
"""Convierte un video RGB a JSON v2 de landmarks (Issue #38, Fase 1 y 2).
Usa `pose_landmarker_lite` (mismo `.task` que la app) con el paquete Python `mediapipe`
(Tasks API, modo VIDEO) -no es `@mediapipe/tasks-vision`; la equivalencia es por modelo,
no por paquete (ver `ml/README.md`). Esquema: `docs/ML-PIPELINE.md` §2. Una etiqueta
`exercise` por clip; segmentar varios ejercicios/etiquetas queda para cuando haya
etiquetas originales verificadas (bloqueado, `ml/datasets/mm-fit/dataset.json`).
`--start-sec`/`--duration-sec` recortan el clip sin depender de ffmpeg (Fase 2: videos
largos de MM-Fit). `--dataset-id`/`--source-url`/`--license`/`--citation` anotan la
procedencia en `meta.dataset`; se omiten si no se pasan (no afecta el flujo sintético).
`--official-*` anotan en `meta.dataset.officialLabel` la etiqueta original del dataset
(p. ej. `w19_labels.csv` de MM-Fit) cuando el set oficial es más amplio que el recorte
convertido; `officialSetRepCount` siempre describe el set completo, nunca los frames de
este archivo (ver `note` generada automáticamente). No cambia `labels[]` ni el contrato
del esquema v2 (`docs/ML-PIPELINE.md` §2): es metadata adicional y opcional.
Uso Fase 1: python convert_video_to_v2.py --video clip.mp4 --exercise-id squat \
    --subject-id anon-smoke --synthetic --out out.json
Uso Fase 2: python convert_video_to_v2.py --video w19_rgb.mp4 --exercise-id squat \
    --subject-id mmfit-w19 --start-sec 35 --duration-sec 8 --dataset-id mm-fit \
    --source-url https://zenodo.org/records/7672767 --license "CC BY 4.0" \
    --official-labels-source mm-fit/w19/w19_labels.csv --official-activity squats \
    --official-set-start-frame 1014 --official-set-end-frame 1510 \
    --official-set-rep-count 10 --out out.json
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

def convert(video_path, exercise_id, subject_id, view, synthetic, notes, start_sec=0.0, duration_sec=None,
            dataset_id=None, source_url=None, license_name=None, citation=None,
            official_labels_source=None, official_activity=None,
            official_set_start_frame=None, official_set_end_frame=None, official_set_rep_count=None):
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
        t_sec = ts_ms / 1000.0
        if t_sec < start_sec:
            continue
        if duration_sec is not None and (t_sec - start_sec) >= duration_sec:
            break
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        result = landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), ts_ms)
        if not result.pose_landmarks:
            skipped += 1
            continue
        world = _to_tuples(result.pose_world_landmarks[0]) if result.pose_world_landmarks else None
        t_rel_ms = ts_ms - start_sec * 1000
        frames.append({"t": float(t_rel_ms), "seq": seq, "image": _to_tuples(result.pose_landmarks[0]), "world": world})
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
    # Procedencia de datasets externos (Issue #38 Fase 2): solo se agrega si se declara
    # explícitamente un dataset_id, para no afectar el flujo sintético/local de Fase 1.
    if dataset_id:
        dataset_meta = {"id": dataset_id}
        if source_url:
            dataset_meta["sourceUrl"] = source_url
        if license_name:
            dataset_meta["license"] = license_name
        if citation:
            dataset_meta["citation"] = citation
        dataset_meta["clip"] = {"startSec": start_sec, "durationSec": duration_sec}
        # Etiqueta oficial del dataset externo (Issue #38, uso autorizado de etiquetas
        # originales): solo se agrega si se pasan explícitamente los frames del set. El
        # repCount describe el set oficial completo, no los frames de este recorte -se
        # deja explícito en `note` para que nadie lo lea como repeticiones del clip.
        if official_set_start_frame is not None and official_set_end_frame is not None:
            dataset_meta["officialLabel"] = {
                "source": official_labels_source,
                "activity": official_activity,
                "setStartFrame": official_set_start_frame,
                "setEndFrame": official_set_end_frame,
                "setRepCount": official_set_rep_count,
                "note": (
                    "setRepCount corresponde al set oficial completo "
                    f"(frames {official_set_start_frame}-{official_set_end_frame}), "
                    "no a los frames procesados en este recorte/archivo."
                ),
            }
        meta["dataset"] = dataset_meta
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
    p.add_argument("--start-sec", type=float, default=0.0, help="Segundo de inicio del recorte (Fase 2).")
    p.add_argument("--duration-sec", type=float, default=None, help="Duración del recorte en segundos (Fase 2).")
    p.add_argument("--dataset-id", default=None, help="Id del dataset externo, p. ej. 'mm-fit' (Fase 2).")
    p.add_argument("--source-url", default=None, help="URL oficial verificada del dataset (Fase 2).")
    p.add_argument("--license", dest="license_name", default=None, help="Licencia verificada, p. ej. 'CC BY 4.0'.")
    p.add_argument("--citation", default=None, help="Cita bibliográfica del dataset.")
    p.add_argument("--official-labels-source", default=None,
                    help="Ruta/archivo de la etiqueta original, p. ej. 'mm-fit/w19/w19_labels.csv'.")
    p.add_argument("--official-activity", default=None, help="Actividad según la etiqueta original (p. ej. 'squats').")
    p.add_argument("--official-set-start-frame", type=int, default=None,
                    help="Frame de inicio del set oficial completo (no del recorte).")
    p.add_argument("--official-set-end-frame", type=int, default=None,
                    help="Frame de fin del set oficial completo (no del recorte).")
    p.add_argument("--official-set-rep-count", type=int, default=None,
                    help="Repeticiones del set oficial completo (no de los frames de este recorte).")
    args = p.parse_args()
    result = convert(args.video, args.exercise_id, args.subject_id, args.view, args.synthetic, args.notes,
                      start_sec=args.start_sec, duration_sec=args.duration_sec, dataset_id=args.dataset_id,
                      source_url=args.source_url, license_name=args.license_name, citation=args.citation,
                      official_labels_source=args.official_labels_source, official_activity=args.official_activity,
                      official_set_start_frame=args.official_set_start_frame,
                      official_set_end_frame=args.official_set_end_frame,
                      official_set_rep_count=args.official_set_rep_count)
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(f"Escrito {args.out} ({len(result['frames'])} frames).")


if __name__ == "__main__":
    main()
