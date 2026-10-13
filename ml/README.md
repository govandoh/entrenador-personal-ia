# `ml/` — Pipeline de datasets (workstream C)

> Propiedad: workstream C (`ml-engineer`). Esquema: `docs/ML-PIPELINE.md` §2.

## Alcance (Issue #38, dos fases)

- **Fase 1 (completada):** scaffold mínimo, conversor video → v2, validador
  estructural y una prueba con datos **sintéticos**. No se usa MM-Fit real.
- **Fase 2 (completada para Sprint 1):** MM-Fit real, video RGB de Zenodo (CC BY 4.0,
  licencia verificada) **más** la etiqueta oficial de `w19_labels.csv` (set de
  sentadillas, frames 1014–1510), con uso autorizado por `@govandoh` para este
  proyecto académico — **no** es una licencia pública verificada del paquete de
  etiquetas (ver `ml/datasets/mm-fit/README.md` y `ml/datasets/mm-fit/dataset.json`).

El criterio mínimo del Sprint 1 (un dataset externo convertido y validado, con
licencia verificada y anotada) se cumple con el RGB; la etiqueta oficial del set se
anota como metadata adicional (`meta.dataset.officialLabel`) sin cambiar el contrato
del esquema v2. Cargar plantillas al k-NN, Fitness-AQA y segmentación por repetición
individual quedan fuera de esta entrega.

## Evidencia de la Fase 2

Ejecutado manualmente (no en CI) el 2026-10-12, en la rama `feat/ml-datasets`.

- **Dataset:** MM-Fit, video RGB `w19_rgb.mp4`, descargado de Zenodo
  (`https://zenodo.org/records/7672767`), licencia CC BY 4.0.
- **Recorte convertido:** segundos 35–43 (8 s), sentadillas identificadas visualmente
  (no hay segmentación oficial por rep; ver limitaciones en
  `ml/datasets/mm-fit/README.md`).
- **Conversión MediaPipe:** exitosa, **240 frames** generados en
  `ml/data/out/mmfit_w19_squat_v2.json` (archivo local, ignorado por git).
- **Validación (`validate_v2.py`):** `OK ml/data/out/mmfit_w19_squat_v2.json (240 frames)`.
- **Pruebas unitarias (`test_validate_v2.py`):** `9 passed in 0.08s`
  (Python 3.11.9, pytest 9.1.1).
- **Etiquetas originales de MM-Fit:** el clip se confirmó, contra `w19_labels.csv`
  (`mm-fit/w19/`, extraído por rango HTTP sin descargar el ZIP completo, integridad
  verificada por CRC32), dentro del set oficial de sentadillas (frames 1014–1510,
  33.8–50.33 s). El recorte de 35–43 s es un **subconjunto** de ese set, no el set
  completo: no se registran las 10 repeticiones oficiales como ocurridas en los 240
  frames procesados; el set completo se anota solo como metadata informativa en
  `meta.dataset.officialLabel`. Uso autorizado por `@govandoh` el 2026-10-12 para este
  proyecto académico — el paquete de etiquetas **no tiene licencia pública verificada**
  (ver `ml/datasets/mm-fit/dataset.json` → `verified.labelsProvenance`).
- **Nada de lo anterior se subió al repositorio:** el `.mp4`, el `.json` de salida y el
  CSV original están fuera del repo (`ml/data/raw/`, `ml/data/out/`, archivos
  temporales locales), todos cubiertos por `.gitignore` o nunca escritos en el
  workspace del repositorio.

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
python -m pytest ml/datasets/test_validate_v2.py -v
```

Pasos de Kaggle: `ml/datasets/mm-fit/kaggle.md`. Procedimiento de Fase 2 (MM-Fit RGB
real): `ml/datasets/mm-fit/README.md`.

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
