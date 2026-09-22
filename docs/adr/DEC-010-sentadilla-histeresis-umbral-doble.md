# DEC-010 · Máquina de estados de sentadilla: histéresis de umbral doble

- **Estado:** Aceptada
- **Fecha:** 2026-05-06
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** analysis-core

## Contexto y problema

Detectar la fase "abajo" / "arriba" de la sentadilla a partir del ángulo de rodilla. Una solución naive con un único umbral genera "flutter" (oscilación rápida entre estados) cuando el ángulo oscila alrededor del umbral por ruido en los landmarks.

## Opciones consideradas

1. **Umbral único con debounce por tiempo** — introduce parámetros de tiempo y latencia artificial.
2. **Promedio de N frames** — introduce latencia artificial.
3. **Histéresis con umbral doble (zona muerta)** (elegida) — solución estándar para máquinas de estados con señales ruidosas.

## Decisión

La histéresis con zona muerta (100°–160°) es la solución estándar para máquinas de estados con señales ruidosas. La zona intermedia conserva el estado anterior, eliminando el flutter sin introducir latencia artificial. Es determinista, sin parámetros de tiempo y comprensible por cualquier integrante del equipo.

### Umbrales

`STANDING_ANGLE = 160°` (entrada al estado "de pie"), `BOTTOM_ANGLE = 100°` (entrada al estado "abajo"), `GOOD_DEPTH_ANGLE = 90°` (feedback verde). Calibrados empíricamente para sentadilla estándar con vista lateral o de 45°.

### Conteo de reps

Transición `squatting → standing` = +1 rep. Esto garantiza que la rep se cuente solo cuando el usuario vuelve a la posición alta completa.

## Consecuencias

### Positivas

- Se elimina el flutter (oscilación rápida entre estados) sin introducir latencia artificial.
- La solución es determinista, sin parámetros de tiempo y comprensible por cualquier integrante del equipo.
- La rep se cuenta solo cuando el usuario vuelve a la posición alta completa (`squatting → standing`).

### Negativas

- Los umbrales (`STANDING_ANGLE = 160°`, `BOTTOM_ANGLE = 100°`, `GOOD_DEPTH_ANGLE = 90°`) están calibrados empíricamente para sentadilla estándar con vista lateral o de 45°; otras vistas o variantes pueden requerir recalibración.
- El conteo depende únicamente de la transición de fase; no valida que el movimiento haya alcanzado el fondo real (ver `DEC-014` y `DEC-017`).

## Referencias

- `DEC-009` (cálculo del ángulo de rodilla que alimenta la máquina de estados).
- `DEC-014` (detección del fondo real sobre esta máquina de estados).
- `DEC-017` (gate de conteo por confirmación de fondo, pendiente de aplicar a la sentadilla).
- `src/exercises/squat.ts`
