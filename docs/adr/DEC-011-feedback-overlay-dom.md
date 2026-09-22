# DEC-011 · Feedback de ejercicio: overlay DOM sobre canvas (no dibujo en canvas)

- **Estado:** Aceptada
- **Fecha:** 2026-05-06
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** feedback, ui

## Contexto y problema

El contador de reps y el mensaje de feedback necesitan renderizarse sobre el video. Dos opciones principales: (a) dibujar texto/formas directamente en el canvas 2D junto al esqueleto, o (b) un componente React superpuesto con `position: absolute`.

## Opciones consideradas

1. **Canvas 2D con `ctx.fillText()` y `ctx.fillRect()` para fondo/texto** — requiere código de layout manual en canvas.
2. **Componente DOM con `position: absolute; z-index: 5; pointer-events: none`** (elegida).

## Decisión

El overlay DOM permite usar backdrop-filter blur, border-radius y las mismas fuentes del sistema que usa el onboarding, sin código de layout manual en canvas. El `pointer-events: none` en el contenedor del overlay garantiza que los toques pasen al botón de cambio de cámara (z-index: 10). El re-render de React a ~60fps es aceptable para actualizar un número y un string; React solo modifica los nodos del DOM que cambiaron.

### Estado en RAF

`setExerciseResult()` se llama cada frame. Se decidió no throttlear por ahora — el contador debe ser inmediato. Si en celulares de gama baja aparece jank, el primer paso sería memoizar el componente con `React.memo`.

## Consecuencias

### Positivas

- Se pueden usar backdrop-filter blur, border-radius y las mismas fuentes del sistema que usa el onboarding, sin código de layout manual en canvas.
- `pointer-events: none` garantiza que los toques pasen al botón de cambio de cámara (z-index: 10).
- El contador es inmediato: `setExerciseResult()` se actualiza cada frame sin throttle.
- React solo modifica los nodos del DOM que cambiaron.

### Negativas

- El componente se re-renderiza a ~60fps porque `setExerciseResult()` se llama cada frame; aceptable para un número y un string, pero en celulares de gama baja podría aparecer jank.
- Si aparece jank, hará falta intervenir (primer paso: memoizar el componente con `React.memo`).

## Referencias

- `DEC-012` (diseño visual del overlay como barra inferior).
- `DEC-008` (onboarding cuyas fuentes del sistema reutiliza el overlay).
- `src/ui/ExerciseOverlay.tsx`
- `src/ui/CameraView.tsx`
