# DEC-027 · Arquitectura híbrida de IA: modelos pequeños en el dispositivo, LLM en la nube solo con métricas, reglas como fallback

- **Estado:** Aceptada
- **Fecha:** 2026-09-19
- **Decisores:** Leads de los workstreams B (Análisis & Runtime) y C (ML Training)
- **Etiquetas:** analysis-core, ml-runtime, ml, arquitectura

## Contexto y problema

El análisis actual es determinístico: `src/geometry/angles.ts` calcula ángulos 2D con `atan2` y `src/exercises/{squat,bicepCurl,shoulderPress}.ts` aplican umbrales fijos (`STANDING_ANGLE=160`, `BOTTOM_ANGLE=100`, `FLEXED_ANGLE=60`, `PRESSED_ANGLE=150`, etc.) con máquinas de estados e histéresis. Funciona para contar reps y dar feedback de profundidad/extensión, pero el alcance de Fitnet exige:

- **Clasificar el ejercicio** sin que el usuario elija un chip.
- **Detectar errores de forma** que no se reducen a un ángulo (valgo de rodilla, inclinación de tronco, asimetría).
- **Fatiga y consistencia** (velocidad, ROM, tempo, deriva) que hoy no existen.

Además, `src/pose/poseDetector.ts` descarta `result.worldLandmarks` (coordenadas 3D métricas que MediaPipe ya calcula), y todas las constantes temporales están en frames asumiendo 60 fps (`REP_COOLDOWN_FRAMES=15`, `MIN_RISING_FRAMES=3`), por lo que el comportamiento varía por dispositivo.

La pregunta central es cómo pasar de reglas a IA sin perder lo que funciona, sin latencia perceptible y sin sacar el video del dispositivo.

## Opciones consideradas

1. **Enviar video o frames a un LLM multimodal en la nube** para que "vea" la técnica. Descartada: latencia de segundos (inútil para feedback en vivo), costo por rep, el video saldría del dispositivo (viola la regla de privacidad de `DEC-026`) y no hay garantía de consistencia numérica entre llamadas.
2. **Reemplazar MediaPipe por un modelo de pose más potente en el navegador** (RTMPose vía ONNX, Sapiens). Descartada: más lentos o inviables en celular; MediaPipe es el único modelo de pose con soporte web de primera clase y ya entrega 2D + 3D.
3. **Un único modelo end-to-end** que reciba landmarks y devuelva ejercicio, reps, errores y fatiga. Descartada: exige un dataset enorme y etiquetado completo antes de tener nada; no hay forma de desplegar por partes ni de comparar contra las reglas.
4. **Arquitectura híbrida en dos niveles con despliegue progresivo** (elegida): MediaPipe como "ojo"; modelos pequeños aprendidos sobre landmarks canonicalizados en el dispositivo; reglas como fallback y etiquetador; LLM en la nube solo para lenguaje sobre métricas ya calculadas.

## Decisión

### Nivel 1 — Dispositivo, tiempo real (< 50 ms/frame)

MediaPipe Pose sigue siendo la fuente de landmarks (2D `image[33]` + 3D `world[33]`). Sobre ellos: canonicalización → `FeatureExtractor` → **modelos pequeños** (100k–300k parámetros) ejecutados en el navegador con ONNX Runtime Web (ver `DEC-031`). Las reglas actuales se conservan como **fallback** y como **etiquetador semiautomático** del dataset.

Los cuatro problemas de IA se resuelven así:

| Problema | Hoy | Solución objetivo |
|---|---|---|
| Clasificar ejercicio | Chip manual | GRU de 2 capas o TCN sobre ventanas de 60 frames de 33×(x, y, z, vis) canonicalizados; preentrenar con MM-Fit (MIT) + InfiniteRep (CC BY 4.0); afinar con datos propios. Literatura: 95–97 % in-distribution con landmarks MediaPipe. |
| Segmentar reps | Histéresis + confirmación de pico | Se conserva la máquina de estados como `RuleRepSegmenter` v1; `MlRepSegmenter` solo si un ejercicio sin ángulo dominante (p. ej. plancha) lo exige. |
| Evaluar forma / errores | Umbral fijo por ángulo | Por rep: `RepWindow` → TCN o GCN ligero multi-label con códigos `shallow_depth`, `knee_valgus`, `trunk_lean`, `partial_rom`, `asymmetry`, `unsafe_low_elbow`, `excess_speed`. Empezar por sentadilla (mejor cubierta por datasets); curl y press requieren datos propios. Evidencia: EC3D reporta 90.9 % con GCN, pero cae a 57–73 % en LOSO para errores específicos, por lo que la evaluación por sujeto es obligatoria. |
| Fatiga y consistencia | No existe | Sin modelo al inicio: por rep, desde `worldLandmarks` suavizados (One-Euro o EMA), velocidad concéntrica pico, ROM y tempo; por serie, pérdida de velocidad % (> 20 % ≈ mitad de las reps hasta el fallo en sentadilla), deriva de ROM, CV de tempo y asimetría izquierda/derecha. Opcional: Random Forest sobre esas features (82–93 % en fatiga por cinemática en la literatura). |

### Nivel 2 — Nube, asíncrono

El LLM (`CoachAssistant`, ver `DEC-033`) recibe **solo métricas estructuradas** (`Metric`, `RepSummary`) por serie/sesión y produce coaching, ajustes de rutina y resúmenes para entrenadores. **Nunca cuenta reps ni sustituye al analizador.** Uso puntual opcional: análisis cualitativo de **una imagen clave por rep** (fondo de la sentadilla) bajo demanda del usuario premium, como segunda opinión, nunca como fuente de métricas.

### Despliegue progresivo por ejercicio

`EnsembleAnalyzer` pasa por tres modos: **sombra** (las reglas deciden, el ML registra acuerdo) → **ensamble ponderado** → **ML primario** con reglas de fallback si `confidence < τ` o falla la carga del modelo. Cada ejercicio avanza de modo por separado, detrás de un flag.

### Metas de éxito (fuente de verdad en `docs/METRICS.md` y `ml/thresholds.yaml`)

- Clasificador: ≥ 90 % accuracy LOSO en los 3 ejercicios; latencia p95 < 15 ms en WASM en gama media.
- Errores de forma (sentadilla): F1 macro ≥ 0.75 LOSO por clase; acuerdo con reglas ≥ 95 % en casos claros.
- Conteo de reps: exactitud ≥ 98 % sobre fixtures (igual o mejor que hoy).
- Fatiga: correlación entre pérdida de velocidad y RPE reportado ≥ 0.6 en el dataset propio.

## Consecuencias

### Positivas

- La app en producción no pierde ninguna capacidad durante la transición: las reglas siguen decidiendo hasta que el ML demuestre acuerdo.
- Latencia y privacidad quedan garantizadas por diseño: nada pesado ni sensible viaja a la nube.
- Los fixtures de landmarks (`fixtures/landmarks/*.json`) sirven a la vez para golden tests de reglas y para entrenamiento/evaluación del ML.

### Negativas

- Exige un pipeline de datos propio (`ml/`, sprint de recolección con ≥ 20 voluntarios; ver `docs/ML-PIPELINE.md`) antes de que el ML aporte valor en curl y press.
- Dos implementaciones de features (TypeScript y Python) que deben mantenerse en paridad (test con tolerancia 1e-3).
- Las constantes en frames deben migrar a tiempo real (`PeakDetector` con `confirmMs`), lo que cambiará los golden con justificación en una DEC.

## Nota posterior (2026-09-22)

La **vía de implementación** de esta arquitectura se detalla en `DEC-034` (propuesta): features por repetición antes que keypoints crudos, esqueleto canónico COCO-17 y modelos entrenados solo con datos propios, MM-Fit o InfiniteRep. Motivo principal: los checkpoints públicos de GCN esquelético (ST-GCN++, CTR-GCN y similares) están entrenados sobre NTU RGB+D, de uso no comercial, por lo que no pueden llegar a producción en un producto con suscripciones. Esta DEC no cambia; `DEC-034` la concreta.

## Referencias

- `DEC-034` (vía de implementación y restricción de licencias).
- `ARCHITECTURE.md` (contratos `FeatureExtractor`, `FormAnalyzer`, `FatigueAnalyzer`, `EnsembleAnalyzer`).
- `docs/METRICS.md`, `docs/ML-PIPELINE.md`, `docs/DATA-GOVERNANCE.md`.
- `DEC-010`, `DEC-014`, `DEC-016`, `DEC-017` (reglas que se conservan como fallback).
- `DEC-031` (runtime de inferencia), `DEC-033` (CoachAssistant).
