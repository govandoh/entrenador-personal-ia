# `ml/` — Pipeline de datasets (workstream C)

> Propiedad: workstream C (`ml-engineer`). Esquema: `docs/ML-PIPELINE.md` §2.

## Alcance (Issue #38, dos fases)

- **Fase 1 (esta entrega):** scaffold mínimo, conversor video → v2, validador
  estructural y una prueba con datos **sintéticos**. No se usa MM-Fit real.
- **Fase 2 (pendiente):** MM-Fit real, solo con enlace oficial y licencia de etiquetas
  confirmados — ver `ml/datasets/mm-fit/README.md`.

**El criterio de aceptación de #38 no se declara cumplido hasta la Fase 2.**

## Qué no hacer aquí

No subir video ni datos de usuario (regla dura 2, `AGENTS.md`). No inventar licencias ni
resultados de conversión real. No tocar `src/**`, contratos ni `models/manifest.json`.

## Cómo correr (gratis, `DEC-035`)

```bash
pip install -r ml/datasets/mm-fit/requirements.txt
python ml/datasets/mm-fit/make_synthetic_clip.py --out ml/data/raw/synthetic.mp4
python ml/datasets/mm-fit/convert_video_to_v2.py --video ml/data/raw/synthetic.mp4 \
  --exercise-id squat --subject-id anon-smoke --synthetic \
  --out ml/data/out/synthetic_squat_smoke.json
python ml/datasets/validate_v2.py ml/data/out/synthetic_squat_smoke.json
```

Pasos de Kaggle: `ml/datasets/mm-fit/kaggle.md`.

## MediaPipe: Kaggle (Python) vs la app (JavaScript)

La app usa `@mediapipe/tasks-vision@0.10.35` (JS/WASM). Kaggle usa el paquete Python
`mediapipe`: no es el mismo paquete. La compatibilidad se ancla en que ambos cargan el
mismo modelo `pose_landmarker_lite.task` (float16, variante 1).

## Estructura

| Ruta | Contenido |
|---|---|
| `ml/datasets/mm-fit/` | Registro de licencia, conversor, guía Kaggle |
| `ml/datasets/validate_v2.py` | Validador estructural del esquema v2 |
| `ml/data/samples/` | Muestras versionadas (sintéticas en Fase 1) |
| `ml/data/raw/`, `ml/data/out/` | Video y salidas, ignorados por git |
