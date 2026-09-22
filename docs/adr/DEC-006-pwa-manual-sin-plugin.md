# DEC-006 · PWA implementada manualmente (sin vite-plugin-pwa)

- **Estado:** Aceptada
- **Fecha:** 2026-05-15 (diferida el 2026-04-29)
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** pwa, build

## Contexto y problema

`vite-plugin-pwa` falló por incompatibilidad de peer dependency con Vite 8 (solo soporta hasta Vite 7). Se había diferido para la semana 5-6.

## Opciones consideradas

1. **Downgrade a Vite 7** — riesgo de romper otras dependencias.
2. **`--legacy-peer-deps`** — plug-in sin probar con Vite 8, posibles bugs silenciosos.
3. **Implementación manual del SW + manifest** (elegida).
4. **Workbox CLI** — agrega un paso de build extra y una dependencia de CLI; para un SW de 30 líneas con una sola estrategia, el overhead no está justificado.

## Decisión

Implementación manual. El `public/manifest.json` declara `display: standalone`, `theme_color: #FC4C02`, `background_color: #0a0a0a` y referencia `favicon.svg` como único ícono (escalable SVG, compatible con Chrome/Edge/Firefox; Safari requiere `apple-touch-icon` separado, cubierto con `<link>` en `index.html`). El `public/sw.js` usa estrategia **cache-first para app shell** (mismo origen) y **network-only para CDN externos** (archivos WASM y modelo de MediaPipe son demasiado grandes para el cache del SW; el cache HTTP del browser ya los maneja). El SW se registra en `main.tsx` en el evento `load` para no bloquear el hilo principal durante el arranque. La versión del cache (`CACHE = 'entrenador-ia-v2'`) se sube manualmente con cada deploy para forzar re-descarga en los usuarios con el PWA instalado.

### Por qué no Workbox CLI

Agrega un paso de build extra y una dependencia de CLI. Para un SW de 30 líneas con una sola estrategia, el overhead no está justificado.

## Consecuencias

### Positivas

- La PWA queda operativa sin depender de `vite-plugin-pwa` ni de downgrade a Vite 7 ni de `--legacy-peer-deps`.
- Un único ícono SVG escalable (`favicon.svg`) cubre Chrome/Edge/Firefox; Safari queda cubierto con `apple-touch-icon` vía `<link>` en `index.html`.
- El registro del SW en el evento `load` no bloquea el hilo principal durante el arranque.
- Sin paso de build extra ni dependencia de CLI: el SW es de unas 30 líneas con una sola estrategia.

### Negativas

- La versión del cache (`CACHE = 'entrenador-ia-v2'`) debe subirse manualmente con cada deploy para forzar re-descarga en los usuarios con el PWA instalado.
- Los archivos WASM y el modelo de MediaPipe no se cachean en el SW (network-only) por ser demasiado grandes; dependen del cache HTTP del browser.
- Safari requiere un `apple-touch-icon` separado, adicional al `favicon.svg` del manifest.

## Referencias

- `DEC-002` (Vite 8, origen de la incompatibilidad con `vite-plugin-pwa`).
- `DEC-005` (CDN externo de MediaPipe que el SW trata como network-only).
- `DEC-025` (evolución de la estrategia del SW a network-first para HTML).
- `public/manifest.json`
- `public/sw.js`
- `public/favicon.svg`
- `src/main.tsx`
- `index.html`
- Nota (2026-09-19): la constante `CACHE` actual es `entrenador-ia-v3` (ver `DEC-025`).
