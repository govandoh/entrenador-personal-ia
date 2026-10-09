#!/usr/bin/env python3
"""Validador estructural minimo del esquema v2 (Issue #38, Fase 1).
docs/ML-PIPELINE.md §2 documenta v2 solo con un ejemplo, sin contrato formal (llega en
el PR 9); no se inventan reglas obligatorias que no estén ahí. Sin dependencias externas.
Uso: python ml/datasets/validate_v2.py archivo1.json [...]  (exit 0 ok, 1 si falla)
"""
from __future__ import annotations

import json
import sys

N_LM, LM_LEN = 33, 4
LABEL_KINDS = {"rep", "error", "exercise"}


def _check_landmarks(value, name: str, errors: list[str]) -> None:
    ok = isinstance(value, list) and len(value) == N_LM and all(
        isinstance(lm, list) and len(lm) == LM_LEN and all(isinstance(c, (int, float)) for c in lm) for lm in value
    )
    if not ok:
        errors.append(f"{name} debe ser una lista de {N_LM} landmarks [x, y, z, visibility]")

def validate_document(doc) -> list[str]:
    """Devuelve una lista de errores (vacía si el documento es válido)."""
    errors: list[str] = []
    if not isinstance(doc, dict):
        return ["el documento raiz debe ser un objeto"]
    if doc.get("schemaVersion") != "2":
        errors.append(f"schemaVersion debe ser \"2\", es {doc.get('schemaVersion')!r}")
    meta = doc.get("meta")
    if not isinstance(meta, dict):
        errors.append("meta debe ser un objeto")
        meta = {}
    if meta.get("synthetic") is True and meta.get("consentId") is not None:
        errors.append("meta.consentId debe ser null cuando meta.synthetic es true")
    frames = doc.get("frames")
    if not isinstance(frames, list) or not frames:
        errors.append("frames debe ser una lista no vacia")
    else:
        for i, frame in enumerate(frames):
            if not isinstance(frame, dict) or not {"t", "seq", "image"} <= frame.keys():
                errors.append(f"frames[{i}] debe tener t, seq, image")
                continue
            _check_landmarks(frame["image"], f"frames[{i}].image", errors)
            if frame.get("world") is not None:
                _check_landmarks(frame["world"], f"frames[{i}].world", errors)
    for i, label in enumerate(doc.get("labels", [])):
        if not isinstance(label, dict) or label.get("kind") not in LABEL_KINDS:
            errors.append(f"labels[{i}].kind debe ser uno de {sorted(LABEL_KINDS)}")
    return errors

def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    failed = False
    for path in sys.argv[1:]:
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
        errors = validate_document(doc)
        if errors:
            failed = True
            print(f"FALLO {path}:")
            for error in errors:
                print(f"  - {error}")
        else:
            print(f"OK {path} ({len(doc.get('frames', []))} frames)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
