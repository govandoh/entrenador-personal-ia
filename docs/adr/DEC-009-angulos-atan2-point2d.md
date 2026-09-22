# DEC-009 · Cálculo de ángulos: atan2 con tipo propio Point2D

- **Estado:** Aceptada
- **Fecha:** 2026-05-06
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** analysis-core, geometria

## Contexto y problema

La función de cálculo angular necesita recibir landmarks de MediaPipe pero `geometry/angles.ts` no debería depender del paquete `@mediapipe/tasks-vision` para mantenerse aislado y testeable.

## Opciones consideradas

1. **Importar `NormalizedLandmark` directamente** — introduce dependencia de `@mediapipe/tasks-vision` en el módulo de geometría.
2. **Usar un tipo local compatible estructuralmente** (elegida) — `Point2D { x, y }` definido en el propio módulo.
3. **Recibir `x, y` como parámetros separados.**

## Decisión

Se define `Point2D { x, y }` en el propio módulo. `NormalizedLandmark` tiene `x`, `y`, `z`, `visibility` — es compatible estructuralmente, así que puede pasarse donde se espera `Point2D` sin casting. El módulo de geometría queda sin dependencias externas, lo que facilita pruebas unitarias aisladas.

### Fórmula

`atan2(Cy−By, Cx−Bx) − atan2(Ay−By, Ax−Bx)`, valor absoluto, espejo si > 180°. Rango de salida: 0–180°.

## Consecuencias

### Positivas

- El módulo de geometría queda sin dependencias externas, lo que facilita pruebas unitarias aisladas.
- `NormalizedLandmark` puede pasarse donde se espera `Point2D` sin casting, por compatibilidad estructural.
- El rango de salida queda acotado a 0–180°.

### Negativas

- El cálculo usa únicamente `x` e `y`; la coordenada `z` y `visibility` de `NormalizedLandmark` no intervienen en el ángulo.

## Referencias

- `DEC-003` (tipado de landmarks con `x`, `y`, `z`, `visibility`).
- `DEC-004` (paquete `@mediapipe/tasks-vision` del que se evita depender).
- `DEC-010` (máquina de estados que consume el ángulo de rodilla calculado aquí).
- `src/geometry/angles.ts`
