# DEC-018 · Press de Hombro: ángulos seguros, polaridad invertida y detección de pico

- **Estado:** Aceptada
- **Fecha:** 2026-05-15
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** analysis-core, press, voz

## Contexto y problema

Tercer ejercicio. El shoulder press usa los mismos landmarks que el curl (shoulder-elbow-wrist), pero la polaridad del movimiento es inversa: el esfuerzo AUMENTA el ángulo del codo (pesas overhead = ángulo alto ≈ 150-165°). El pico del movimiento es el MÁXIMO de ángulo, no el mínimo.

## Opciones consideradas

1. **Exigir lockout de 170°+ para feedback verde** — exige hiperextensión del codo bajo carga; además MediaPipe tiende a subestimar ligeramente el ángulo en vista frontal.
2. **`GOOD_LOCKOUT_ANGLE = 145°` como mínimo para feedback verde** (elegida) — no exige hiperextensión y compensa la subestimación de MediaPipe.
3. **Usar `Math.min(left, right)` como ángulo primario, igual que el curl** — en el curl menor = más contraído, pero en el press el brazo más extendido es el que indica la calidad del movimiento.
4. **Usar `Math.max(left, right)` como ángulo primario** (elegida) — el brazo más extendido indica la calidad del press.
5. **Detección de pico análoga al curl pero invertida** (elegida) — `fallingFrames`, `maxAngleSeen` y `peakFired` como gate del conteo, siguiendo `DEC-016` y `DEC-017`.

## Decisión

### Umbrales y justificación clínica

- `PRESSED_ANGLE = 150°`: entrada a fase "pressed". Zona de histéresis: 100°–150° (50° de zona muerta).
- `LOWERED_ANGLE = 100°`: entrada a fase "lowered" (pesas a nivel de hombro, codo ≈ 90°).
- `GOOD_LOCKOUT_ANGLE = 145°`: mínimo para feedback verde. Se usa 145° en lugar de 170°+ para no exigir hiperextensión del codo bajo carga; MediaPipe también tiende a subestimar ligeramente el ángulo en vista frontal.
- `SAFE_LOW_ANGLE = 80°`: feedback rojo por debajo de este valor. Bajar el codo por debajo de la línea del hombro con carga externa comprime el tendón supraespinoso entre el acromion y la cabeza humeral (síndrome de impingement). 80° es el límite clínico conservador para press frontal.

### Detección de pico

Análoga al curl pero invertida. `fallingFrames` cuenta frames donde el ángulo desciende ≥ 0.5°/frame; `atPeak` se confirma con 3 frames consecutivos. `maxAngleSeen` acumula el máximo (vs. `minAngleSeen` del curl). `peakFired` actúa como gate del conteo (DEC-017).

### Ángulo primario

`Math.max(left, right)` — el brazo más extendido indica la calidad del press (vs. `Math.min` del curl donde menor = más contraído).

### Estrategia de voz

Clasificado como "pico al fin del esfuerzo" (DEC-016): `atPeak` guarda en `pressFormFeedbackRef`, `reps++` emite utterance combinado `"${n}. ¡Extensión completa!"`.

## Consecuencias

### Positivas

- Los umbrales tienen justificación clínica explícita: `SAFE_LOW_ANGLE = 80°` protege contra el síndrome de impingement y `GOOD_LOCKOUT_ANGLE = 145°` evita exigir hiperextensión del codo bajo carga.
- La zona de histéresis de 50° (100°–150°) evita flutter entre fases.
- Reutiliza el mecanismo de confirmación por frames consecutivos (`DEC-016`) y el gate de conteo (`DEC-017`), con la polaridad invertida.
- La voz emite un único utterance combinado (número + forma) sin colisiones, conforme a `DEC-016`.

### Negativas

- El valor de 145° compensa una subestimación de MediaPipe en vista frontal que no está cuantificada; puede requerir recalibración en otras vistas.
- La detección de pico hereda los mismos parámetros del curl (0.5°/frame, 3 frames consecutivos) sin calibración específica para el press.
- Se implementó antes de la corrección del conteo por brazo del curl (`DEC-022`), por lo que arrastró el mismo bug de conteo duplicado en press bilateral (corregido en `DEC-023`).

## Referencias

- `DEC-015` (curl de bíceps, cuyo mecanismo de detección se invierte aquí).
- `DEC-016` (clasificación "pico al fin del esfuerzo" y utterance combinado).
- `DEC-017` (`peakFired` como gate del conteo).
- `DEC-023` (corrección posterior del conteo unificado en press).
- `src/exercises/shoulderPress.ts`
- `src/ui/CameraView.tsx`
