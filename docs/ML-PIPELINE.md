# Fitnet — Pipeline de datos y modelos (`ml/`)

> Responsabilidad de este archivo: cómo se capturan los datos, cómo se transforman en features, cómo se entrenan, evalúan, publican y despliegan los modelos. Decisión de fondo: `DEC-027` (arquitectura híbrida) y `DEC-031` (ONNX Runtime Web + Hugging Face Hub). Métricas y metas: `METRICS.md`. Consentimiento y licencias: `DATA-GOVERNANCE.md`. Propiedad: workstream C (`ml/`, reportes, artefactos) y B (`ml-runtime`, `models/manifest.json`).

**Estado:** todo lo descrito es objetivo. Hoy no existen `ml/`, `fixtures/` ni `models/`; el PR 1 crea los primeros fixtures (sintéticos y grabados con `?debug=record`) y el PR 9 el scaffold de `ml/` (`ARCHITECTURE.md` §2.4).

## 1. Captura con consentimiento

- Modo `/capture` en la app (PR 8), detrás de feature flag. Antes de grabar, pantalla de consentimiento que crea un `RecordingConsent` (texto versionado); sin consentimiento no se guarda nada.
- Se graba `LandmarkFrame[]` (2D + 3D + `t`) y etiquetas: ejercicio, límites de rep propuestos por el tracker de reglas y corregidos a mano, tags de error de forma, RPE de la serie.
- **Nunca video en servidor.** Opcionalmente se guarda video **local** en el dispositivo para etiquetar y se borra al terminar; no se sube.
- Mientras no exista auth, el modo dev `?debug=record` (PR 1) descarga el JSON al dispositivo y el desarrollador lo copia a `fixtures/landmarks/` (guía `/fixture`, `CONTRIBUTING.md`).

### Sprint de recolección (2 semanas, tras PR 8)

≥ 20 voluntarios, 3 ejercicios, errores guiados con guion (para cada código de `METRICS.md` §5.2), 2–3 ángulos de cámara, celulares distintos. Meta: ≥ 30 reps por clase de error por sujeto-ángulo.

## 2. Esquema JSON v1 de fixtures y grabaciones

Compartido por TypeScript (`@fitnet/contracts`, zod) y Python (`ml/schemas.py`, pydantic). `schemaVersion: "1"`.

```json
{
  "schemaVersion": "1",
  "meta": {
    "id": "squat_side_good_001",
    "exerciseId": "squat",
    "view": "side",
    "device": { "model": "Pixel 7", "os": "Android 14", "browser": "Chrome 128" },
    "fps": { "nominal": 30, "measuredMean": 29.4 },
    "camera": "environment",
    "mediapipe": { "package": "@mediapipe/tasks-vision", "version": "0.10.35", "model": "pose_landmarker_lite" },
    "synthetic": false,
    "consentId": "uuid-o-null-para-fixtures-sinteticos",
    "recordedAt": "2026-10-01T15:04:05Z",
    "subjectId": "anon-7f3a",
    "rpe": 7,
    "notes": "texto libre"
  },
  "frames": [
    { "t": 0,     "seq": 0, "image": [[0.51, 0.22, -0.31, 0.99], "…33 entradas [x, y, z, visibility]"], "world": [[0.02, -0.55, -0.10, 0.99], "…33 entradas en metros"] },
    { "t": 33.4,  "seq": 1, "image": ["…"], "world": ["…"] }
  ],
  "labels": [
    { "kind": "rep",   "start": 0, "peak": 43, "end": 78, "source": "rules|manual", "errors": ["shallow_depth"] },
    { "kind": "error", "code": "knee_valgus", "start": 40, "end": 46, "severity": 0.6 },
    { "kind": "exercise", "exerciseId": "squat", "start": 0, "end": 900 }
  ]
}
```

- `image`: 33 × `[x, y, z, visibility]` normalizados 0–1 (`z` relativo a cadera, misma escala que `x`).
- `world`: 33 × `[x, y, z, visibility]` en metros, origen en el centro de cadera; `null` si MediaPipe no lo devolvió.
- `labels[].start/peak/end` son índices de `frames` (`seq`), no tiempos.
- Los fixtures **sintéticos** (senoidales con ruido, PR 1) llevan `synthetic: true` y `consentId: null`; se usan solo para golden de reglas, nunca para entrenar.
- Nombre de archivo: `fixtures/landmarks/<exerciseId>_<view>_<condición>_<nnn>.json`.

## 3. Canonicalización (lo que más importa, más que la arquitectura del modelo)

Aplicada de forma idéntica en `analysis-core` (TS) y `ml/features/` (Python), con **test de paridad** (tolerancia 1e-3) sobre los mismos fixtures.

1. **Centrar en cadera:** restar el punto medio de 23/24.
2. **Escalar por torso:** dividir por la distancia media hombro-cadera (11/12 ↔ 23/24).
3. **Alinear yaw:** rotar alrededor del eje vertical para que el vector entre caderas quede paralelo al eje X (solo con `world`; con `image` se omite).
4. **Espejar izquierda/derecha:** duplicar cada muestra intercambiando índices L/R y negando X; duplica el dataset y elimina sesgo de lado.
5. Ventanas de **60 frames** para el clasificador; `RepWindow` con resampling a 64 muestras para el analizador de forma.

## 4. Aumento de datos (solo en entrenamiento)

- Rotación sobre el eje vertical ±30° (nuevos puntos de vista).
- Escala y shear moderados (proporciones corporales).
- Jitter gaussiano por joint (σ proporcional a `1 − visibility`).
- Time-warping y resampling (cadencias distintas, 24/30/60 fps).
- **Síntesis guiada por error:** perturbar reps correctas hacia patrones conocidos (p. ej. acercar rodillas para `knee_valgus`, inclinar tronco para `trunk_lean`), etiquetadas como sintéticas y con peso reducido.

## 5. Datasets externos y licencias

| Dataset | Licencia | Uso permitido en Fitnet |
|---|---|---|
| MM-Fit | MIT | Preentrenar el clasificador de ejercicio; producto. |
| InfiniteRep | CC BY 4.0 | Preentrenar el clasificador; producto, con atribución en `DATA-GOVERNANCE.md` y en la app. |
| EC3D | Sin licencia comercial explícita | **Solo prototipos y benchmarks**; ningún peso entrenado con él se publica en `models/manifest.json`. |
| REHAB24-6 | No comercial | Solo prototipos y benchmarks. |
| Fitness-AQA | No comercial | Solo prototipos y benchmarks. |

Cada entrada de `ml/datasets/` declara `license` y `allowedFor: ["prototype"] | ["product"]`; `ml/train` rechaza mezclar datasets `prototype` en un run marcado `--for-product`.

## 6. Entrenamiento

- Framework: PyTorch. Cómputo: Kaggle (≈ 30 h GPU/semana) para modelos secuenciales; CPU en GitHub Actions para modelos pequeños o re-entrenos.
- Modelos v1: clasificador de ejercicio (GRU 2 capas o TCN, 100k–300k parámetros); analizador de forma por rep (TCN o GCN ligero multi-label, empezando por sentadilla); fatiga sin modelo (reglas de `METRICS.md` §3), opcional Random Forest después.
- Cada run registra: commit de `ml/`, `featureSchemaVersion`, datasets y licencias usados, semilla, hiperparámetros, hash de los datos.
- Export: `ml/export_onnx.py` con **opset fijo** (declarado en `ml/thresholds.yaml`), verificación de que la salida ONNX coincide con PyTorch sobre un batch de prueba.

## 7. Evaluación (LOSO obligatoria) y reporte

- **Leave-One-Subject-Out** por `subjectId`; nunca se evalúa sobre sujetos vistos en entrenamiento.
- Reporte `reports/<task>@<version>.json` generado por `ml/eval.py`:

```json
{
  "task": "form_errors", "exerciseId": "squat", "version": "0.3.0",
  "featureSchemaVersion": "1", "opset": 17, "sha256": "…",
  "datasets": [{ "id": "own-2026-10", "license": "internal" }, { "id": "mm-fit", "license": "MIT" }],
  "loso": { "accuracy": 0.91, "f1_macro": 0.78,
            "perClass": { "shallow_depth": { "f1": 0.83 }, "knee_valgus": { "f1": 0.72 } },
            "perView": { "side": { "f1_macro": 0.81 }, "front": { "f1_macro": 0.74 } } },
  "agreementWithRules": 0.96,
  "latency": { "runtime": "onnxruntime-web-wasm", "device": "mid-range-android", "p50Ms": 6.1, "p95Ms": 11.8 },
  "trainedAt": "2026-11-02T10:00:00Z", "mlCommit": "abc123"
}
```

- Resultados por ejercicio × vista × clase; la comparación con la versión promovida anterior se incluye en el reporte.

## 8. `models/manifest.json`

Propiedad del workstream B; se edita solo en ramas `adr/*` o `contracts/*` (hook y CI).

| Campo | Descripción |
|---|---|
| `task` | `exercise_classifier` \| `form_errors` \| `rep_segmenter` \| `fatigue` |
| `exerciseId` | ejercicio o `"*"` para el clasificador |
| `version` | semver del artefacto |
| `url` | URL en Hugging Face Hub (commit fijo, no rama) |
| `sha256` | hash del `.onnx`; la PWA lo verifica antes de usarlo |
| `sizeBytes` | tamaño para presupuesto de descarga |
| `opset` | opset ONNX |
| `inputShape` / `outputSchema` | forma de entrada y semántica de salida (clases, orden) |
| `featureSchemaVersion` | versión de `FeatureVector` con la que se entrenó; `ModelRegistry` rechaza desajustes |
| `reportPath` | ruta del reporte aprobado en `reports/` |
| `mode` | `shadow` \| `ensemble` \| `primary` (por ejercicio) |
| `confidenceThreshold` | `τ` bajo el cual se usa el fallback de reglas |
| `promotedAt`, `promotedBy` | trazabilidad |

## 9. Gate de promoción

Un PR que modifica `models/manifest.json` solo pasa CI si:

1. Existe `reports/<task>@<version>.json` con `sha256` igual al del manifest.
2. Cada métrica del reporte supera `ml/thresholds.yaml` (metas de `METRICS.md` §8) en todas las celdas relevantes (ejercicio × vista × clase).
3. No hay regresión frente a la versión promovida anterior (mismas métricas ± tolerancia declarada).
4. Los datasets usados son todos `allowedFor: product`.
5. El PR está en rama `adr/*` o `contracts/*` y tiene la aprobación de B (y C como autor del reporte).

La skill `/promote-model` automatiza la verificación local; el CI la repite.

## 10. Despliegue progresivo por ejercicio

| Modo | Quién decide | Qué hace el ML | Salida de modo |
|---|---|---|---|
| `shadow` (sombra) | Reglas | Infiere y registra `agreementWithRules` y `confidence` en `StoreSink` (sin efecto en UI) | Acuerdo ≥ 95 % en casos claros durante ≥ 2 semanas de uso real |
| `ensemble` | Ponderado: `score = w·ml + (1−w)·rules`, `w` en manifest | Contribuye al `FormAssessment` con `source: 'ensemble'` | Sin regresión de golden ni de quejas |
| `primary` | ML | Decide; si `confidence < τ` o falla la carga, `RuleBasedAnalyzer` | — |

Los cambios de modo son cambios en `models/manifest.json` (mismo gate). Cada ejercicio avanza por separado; el clasificador de ejercicio solo reemplaza el chip manual cuando esté en `primary` para los tres ejercicios.

## 11. Inferencia en el cliente (`@fitnet/ml-runtime`)

ONNX Runtime Web build WASM en un Web Worker; `ModelRegistry.resolve(task, exerciseId)` descarga el artefacto, verifica `sha256`, lo guarda en Cache Storage y devuelve una `InferenceSession`. `MlAnalyzer.analyzeRep(RepWindow)` envía la ventana canonicalizada al Worker y devuelve `FormAssessment` con `source: 'ml'`. Detalle en `DEC-031`.
