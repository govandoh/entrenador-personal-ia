# DEC-012 · Overlay de feedback: barra inferior de ancho completo con CSS custom property

- **Estado:** Aceptada
- **Fecha:** 2026-05-06
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** feedback, ui

## Contexto y problema

La pill original (fondo 18% de opacidad, texto pequeño) era poco visible sobre el video en condiciones de luz variable. El rep counter separado requería que el usuario mirara dos zonas distintas de la pantalla.

## Opciones consideradas

1. **Mantener pill + counter separados pero hacerlos más grandes** — sigue obligando a mirar dos zonas distintas de la pantalla.
2. **Overlay semitransparente sobre toda la pantalla.**
3. **Barra inferior de ancho completo con el mensaje y el counter en la misma fila** (elegida).

## Decisión

La barra inferior unifica en un solo bloque toda la información relevante (mensaje + reps). El fondo oscuro al 80% con `backdrop-filter: blur(16px)` garantiza legibilidad sobre cualquier fondo de video. El borde izquierdo colorido (`border-left: 5px solid var(--feedback-color)`) da la señal semántica de color sin depender de que el usuario lea el texto. El counter a la derecha es inmediatamente reconocible como número de reps (patrón establecido por Peloton, Apple Fitness+). La animación pop en el counter (`key={result.reps}` → remount de React → reinicio de `@keyframes`) da feedback inmediato de que la rep fue registrada.

## Consecuencias

### Positivas

- Toda la información relevante (mensaje + reps) queda unificada en un solo bloque; el usuario ya no mira dos zonas distintas.
- El fondo oscuro al 80% con `backdrop-filter: blur(16px)` garantiza legibilidad sobre cualquier fondo de video, en condiciones de luz variable.
- El borde izquierdo (`border-left: 5px solid var(--feedback-color)`) transmite la señal semántica de color sin depender de la lectura del texto.
- El counter a la derecha sigue un patrón reconocible (Peloton, Apple Fitness+).
- La animación pop (`key={result.reps}`) da feedback inmediato de que la rep fue registrada.

### Negativas

- La barra de ancho completo ocupa de forma permanente la franja inferior del video.
- La animación pop se implementa forzando un remount de React del counter en cada rep (`key={result.reps}`), en lugar de reutilizar el nodo existente.

## Referencias

- `DEC-011` (decisión de renderizar el feedback como overlay DOM, base de esta barra).
- `DEC-008` (CTA naranja `#FC4C02` y design system compartido con el onboarding).
- `src/ui/ExerciseOverlay.tsx`
