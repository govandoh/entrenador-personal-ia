# DEC-015 · Curl de bíceps: detección de cima por inversión de tendencia + soporte frontal/lateral

- **Estado:** Aceptada
- **Fecha:** 2026-05-15
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** analysis-core, curl

## Contexto y problema

Segundo ejercicio de la app. El curl de bíceps puede ejecutarse con la cámara frontal (vista de frente, ambos brazos visibles) o lateral (perfil, un solo brazo dominante en frame). Necesitaba decidir cómo manejar ambas vistas con un único tracker.

## Opciones consideradas

1. **Dos trackers separados** (uno para cada brazo) con lógica de selección manual.
2. **Un único tracker que detecta automáticamente el modo de vista** (elegida).
3. **Pedir al usuario que indique si usa vista frontal o lateral.**

## Decisión

### Razón

Se implementó detección automática de vista por diferencia de visibilidad: si `|visibilidad_izquierda - visibilidad_derecha| > 0.35`, la app infiere vista lateral y usa solo el brazo más visible. Si la diferencia es menor, usa ambos brazos (vista frontal o de 45°). El umbral 0.35 es empírico — un brazo mirando de frente al objetivo es significativamente más visible que el opuesto.

### Detección de cima

Igual que el fondo en sentadillas — inversión de tendencia (+2°). El ángulo de codo sube durante la contracción (menor grado = más contraído); cuando el ángulo vuelve a crecer más de 2°, se confirma que se pasó la cima. `GOOD_FORM_ANGLE = 50°` es el umbral de "contracción completa".

### Ángulos

- `EXTENDED_ANGLE = 160°` (brazo extendido).
- `FLEXED_ANGLE = 60°` (entrada a fase contraída).
- `GOOD_FORM_ANGLE = 50°` (contracción completa).

### Conteo de reps

Cada `ArmTracker` cuenta sus propias reps; `BicepCurlTracker` suma ambos. Esto permite contar reps alternas (curl con mancuernas alternando brazos) y reps simultáneas (barra).

## Consecuencias

### Positivas

- Un único tracker cubre vista frontal, de 45° y lateral sin intervención del usuario.
- La detección de cima reutiliza el mecanismo de inversión de tendencia ya validado en sentadilla (`DEC-014`).
- El conteo por `ArmTracker` permite contar reps alternas (mancuernas alternando brazos) y reps simultáneas (barra).

### Negativas

- El umbral 0.35 de diferencia de visibilidad es empírico y no está validado en una muestra amplia de dispositivos ni condiciones de luz.
- La inversión de tendencia de +2° en un solo frame resultó insuficiente para landmarks de brazo, que tienen más ruido que los de pierna (corregido en `DEC-016`).
- Sumar las reps de ambos `ArmTracker` duplica el conteo en curls bilaterales simultáneos (corregido en `DEC-022`).

## Referencias

- `DEC-014` (detección de fondo por inversión de tendencia en sentadilla, patrón reutilizado aquí).
- `DEC-016` (confirmación por frames consecutivos que reemplaza el umbral de un solo frame).
- `DEC-017` (gate de conteo por confirmación de cima).
- `DEC-022` (conteo unificado que reemplaza la suma de contadores por brazo).
- `src/exercises/bicepCurl.ts`
