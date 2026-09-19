# DEC-016 · Arquitectura de feedback de voz: confirmación por frames y prioridad sin colisiones

- **Estado:** Aceptada
- **Fecha:** 2026-05-15
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** feedback, voz, analysis-core

## Contexto y problema

Durante pruebas del curl de bíceps se detectaron dos problemas: (1) la voz disparaba con pequeños movimientos de ruido de MediaPipe, dando feedback incorrecto antes de que el usuario completara la contracción; (2) el feedback de forma (`atTop`/`atBottom`) y el conteo de reps (`reps > prevReps`) disparaban en secuencia rápida, y como `useSpeech` cancela la locución anterior, el conteo cortaba el feedback de forma o viceversa.

### Raíz del problema 1

`DESCENDING_THRESHOLD = 2°` en un solo frame es insuficiente para landmarks de brazo, que tienen más ruido que los de pierna. Un spike de ruido de 3° confirma falsamente que se pasó la cima.

### Raíz del problema 2

Para el curl, `atTop` y `reps++` ocurren dentro de ~200ms (la confirmación de cima precede en pocos frames a la extensión completa). `speechSynthesis.cancel()` en `useSpeech` hace que el último utterance siempre gane, suprimiendo el primero.

## Opciones consideradas

1. **Umbral de un solo frame (`DESCENDING_THRESHOLD = 2°`)** (comportamiento original) — insuficiente para landmarks de brazo; un spike de ruido de 3° confirma falsamente que se pasó la cima.
2. **Confirmación por frames consecutivos (`MIN_RISING_FRAMES = 3`)** (elegida) — reemplaza el threshold de un frame por un contador `risingFrames`, filtrando spikes de ruido sin latencia perceptible.
3. **Dejar que `atTop`/`atBottom` y `reps++` hablen de forma independiente** (comportamiento original) — como `useSpeech` cancela la locución anterior, el último utterance siempre gana y suprime el primero.
4. **Estrategia de voz por tipo de ejercicio** (elegida) — utterance combinado cuando el peak/bottom es el fin del esfuerzo; voz inmediata en el fondo más cooldown de 1500ms en el conteo cuando el peak/bottom es el punto medio del recorrido.

## Decisión

### Solución 1 — Confirmación por frames consecutivos

Reemplazar el threshold de un frame por un contador de `risingFrames`. `atTop` solo se confirma después de `MIN_RISING_FRAMES = 3` frames consecutivos donde `angle > prevAngle + 0.5°`. Esto requiere ~50ms de tendencia sostenida a 60fps, filtrando spikes de ruido sin latencia perceptible. El parámetro `MIN_RISING_FRAMES` puede calibrarse por ejercicio según el ruido esperado del joint (brazo > pierna).

### Solución 2 — Estrategia por tipo de ejercicio

- **Ejercicios cuyo peak/bottom es el fin del esfuerzo** (curl, press de hombro): `atTop` no habla; guarda el mensaje en un ref `curlFormFeedbackRef`. Cuando `reps++`, se emite un único utterance combinado: `"3. ¡Excelente contracción!"`. Sin colisión posible.
- **Ejercicios cuyo peak/bottom es el punto medio del recorrido** (sentadilla, lunge): `atBottom` habla de inmediato (el feedback "baja más" es accionable mientras el usuario sigue abajo). Cuando `reps++`, se respeta un cooldown de 1500ms desde la última locución; si está dentro del cooldown, el conteo de esa rep se suprime (el usuario ya recibió audio en ese ciclo).

### Patrón para futuros ejercicios

Al diseñar cada ejercicio, clasificar el peak/bottom según si ocurre al fin del esfuerzo o a mitad, y elegir la estrategia correspondiente. Documentar la clasificación en el tracker del ejercicio.

## Consecuencias

### Positivas

- Los spikes de ruido de MediaPipe ya no confirman falsamente la cima: se exige ~50ms de tendencia sostenida a 60fps, sin latencia perceptible.
- `MIN_RISING_FRAMES` es calibrable por ejercicio según el ruido esperado del joint (brazo > pierna).
- En curl y press de hombro el feedback de forma y el número de rep se emiten en un único utterance combinado, sin colisión posible.
- En sentadilla y lunge el feedback "baja más" sigue siendo accionable mientras el usuario está abajo.
- Queda enunciado un patrón explícito para clasificar y documentar cada ejercicio futuro.

### Negativas

- Impacto en el código: `ArmTracker` agrega `risingFrames: number` al estado; `CameraView` agrega `curlFormFeedbackRef` y `lastSpeakTimeRef`.
- En ejercicios de punto medio (sentadilla, lunge), si `reps++` cae dentro del cooldown de 1500ms desde la última locución, el conteo de esa rep se suprime por voz (el usuario ya recibió audio en ese ciclo).
- Cada ejercicio nuevo exige clasificar su peak/bottom y documentar la estrategia en su tracker; es un paso manual que puede omitirse por descuido.

## Referencias

- `DEC-013` (hook `useSpeech` con `speechSynthesis.cancel()` que origina la colisión).
- `DEC-014` (inversión de tendencia +2° en sentadilla, origen del `DESCENDING_THRESHOLD`).
- `DEC-015` (curl de bíceps, ejercicio donde se detectaron ambos problemas).
- `DEC-017` (gate de conteo que garantiza que `curlFormFeedbackRef` tenga mensaje al contar).
- `DEC-018` (press de hombro, clasificado como "pico al fin del esfuerzo" según esta decisión).
- `src/exercises/bicepCurl.ts`
- `src/ui/CameraView.tsx`
