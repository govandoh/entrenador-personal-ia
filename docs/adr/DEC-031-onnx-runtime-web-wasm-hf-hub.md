# DEC-031 · ONNX Runtime Web (build WASM) para inferencia en el navegador y Hugging Face Hub para publicar modelos

- **Estado:** Aceptada
- **Fecha:** 2026-09-19
- **Decisores:** Leads de los workstreams B (Análisis & Runtime) y C (ML Training)
- **Etiquetas:** ml-runtime, ml, infraestructura

## Contexto y problema

`DEC-027` decide ejecutar modelos pequeños (100k–300k parámetros) en el dispositivo sobre landmarks de MediaPipe. Se necesita: (a) un runtime de inferencia en el navegador estable en Safari iOS y Android Chrome, con latencia p95 < 15 ms por ventana; (b) un formato de exportación desde PyTorch; (c) un lugar gratuito para publicar artefactos con CDN y CORS; (d) un mecanismo para que la PWA cargue la versión correcta y verifique integridad.

## Opciones consideradas

1. **TensorFlow.js** — Descartada: desarrollo congelado desde 2024; conversión desde PyTorch frágil.
2. **LiteRT.js** (misma familia que MediaPipe Tasks) — **Plan B**: prometedor, pero ecosistema aún joven; se reevaluará si ONNX Runtime Web presenta problemas.
3. **ONNX Runtime Web con WebGPU/JSEP** — Descartada para v1: crashes reportados en Safari 26 y bundle ≈ 20 MB.
4. **ONNX Runtime Web build WASM** (elegida) — Estable en Safari, bundle razonable, suficiente para modelos de este tamaño.
5. **Servir modelos desde el propio hosting (Vercel)** — Descartada: sin control de versiones ni checksums nativos, cuenta contra el ancho de banda del plan Hobby.
6. **Hugging Face Hub** (elegida para publicación) — Repos públicos gratuitos, CDN, CORS, versionado por commit.

## Decisión

### Inferencia

- **ONNX Runtime Web, build WASM**, ejecutado dentro de un **Web Worker** para no bloquear el loop de cámara. WebGPU queda fuera hasta que sea estable en Safari.
- Exportación **PyTorch → ONNX con opset fijo** desde `ml/export_onnx.py`.
- `@fitnet/ml-runtime` expone `ModelRegistry.resolve(task, exerciseId) → InferenceSession` y `MlAnalyzer`; nada fuera de ese paquete importa `onnxruntime-web`.

### Publicación y carga

- Artefactos en **Hugging Face Hub** referenciados desde `models/manifest.json` con los campos `task`, `exerciseId`, `version`, `url`, `sha256`, `featureSchemaVersion`, `opset`, `inputShape`, `reportPath`.
- La PWA descarga el modelo de forma perezosa, verifica `sha256` y lo guarda en **Cache Storage**; si la verificación falla o no hay red, `EnsembleAnalyzer` sigue con reglas.
- `models/manifest.json` es propiedad del workstream B y solo cambia con reporte de evaluación aprobado y `sha256` coincidente (gate de promoción en `docs/ML-PIPELINE.md`); un hook bloquea su edición fuera de ramas `adr/*`/`contracts/*` (`DEC-032`).

### Entrenamiento

Kaggle (≈ 30 h de GPU por semana) para modelos secuenciales; CPU en GitHub Actions para modelos pequeños o re-entrenos rápidos. Detalle en `docs/ML-PIPELINE.md`.

## Consecuencias

### Positivas

- Runtime único y estable en los dos navegadores móviles objetivo.
- Los modelos se versionan y verifican fuera del bundle: el shell de la PWA se mantiene bajo el presupuesto de 350 kB gz.
- Fallback a reglas garantizado ante cualquier fallo de carga.

### Negativas

- Sin aceleración GPU en v1: el tamaño de los modelos queda acotado por la latencia en WASM.
- Dependencia de un servicio externo (HF Hub) para el primer arranque con ML; sin conexión la app funciona solo con reglas hasta que el modelo esté cacheado.
- Coste de ingeniería para el Worker, la verificación de hash y el manejo de versiones de esquema de features.

## Nota posterior (2026-09-24): modelos ligeros sin runtime de inferencia (`DEC-055`)

El descarte de TensorFlow.js se mantiene. Los primeros modelos del núcleo de IA (k-NN de posturas y, después, un MLP pequeño) **no usan ONNX Runtime Web**: su inferencia es TypeScript puro y el artefacto es un JSON (ejemplos o pesos), versionado con `embeddingVersion`. ONNX Runtime Web queda para modelos que lo justifiquen, empezando por el experimento con el GCN preentrenado. El gate de promoción y `models/manifest.json` aplican igual a los artefactos JSON.

## Referencias

- ONNX Runtime Web: https://onnxruntime.ai/docs/tutorials/web/
- Hugging Face Hub: https://huggingface.co/docs/hub
- `docs/ML-PIPELINE.md` (manifest, gate de promoción, despliegue sombra→ensamble→primario).
- `DEC-005` (precedente de cargar WASM desde CDN), `DEC-027`, `DEC-032`.
