# DEC-057 · Motor de conteo 3D configurable por ejercicio, activable con `?engine=3d` mientras se valida en celular

- **Estado:** Aceptada
- **Fecha:** 2026-09-24
- **Decisores:** responsable del proyecto; lead del workstream B (Análisis & Runtime)
- **Etiquetas:** analysis-core, golden, metricas

## Contexto y problema

El paso I-2 de `DEC-054` (issue #33) trae los contadores 3D de fitnetv2. El análisis de ese código mostró:

- **Tres copias del mismo algoritmo.** `SquatTracker`, `BicepCurlTracker` y `ShoulderPressTracker` repiten el mismo esquema (visibilidad → ángulo → histéresis → validación temporal → fatiga → feedback) con polaridad distinta. Con las olas de `DEC-056`, cada ejercicio nuevo sería otra copia.
- **Defectos:**
  - pico confirmado por frames (`0.5°/frame × 3`) y cooldown de 15 frames, dependientes de los fps;
  - la fatiga recibe una asimetría ≈ 0;
  - el arqueo del press se evalúa sin cadera visible y en todas las fases;
  - la calibración de pie absorbe un arqueo moderado.
- **Riesgo de desplegar sin probar.** Los contadores 3D necesitan `worldLandmarks` nivelados, y nada de eso se ha probado aún en celulares de este repositorio. Sustituir los contadores 2D de producción sin esa prueba rompería la regla "probar en celular es la verdad".
- **Pendientes de #33 que exigen decisión:**
  - el umbral de inclinación del tronco en sentadilla: `METRICS.md` dice 45°, fitnetv2 usa 55°;
  - dos fórmulas de fatiga;
  - los pesos de `elbow_drift` y `lumbar_arch`.

## Opciones consideradas

1. **Portar las tres clases tal cual y sustituir las 2D.** Rápido, pero hereda los defectos y la duplicación, y cambia producción sin validar en celular.
2. **Motor genérico, sustituyendo las 2D de inmediato.** Resuelve la duplicación, pero sigue cambiando producción sin validar.
3. **Motor genérico que convive con el 2D detrás de un flag** (elegida).

## Decisión

### Motor

- `CycleDetector` (`src/analysis/cycleDetector.ts`): histéresis de doble umbral (DEC-010), pico o fondo confirmado cuando el ángulo se aleja **8°** del extremo (DEC-044, ahora para los tres ejercicios), polaridad `min`/`max` y gate de recorrido inicial opcional (DEC-017).
- `Tracker3D` + `ExerciseDefinition3D` (`src/exercises/tracker3d.ts`, `definitions3d.ts`): un motor y una definición por ejercicio. Cada definición declara:
  - lados, landmarks y ángulo primario;
  - umbrales de ciclo y de calidad temporal;
  - comprobaciones de forma, indicando en qué fase aplican y qué landmarks exigen;
  - feedback por fase;
  - si la calibración puede aprender con la serie empezada.
- Curl y press usan un detector por brazo y cuentan con OR y **cooldown de 250 ms**, que equivale a los 15 frames a 60 fps de DEC-022 pero ahora no depende de los fps.
- La fatiga recibe la **asimetría del punto de esfuerzo**.
- `lumbar_arch` en el press exige **cadera visible** y **brazos por encima del reposo**.
- El contador emite el **frame clave** (la pose en el extremo del ciclo) junto con el evento de pico: es la entrada del k-NN (DEC-055).
- `FramePipeline` (`src/analysis/framePipeline.ts`) encadena suavizado → nivelación → calibración → contador. La calibración aprende solo en reposo; en el press, solo antes de la primera repetición de cada serie.

### Convivencia

- El motor 3D se activa con **`?engine=3d`** en la URL. Sin el flag, la app usa los contadores 2D de siempre y los golden del PR 1 no cambian.
- El cambio de valor por defecto es un paso aparte, con su propia DEC, cuando el motor 3D pase la prueba en celulares Android e iOS. Ese paso actualiza los golden (fixtures con `world`) y retira los contadores 2D.

### Umbrales y métricas pendientes de #33

- **`trunk_lean` en sentadilla: 55°** (el valor que fitnetv2 ajustó en campo). 45° marcaría como error sentadillas legítimas con barra baja o fémur largo. `METRICS.md` §5.2 se actualiza.
- **Fatiga: dos señales con roles distintos.**
  - `FatigueDetector` (DEC-038) da el nivel **en tiempo real** durante la serie, para el feedback y la sugerencia de descanso. Su `score` es interno y no se persiste.
  - `fatigue_index` de `METRICS.md` §3 sigue siendo la métrica **persistida** por serie, calculada al cerrarla a partir de las repeticiones.
  - Ambas usan la pérdida de velocidad como indicador principal (umbral de referencia 20 %).
- **Pesos de forma:** `elbow_drift` 0,4 y `lumbar_arch` 0,6 quedan aceptados.

## Consecuencias

### Positivas

- La app en producción no cambia; el equipo puede probar el motor 3D en su celular con un parámetro de URL.
- Añadir un ejercicio de las olas es escribir una definición y sus tests, no un tracker.
- 53 tests nuevos (47 del contador, 6 del detector) cubren las comprobaciones de fitnetv2 y cada defecto corregido:
  - curl alterno;
  - descenso lento que fitnetv2 no confirmaba;
  - arqueo sin cadera visible;
  - calibración congelada en el press.

### Negativas

- Hasta el cambio de valor por defecto conviven dos motores y hay que mantener ambos.
- El motor 3D todavía no está validado en celulares reales; la nivelación con sensores tampoco.

## Referencias

- `DEC-054` (paso I-2), `DEC-036`..`DEC-038`, `DEC-044`, `DEC-045`, `DEC-050`, `DEC-053`, `DEC-055`, `DEC-056`.
- fitnetv2: `src/exercises/{squat,bicepCurl,shoulderPress}.ts` (commit d456e95).
- Issue #33.
