# DEC-003 · Lenguaje: TypeScript

- **Estado:** Aceptada
- **Fecha:** 2026-04-29
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** lenguaje

## Contexto y problema

El stack base es JavaScript; TypeScript es opcional pero suma tipado estático.

## Opciones consideradas

1. **TypeScript** (elegida) — tipado estático explícito; el equipo asume la curva de aprendizaje.
2. **JavaScript (ES2020+) plano** — sin curva de aprendizaje adicional, pero sin tipos para la estructura fija de landmarks que devuelve MediaPipe.

## Decisión

El equipo evaluó la curva de aprendizaje y decidió asumirla. El tipado explícito es especialmente valioso en este proyecto porque MediaPipe devuelve arrays de landmarks con estructura fija (33 puntos, cada uno con `x`, `y`, `z`, `visibility`); tener esos tipos definidos desde el inicio previene bugs silenciosos en los cálculos angulares.

## Consecuencias

### Positivas

- Los tipos de los landmarks de MediaPipe (33 puntos, cada uno con `x`, `y`, `z`, `visibility`) quedan definidos desde el inicio.
- Se previenen bugs silenciosos en los cálculos angulares gracias al tipado explícito.

### Negativas

- El equipo asume la curva de aprendizaje de TypeScript.

## Referencias

- `DEC-002` (template `react-ts` de Vite que incorpora TypeScript).
- `DEC-004` (API de MediaPipe que devuelve los landmarks tipados).
- `DEC-009` (cálculo de ángulos, donde el tipado de landmarks se aprovecha con `Point2D`).
