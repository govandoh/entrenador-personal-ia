# DEC-055 · Núcleo de IA: clasificador ligero sobre landmarks en TypeScript, datos propios con etiqueta por guion y preentrenado como experimento acotado

- **Estado:** Aceptada
- **Fecha:** 2026-09-24
- **Decisores:** responsable del proyecto; leads de los workstreams B (Análisis & Runtime) y C (ML Training)
- **Etiquetas:** analysis-core, ml, datos

## Contexto y problema

DEC-034 fijó una vía en tres fases (features por repetición, clasificador de ejercicio GRU/TCN, GCN) y DEC-035 permitió afinar un backbone preentrenado en el prototipo. Faltaba cerrar dos cosas: **de dónde salen los datos y cómo se entrena**, con un equipo de 5 personas y el calendario de un seminario.

El equipo propuso un enfoque concreto: un clasificador ligero sobre los landmarks normalizados (k-NN primero y una red densa pequeña después), combinado con análisis de velocidad y consistencia sobre `worldLandmarks`. Los modelos de grafos (ST-GCN/PoseC3D) y los multimodales quedan como trabajo futuro.

Al mismo tiempo, la integración de fitnetv2 (DEC-054) trajo la base geométrica que ese enfoque necesita: ángulos 3D, nivelación por gravedad, calibración de pie, filtro One Euro, validación temporal y fatiga.

## Opciones consideradas

1. **Afinar un GCN preentrenado (ST-GCN++ sobre NTU) como vía principal.**
   - Necesita ONNX Runtime Web en un Worker, sin benchmarks públicos en el navegador y con problemas de exportación conocidos (`einsum`, tensores 5D).
   - Aun así requiere cientos de repeticiones etiquetadas propias.
   - Riesgo alto para el plazo del seminario.
2. **Clasificador ligero con TensorFlow.js.** Funciona, pero DEC-031 ya descartó TensorFlow.js (desarrollo congelado, conversión frágil) y para un k-NN o un MLP de dos capas no aporta nada que no se escriba en unas 50 líneas.
3. **Clasificador ligero en TypeScript puro, sobre la geometría 3D de fitnetv2, con datos propios etiquetados por guion; preentrenado como experimento de ≤ 3 días** (elegida).

## Decisión

### Modelo

- **k-NN de posturas** (`src/analysis/poseClassifier.ts`) sobre un vector de 60 rasgos (`src/geometry/poseEmbedding.ts`): las coordenadas COCO-17 normalizadas más 8 ángulos articulares y la inclinación del tronco.
  - La pose se nivela antes (DEC-050, DEC-053).
  - Después se centra en la cadera, se escala por el torso y se gira alrededor de la vertical, así que es invariante a la estatura, la distancia y la orientación frente a la cámara.
  - La búsqueda es en dos etapas: primero distancia máxima y luego distancia media.
  - El modelo es un JSON con ejemplos y `embeddingVersion`.
- **Red densa pequeña (MLP)** como segunda iteración. Se entrena en `ml/` (Python, Kaggle) y exporta sus pesos a JSON; la inferencia es TypeScript puro. Sustituye al k-NN de un ejercicio solo si lo supera en F1 LOSO.
- **Sin TensorFlow.js y sin ONNX para estos modelos.** ONNX Runtime Web (DEC-031) queda reservado para el experimento con el preentrenado.

### Qué se clasifica

- **El frame clave de cada repetición** (fondo o pico, que ya entrega el tracker), para detectar errores de forma de postura: `knee_valgus`, `trunk_lean`, `shallow_depth`, `elbow_drift`, `lumbar_arch`.
- **Frames sueltos con `ScoreSmoother`** (media exponencial en ms) para identificar el ejercicio. Esto **sustituye al GRU/TCN de la Fase 2 de DEC-034**: con ejemplos de cada ejercicio, el vecino más cercano dice cuál es, y un ejercicio nuevo se añade con ejemplos, sin reentrenar.
- **La capa temporal no usa ML.** Tempo, recorrido, velocidad pico, pérdida de velocidad y consistencia salen de `movementQuality` y `fatigue` (DEC-037, DEC-038) y de las fórmulas de `METRICS.md` §2–3.

  El clasificador dice **qué** está mal; la serie dice **cuándo** se degrada.

### Datos, por orden de prioridad

1. **Grabaciones propias con etiqueta por guion.**
   - Cada toma se declara antes de grabar como `{ejercicio, vista, condición}`, por ejemplo "sentadilla, lateral, rodillas hacia dentro", y el sujeto hace 6–8 repeticiones así. La etiqueta sale del guion y no cuesta nada.
   - La vista la confirma `getBodyOrientation`.
   - Las reglas 3D de fitnetv2 pre-etiquetan cada repetición y una persona **confirma o descarta la toma**. El juicio humano va primero (DEC-034, sesgo de anclaje).
   - Cada grabación guarda el vector de gravedad y la corrección de calibración, para que el dataset no herede la inclinación del teléfono.
   - Meta mínima por ejercicio: 5 sujetos × 2 vistas × (1 correcta + 2–3 errores) × 8 repeticiones, unas 250–320 repeticiones. El espejado izquierda/derecha las duplica. Son unos 10 minutos de grabación por sujeto y ejercicio.
   - Primero graba el equipo; después se suman voluntarios (#16).
2. **MM-Fit** (MIT), convertido offline a landmarks de MediaPipe en Kaggle, para identificar ejercicios. Cubre varios de las olas 1 y 2 de DEC-056 (flexión, zancada, remo, elevación lateral, extensión de tríceps).
3. **Fitness-AQA** (no comercial, permitido en el prototipo por DEC-035) para ejemplos de errores en gimnasio real.
4. **Síntesis desde `demoPoses`** con perturbaciones guiadas por error. Sirve para tests y aumento de datos, con peso reducido y nunca como única fuente.

El formato de keypoints y las etiquetas exactas de MM-Fit y Fitness-AQA se verifican antes de convertirlos (issue propia).

### Metas

Se mantienen las de `METRICS.md` §8: F1 macro ≥ 0.75 por error y ≥ 90 % al identificar el ejercicio, ambas con evaluación **Leave-One-Subject-Out**; conteo ≥ 98 % sobre fixtures.

### Preentrenado: experimento de ≤ 3 días, fuera de la app

| Día | Trabajo |
|---|---|
| 1 | Notebook en Kaggle con PYSKL; checkpoint ST-GCN++ en COCO-17; conversión de las grabaciones propias a su formato. |
| 2 | Backbone congelado como extractor de rasgos por repetición + cabeza logística o k-NN; comparación LOSO contra el k-NN de esta DEC. |
| 3 | Reporte `ml/reports/spike-stgcnpp@0.1.json`, prueba de export a ONNX y medición de latencia; veredicto de seguir o no. |

Condiciones de DEC-035: no se redistribuyen pesos; todo derivado se marca `provenance: "academic-pretrained"`. No se ejecuta hasta tener el dataset propio mínimo.

## Consecuencias

### Positivas

- El primer modelo ya existe y está probado: `poseEmbedding` + `KnnPoseClassifier` con 20 tests.
  - Sobre datos sintéticos identifica sentadilla, curl y press en el 100 % de los frames de otro sujeto simulado (escala ×1,12, giro de 35°, ruido de hasta 30 mm).
  - Separa el valgo de rodilla y la profundidad corta en el frame clave.
- Cero dependencias nuevas, cero costo, sin runtime de inferencia en el bundle.
- Añadir un ejercicio o un error es agregar ejemplos etiquetados, alineado con el catálogo por olas de DEC-056.
- El k-NN es explicable: se puede mostrar qué ejemplo se parece más.

### Negativas

- Los resultados sintéticos son optimistas porque todas las poses salen del mismo modelo de cuerpo; la validez real solo se conoce con grabaciones de personas distintas.
- El k-NN crece con el número de ejemplos. A partir de unos miles por ejercicio hay que podar o pasar al MLP.
- La clasificación de un frame no ve errores que dependen de la forma global del movimiento; esos quedan para la capa temporal o para el experimento con el preentrenado.

## Referencias

- `DEC-034` (vía en tres fases; esta DEC reemplaza su Fase 2 y convierte la 3 en experimento), `DEC-035`, `DEC-031`, `DEC-054`.
- `src/geometry/poseEmbedding.ts`, `src/analysis/poseClassifier.ts`, `src/exercises/demoPoses.ts`.
- `docs/ML-PIPELINE.md` §1, §3, §5, §6; `docs/METRICS.md` §5, §8.
- Clasificación de poses con k-NN sobre MediaPipe (Google): https://developers.google.com/ml-kit/vision/pose-detection/classifying-poses
- MM-Fit: https://mmfit.github.io/
