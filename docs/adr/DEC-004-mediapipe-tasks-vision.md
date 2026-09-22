# DEC-004 · API de MediaPipe: @mediapipe/tasks-vision (Tasks API)

- **Estado:** Aceptada
- **Fecha:** 2026-04-29
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** pose-engine

## Contexto y problema

MediaPipe tiene dos APIs JS: la legacy (`@mediapipe/pose`) y la moderna (`@mediapipe/tasks-vision`).

## Opciones consideradas

1. **`@mediapipe/tasks-vision` (Tasks API)** (elegida) — API unificada actual, con `PoseLandmarker` en modo `VIDEO` optimizado para streams de cámara y `DrawingUtils` incluido.
2. **`@mediapipe/pose`** — API legacy, basada en callbacks y archivos `.wasm` separados por solución; en modo solo-mantenimiento y con documentación oficial que ya no recibe actualizaciones.

## Decisión

La API legacy está en modo solo-mantenimiento y su documentación oficial ya no recibe actualizaciones. `@mediapipe/tasks-vision` es la API unificada actual, tiene `PoseLandmarker` con modo `VIDEO` optimizado para streams de cámara, e incluye `DrawingUtils` para renderizar el esqueleto sin código manual de canvas. El modo `VIDEO` de `detectForVideo(video, timestampMs)` está diseñado específicamente para el patrón `requestAnimationFrame`.

## Consecuencias

### Positivas

- Se usa la API unificada actual de MediaPipe, con documentación mantenida, en lugar de una API legacy en modo solo-mantenimiento.
- `PoseLandmarker` con modo `VIDEO` está optimizado para streams de cámara, y `detectForVideo(video, timestampMs)` encaja directamente con el patrón `requestAnimationFrame`.
- `DrawingUtils` permite renderizar el esqueleto sin código manual de canvas.

### Negativas

- Los archivos WASM de la Tasks API deben estar disponibles en tiempo de ejecución, lo que obliga a decidir cómo servirlos (ver `DEC-005`).

## Referencias

- `DEC-005` (carga del WASM de MediaPipe desde CDN).
- `DEC-003` (tipado de los landmarks que devuelve la API).
- `src/pose/poseDetector.ts`
