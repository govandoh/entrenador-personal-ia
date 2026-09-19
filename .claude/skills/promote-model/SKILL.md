---
name: promote-model
description: Promover un modelo ONNX a producción de forma verificable: comprueba que existe el reporte `ml/reports/<task>@<version>.json`, que supera `ml/thresholds.yaml`, calcula el `sha256` del artefacto, actualiza `models/manifest.json` y exige una DEC enlazada en el PR. Úsala cuando `ml-engineer` termine una versión y quiera que la app la cargue (modo sombra, ensamble o primario).
---

# /promote-model — llevar un modelo evaluado al manifest

Gate de modelo (plan §2.5.5): **sin reporte aprobado y sha256 coincidente, el PR falla en CI**.
Esta skill lo verifica antes de abrir el PR.

## Entrada
`task` (ej. `exercise-classifier`, `squat-form-errors`) y `version` (semver, ej. `0.3.0`).
Ruta del artefacto local `.onnx` y URL publicada en Hugging Face Hub.

## 1. Verificar que existe el reporte
- Debe existir `ml/reports/<task>@<version>.json`, generado por `ml/eval.py` (no a mano).
- Campos mínimos: `task`, `version`, `datasetHash`, `evaluation: "loso"`, `metrics` por
  ejercicio × vista × clase, `latencyP95Ms` (WASM, gama media), `featureSchemaVersion`,
  `artifactSha256`, `licenses[]`.
- Si falta el reporte: detenerse y pedir correr `ml/eval.py`.

## 2. Comparar contra los umbrales
Leer `ml/thresholds.yaml` y comprobar cada métrica del reporte:
- `exercise-classifier`: accuracy LOSO ≥ 0.90 en los 3 ejercicios; `latencyP95Ms` < 15.
- `*-form-errors`: F1 macro LOSO ≥ 0.75 por clase; acuerdo con reglas ≥ 0.95 en casos claros.
- `rep-segmenter`: exactitud de conteo ≥ 0.98 sobre fixtures.
- Comparar también con la versión promovida actualmente en el manifest: ninguna métrica
  principal puede empeorar sin justificación en la DEC.
Reportar tabla `métrica | umbral | valor | OK/FALLA`. Una sola FALLA bloquea la promoción.

## 3. Calcular el sha256 del artefacto
```
node -e "const c=require('crypto'),f=require('fs');console.log(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))" <ruta.onnx>
```
Debe coincidir con `artifactSha256` del reporte y con el archivo publicado en HF Hub
(descargar la URL y recalcular). Si difieren, el artefacto no es el evaluado: detenerse.

## 4. Actualizar `models/manifest.json`
Solo en rama `adr/*` o `contracts/*` (el hook `guard-protected-paths` bloquea otras ramas).
```
{
  "task": "<task>", "version": "<version>", "url": "https://huggingface.co/.../<file>.onnx",
  "sha256": "<hex>", "featureSchemaVersion": 1, "opset": 17,
  "rollout": { "mode": "shadow" | "ensemble" | "primary", "exercises": ["squat"], "confidenceThreshold": 0.7 },
  "report": "ml/reports/<task>@<version>.json", "decision": "DEC-NNN"
}
```
Regla de despliegue progresivo: una versión nueva entra en `shadow`; pasa a `ensemble` y luego a
`primary` en PRs posteriores con evidencia de acuerdo reglas-vs-ML.

## 5. Exigir la DEC
- El PR debe enlazar `DEC-NNN` en su cuerpo (campo "ADR relacionada" de la plantilla).
- Si no existe, crearla con `/adr` (contexto: qué modelo, qué datos, qué métricas, qué riesgos).

## Salida esperada
- Tabla de umbrales con veredicto.
- sha256 verificado (local = reporte = HF Hub).
- Diff de `models/manifest.json`.
- Commit sugerido: `feat(models): promover <task>@<version> en modo <mode> (DEC-NNN)`.
- Recordar a `docs-keeper`: anotar la versión en `docs/STATUS.md`.
