#!/usr/bin/env python3
"""Tests unitarios del validador del esquema v2 (Issue #38, Fase 2).
Sin red, sin MediaPipe, sin video: solo ejercitan `validate_document` con documentos
en memoria. Ejecutar con: python -m pytest ml/datasets/test_validate_v2.py
"""
from __future__ import annotations

from validate_v2 import validate_document

VALID_FRAME = {
    "t": 0.0,
    "seq": 0,
    "image": [[0.1, 0.2, 0.0, 0.9]] * 33,
    "world": None,
}


def _doc(**overrides):
    base = {
        "schemaVersion": "2",
        "meta": {"synthetic": True, "consentId": None},
        "frames": [VALID_FRAME],
        "labels": [{"kind": "exercise", "exerciseId": "squat", "start": 0, "end": 0}],
    }
    base.update(overrides)
    return base


def test_valid_document_has_no_errors():
    assert validate_document(_doc()) == []


def test_wrong_schema_version_fails():
    errors = validate_document(_doc(schemaVersion="1"))
    assert any("schemaVersion" in e for e in errors)


def test_missing_meta_fails():
    errors = validate_document(_doc(meta="no-es-un-objeto"))
    assert any("meta debe ser un objeto" in e for e in errors)


def test_synthetic_with_consent_id_fails():
    errors = validate_document(_doc(meta={"synthetic": True, "consentId": "uuid-1234"}))
    assert any("consentId" in e for e in errors)


def test_empty_frames_fails():
    errors = validate_document(_doc(frames=[]))
    assert any("frames debe ser una lista no vacia" in e for e in errors)


def test_frame_with_wrong_landmark_count_fails():
    bad_frame = dict(VALID_FRAME, image=[[0.1, 0.2, 0.0, 0.9]] * 10)
    errors = validate_document(_doc(frames=[bad_frame]))
    assert any("33 landmarks" in e for e in errors)


def test_frame_missing_required_keys_fails():
    errors = validate_document(_doc(frames=[{"t": 0.0, "image": VALID_FRAME["image"]}]))
    assert any("debe tener t, seq, image" in e for e in errors)


def test_invalid_label_kind_fails():
    errors = validate_document(_doc(labels=[{"kind": "not-a-kind"}]))
    assert any("labels[0].kind" in e for e in errors)


def test_world_landmarks_validated_when_present():
    bad_world_frame = dict(VALID_FRAME, world=[[0.1, 0.2, 0.0, 0.9]] * 5)
    errors = validate_document(_doc(frames=[bad_world_frame]))
    assert any("world" in e for e in errors)


def test_dataset_official_label_metadata_does_not_break_validation():
    """meta.dataset.officialLabel (Issue #38, etiquetas originales de MM-Fit) es
    metadata adicional y opcional: el validador no la exige ni la restringe, por lo
    que un documento que la incluya debe seguir siendo válido sin cambios de contrato.
    """
    doc = _doc(
        meta={
            "synthetic": False,
            "consentId": None,
            "dataset": {
                "id": "mm-fit",
                "sourceUrl": "https://zenodo.org/records/7672767",
                "license": "CC BY 4.0",
                "clip": {"startSec": 35, "durationSec": 8},
                "officialLabel": {
                    "source": "mm-fit/w19/w19_labels.csv",
                    "activity": "squats",
                    "setStartFrame": 1014,
                    "setEndFrame": 1510,
                    "setRepCount": 10,
                    "note": "setRepCount corresponde al set oficial completo, no al recorte.",
                },
            },
        }
    )
    assert validate_document(doc) == []


if __name__ == "__main__":
    import sys

    tests = [v for k, v in globals().items() if k.startswith("test_") and callable(v)]
    failed = 0
    for test in tests:
        try:
            test()
            print(f"OK {test.__name__}")
        except AssertionError as exc:
            failed += 1
            print(f"FALLO {test.__name__}: {exc}")
    print(f"\n{len(tests) - failed}/{len(tests)} tests pasaron.")
    sys.exit(1 if failed else 0)
