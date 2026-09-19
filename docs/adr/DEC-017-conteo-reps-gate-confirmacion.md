# DEC-017 · Conteo de reps: gate obligatorio por confirmación de cima/fondo

- **Estado:** Aceptada
- **Fecha:** 2026-05-15
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** analysis-core, curl, sentadilla

## Contexto y problema

Al probar el curl en celular se detectó que movimientos bruscos del dispositivo o la aparición momentánea de un brazo en frame disparaban reps falsas. El ángulo del codo puede saltar de 165° a 45° y volver en 2 frames por ruido o movimiento de cámara, cumpliendo la condición `flexed → extended` sin que el usuario haya hecho ningún curl.

### Raíz del problema

El conteo de reps solo chequeaba la transición de fase (`flexed → extended`), pero no si el movimiento había sido validado como intencional. El mecanismo de confirmación (`topFired` / `bottomFired`) ya existía para detectar el punto extremo del movimiento, pero no estaba siendo usado como prerequisito del conteo.

### Consecuencia secundaria

Sin `topFired`, `curlFormFeedbackRef` estaba vacío cuando el conteo disparaba → el usuario solo escuchaba el número, sin evaluación de forma.

## Opciones consideradas

1. **Contar la rep solo por transición de fase (`flexed → extended`)** (comportamiento original) — vulnerable a saltos de ángulo por ruido o movimiento de cámara; dispara reps falsas y deja `curlFormFeedbackRef` vacío.
2. **Usar el flag de confirmación de punto extremo (`topFired` / `bottomFired`) como gate obligatorio del conteo** (elegida) — reutiliza el mecanismo de confirmación ya existente como prerequisito del `reps++`.

## Decisión

### Solución

Agregar `&& this.topFired` (curl) / `&& this.bottomFired` (sentadilla, aplicar en futura revisión) al condicional de `reps++`. Una rep solo se registra si previamente se confirmó el punto extremo del movimiento mediante N frames consecutivos de tendencia sostenida.

### Garantía resultante

`atTop` siempre ocurre ANTES de `reps++` (son eventos excluyentes en el mismo frame; `topFired` solo se resetea en el mismo frame que `reps++`). Esto garantiza que `curlFormFeedbackRef` siempre tiene el mensaje de forma cuando el conteo dispara.

### Patrón para todos los ejercicios

Todo tracker debe tener un flag `peakConfirmed` (o `topFired`/`bottomFired`) que actúe como gate del conteo. Nunca contar una rep solo por transición de fase.

## Consecuencias

### Positivas

- Movimientos bruscos del dispositivo o la aparición momentánea de un brazo en frame ya no disparan reps falsas.
- `curlFormFeedbackRef` siempre tiene el mensaje de forma cuando el conteo dispara, por lo que el usuario recibe número y evaluación de forma.
- Se reutiliza el mecanismo de confirmación existente (`topFired` / `bottomFired`) sin agregar lógica nueva.
- Queda enunciado un patrón obligatorio para todos los trackers: nunca contar una rep solo por transición de fase.

### Negativas

- El gate `bottomFired` en sentadilla quedó pendiente ("aplicar en futura revisión") en el momento de la decisión.
- Una rep ejecutada sin que se confirme el punto extremo mediante N frames consecutivos de tendencia sostenida no se contará.

## Referencias

- `DEC-014` (detección de fondo `bottomFired` en sentadilla).
- `DEC-015` (curl de bíceps, ejercicio donde se detectó el bug).
- `DEC-016` (confirmación por N frames consecutivos y `curlFormFeedbackRef`).
- `DEC-018` (press de hombro aplica `peakFired` como gate del conteo siguiendo este patrón).
- `src/exercises/bicepCurl.ts`
- `src/exercises/squat.ts`
- `src/ui/CameraView.tsx`
- Nota (2026-09-19): el gate `bottomFired` ya está aplicado en `src/exercises/squat.ts` (`prevPhase === 'squatting' && this.phase === 'standing' && this.bottomFired`).
