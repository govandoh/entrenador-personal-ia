# DEC-005 · Carga del WASM de MediaPipe: CDN (jsDelivr)

- **Estado:** Aceptada
- **Fecha:** 2026-04-29
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** pose-engine, build

## Contexto y problema

Los archivos WASM de MediaPipe deben estar disponibles en tiempo de ejecución. Pueden servirse localmente (bundleados con Vite) o desde CDN.

## Opciones consideradas

1. **CDN jsDelivr con versión fijada** (elegida) — ruta recomendada en la documentación oficial de MediaPipe; elimina la configuración de bundleo de WASM.
2. **Copiar los archivos `.wasm` a `public/` y servirlos localmente** — requiere configuración no trivial en Vite 8 (`assetsInlineLimit`, `optimizeDeps.exclude`, headers COOP/COEP para SharedArrayBuffer).

## Decisión

Bundlear WASM con Vite 8 requiere configuración no trivial (`assetsInlineLimit`, `optimizeDeps.exclude`, headers COOP/COEP para SharedArrayBuffer). Usar jsDelivr con versión fijada (`@0.10.22/wasm`) es la ruta recomendada en la documentación oficial de MediaPipe y elimina ese problema por completo. La desventaja es que requiere conexión a internet en el primer uso; aceptable para el alcance del proyecto.

### Versión fijada

`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm`

## Consecuencias

### Positivas

- Se elimina por completo la configuración no trivial de bundleo de WASM en Vite 8 (`assetsInlineLimit`, `optimizeDeps.exclude`, headers COOP/COEP para SharedArrayBuffer).
- Se sigue la ruta recomendada en la documentación oficial de MediaPipe.
- La versión fijada en la URL evita cambios inesperados del WASM entre despliegues.

### Negativas

- Requiere conexión a internet en el primer uso; aceptable para el alcance del proyecto.

## Referencias

- `DEC-004` (API `@mediapipe/tasks-vision` cuyo WASM se carga desde el CDN).
- `DEC-002` (Vite 8, cuya configuración de WASM se evita con esta decisión).
- `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm`
- `src/pose/poseDetector.ts`
- Nota (2026-09-19): el código actual fija `@mediapipe/tasks-vision@0.10.35` en `src/pose/poseDetector.ts`; la versión 0.10.22 citada arriba fue la del momento de la decisión.
