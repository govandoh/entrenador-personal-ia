# DEC-014 · Detección de fondo real: mínimo local por giro de ángulo

- **Estado:** Aceptada
- **Fecha:** 2026-05-06
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** analysis-core, sentadilla, voz

## Contexto y problema

La voz disparaba al entrar a la fase "squatting" (primer frame con `kneeAngle < 100°`), no en el punto más bajo real. Esto causaba discrepancia: la voz decía "Baja un poco más" con el ángulo de entrada (~98°), pero el visual luego mostraba verde cuando el usuario llegaba a 85°.

### Raíz del problema

Dos relojes distintos: el visual se actualiza cada frame con el ángulo actual; la voz disparaba una sola vez en la transición de fase, con el ángulo de ese instante preciso.

## Opciones consideradas

1. **Disparar la voz en la transición de fase** (comportamiento original) — la voz se dispara una sola vez al entrar a "squatting" (primer frame con `kneeAngle < 100°`), con el ángulo de ese instante preciso (~98°). Produce discrepancia con el visual, que sí refleja el ángulo real alcanzado (85°).
2. **"bottom = cuando kneeAngle es mínimo"** — el mínimo solo se conoce a posteriori (necesitarías ver el siguiente frame para saber que era el más bajo), por lo que no es detectable en el frame en que ocurre.
3. **Detección de mínimo local por inversión de tendencia (+2°)** (elegida) — el primer frame donde es matemáticamente confirmable que el mínimo ya pasó.

## Decisión

### Solución

Detección de mínimo local por inversión de tendencia. El tracker acumula `minAngleSeen` (mínimo ángulo visto desde que entró a squatting) y detecta el fondo cuando `kneeAngle > prevKneeAngle + 2°` (el ángulo empezó a subir más de 2°). En ese frame exacto: `atBottom = true`, se evalúa `minAngleSeen` y se dispara la voz. La condición estricta `>` (no `>=`) más el umbral de 2° previene falsos positivos por ruido de landmarks.

### Flujo temporal resultante

```
bajando      → silencio (acumulando minAngleSeen)
fondo real   → voz evalúa minAngleSeen: "¡Excelente!" o "Baja más"
subiendo     → silencio
standing     → voz dice solo el número de rep
```

### Por qué no "bottom = cuando kneeAngle es mínimo"

El mínimo solo se conoce a posteriori (necesitarías ver el siguiente frame para saber que era el más bajo). La inversión de tendencia (+2°) es el primer frame donde es matemáticamente confirmable que el mínimo ya pasó.

## Consecuencias

### Positivas

- La voz evalúa el fondo real (`minAngleSeen`) y no el ángulo de entrada a la fase, eliminando la discrepancia entre el feedback auditivo y el visual.
- El fondo se detecta en el primer frame en que es matemáticamente confirmable que el mínimo ya pasó, sin necesidad de esperar frames adicionales.
- La condición estricta `>` más el umbral de 2° previene falsos positivos por ruido de landmarks.
- El flujo temporal queda definido: silencio al bajar y subir, voz solo en el fondo real y al completar la rep.

### Negativas

- El umbral de 2° en un solo frame se calibró para landmarks de pierna; en articulaciones con más ruido (brazo) puede resultar insuficiente y requerir confirmación por varios frames (ver `DEC-016`).
- La detección del fondo ocurre siempre un frame (al menos +2°) después del mínimo real, no en el mínimo exacto.

## Referencias

- `DEC-010` (máquina de estados de sentadilla con histéresis, base sobre la que se aplica esta detección).
- `DEC-013` (retroalimentación por voz que dispara en el fondo).
- `DEC-016` (evolución de la confirmación por inversión de tendencia a confirmación por frames consecutivos).
- `src/exercises/squat.ts`
