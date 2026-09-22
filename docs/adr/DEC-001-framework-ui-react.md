# DEC-001 · Framework UI: React

- **Estado:** Aceptada
- **Fecha:** 2026-04-29
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** ui

## Contexto y problema

El proyecto necesita un framework para construir la interfaz. El anteproyecto dejaba abierta la elección entre React y Vue.

## Opciones consideradas

1. **React** (elegida) — mayor cantidad de ejemplos y referencias de integración con MediaPipe en GitHub.
2. **Vue 3 (Composition API)** — técnicamente viable, pero con menos ejemplos del stack específico (Vue + MediaPipe).

## Decisión

React tiene mayor cantidad de ejemplos y referencias de integración con MediaPipe en GitHub, lo que reduce el riesgo de bloquearse al integrar la detección de poses. Ambos son viables técnicamente; el criterio fue disponibilidad de ejemplos del stack específico.

## Consecuencias

### Positivas

- Se reduce el riesgo de bloquearse al integrar la detección de poses, gracias a la mayor cantidad de ejemplos y referencias de integración React + MediaPipe disponibles en GitHub.
- La elección cierra la incógnita que el anteproyecto dejaba abierta (React vs. Vue).

### Negativas

- Se descarta Vue 3 (Composition API) pese a ser técnicamente viable; el criterio de decisión fue la disponibilidad de ejemplos del stack específico, no una ventaja técnica intrínseca del framework.

## Referencias

- `DEC-002` (build tool para el proyecto React).
- `DEC-004` (API de MediaPipe cuya integración motivó el criterio de elección).
