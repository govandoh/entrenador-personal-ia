# DEC-023 · Press de hombro: conteo unificado con cooldown (sin conteo por brazo)

- **Estado:** Aceptada
- **Fecha:** 2026-05-16
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** analysis-core, press

## Contexto y problema

El diseño original de `ShoulderPressTracker` mantenía un contador de reps independiente en cada `ArmPressTracker` (`left.reps + right.reps`), igual que el diseño original del curl antes de DEC-022. En press bilateral (ambos brazos simultáneos), cada brazo completaba su ciclo de pressed → lowered y ambos contadores incrementaban, resultando en el doble de reps reales. El bug fue identificado por Codex al auditar el código tras DEC-022.

### Por qué no se detectó antes

El ejercicio se implementó (DEC-018) antes de que el bug del curl se corrigiera (DEC-022); al corregir el curl se documentó el patrón pero no se auditó el press.

## Opciones consideradas

1. **Mantener un contador independiente en cada `ArmPressTracker` (`left.reps + right.reps`)** (diseño original) — duplica las reps en press bilateral.
2. **Aplicar exactamente el mismo patrón de DEC-022: conteo unificado en `ShoulderPressTracker` con OR logic + cooldown de frames** (elegida).

## Decisión

Aplicar exactamente el mismo patrón de DEC-022. `ArmPressTracker` deja de mantener su propio contador y emite `repCompleted: boolean` cuando su ciclo cumple todos los gates (`peakFired` confirmado). `ShoulderPressTracker` tiene el único contador `reps` y lo incrementa con OR logic + cooldown de **15 frames (~250 ms a 60 fps)**.

### Comportamiento resultante

Idéntico al DEC-022: press bilateral = 1 rep; press alterno = 1 rep por brazo; vista lateral = 1 rep por ciclo.

## Consecuencias

### Positivas

- Elimina el conteo duplicado en press bilateral.
- Mantiene la consistencia con el patrón de `DEC-022`, por lo que curl y press comparten el mismo modelo de conteo.
- `repCompleted` solo se emite con `peakFired` confirmado, preservando el gate de `DEC-017`.

### Negativas

- El bug convivió en producción desde `DEC-018` hasta esta corrección porque al corregir el curl no se auditó el press; evidencia la necesidad de auditar todos los trackers cuando se cambia un patrón compartido.
- Hereda el trade-off de `DEC-022`: en press alterno muy rápido (<250 ms entre brazos) el cooldown podría suprimir el segundo brazo.
- El cooldown está expresado en frames (`REP_COOLDOWN_FRAMES = 15`) y asume 60 fps; en dispositivos a 30 fps equivale a ~500 ms. Pendiente de migrar a tiempo real (ver `DEC-027` y `ARCHITECTURE.md`).

## Referencias

- `DEC-017` (`peakFired` como gate del conteo).
- `DEC-018` (implementación original del press de hombro).
- `DEC-022` (patrón de conteo unificado con cooldown que se replica aquí).
- `DEC-027` (migración pendiente del cooldown a tiempo real).
- `ARCHITECTURE.md`
- `src/exercises/shoulderPress.ts`
