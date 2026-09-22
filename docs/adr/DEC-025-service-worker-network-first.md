# DEC-025 · Service Worker: network-first para HTML, cache-first para assets estáticos

- **Estado:** Aceptada
- **Fecha:** 2026-05-16
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** pwa, deploy

## Contexto y problema

El SW original (`v2`) aplicaba cache-first a todas las requests del mismo origen, incluido `index.html`. `index.html` no tiene hash en su nombre (a diferencia de `assets/index-HASH.js`), por lo que puede quedar cacheado indefinidamente en una versión vieja después de un deploy. Un usuario con la PWA instalada recibiría el HTML antiguo que apunta a assets ya eliminados del servidor, dejando la app inoperable o mostrando versiones obsoletas. El bug fue identificado por Codex.

## Opciones consideradas

1. **Cache-first para todas las requests del mismo origen, incluido `index.html`** (comportamiento original, `v2`) — `index.html` puede quedar cacheado indefinidamente en una versión vieja después de un deploy.
2. **Precaching en `install`** — requiere conocer los nombres de los assets hasheados en tiempo de build. Sin `vite-plugin-pwa` (descartado en DEC-006 por incompatibilidad con Vite 8), inyectar ese manifiesto requeriría un script custom de post-build.
3. **Separar la estrategia según el tipo de request: network-first para navegación, cache-first para assets estáticos, network-only para CDN externos** (elegida).

## Decisión

Separar la estrategia según el tipo de request:

- **Requests de navegación** (`e.request.mode === 'navigate'`, corresponde a `index.html`): **network-first**. Siempre se intenta la red; el resultado se guarda en cache. Si la red falla (offline), se sirve el HTML cacheado como fallback. Esto garantiza que el usuario siempre recibe el HTML del deploy actual, con las referencias correctas a los assets hasheados.
- **Assets estáticos** (JS, CSS, iconos): **cache-first**. Los assets de Vite son content-hashed; si el contenido cambia, el nombre cambia. Son inmutables por definición: una URL dada siempre corresponde al mismo contenido. Cache-first es correcto y eficiente para ellos.
- **CDN externos** (WASM, modelo MediaPipe): sin cambio, siguen siendo network-only (demasiado grandes; el cache HTTP del browser los maneja).

### Bump de versión

`v2 → v3` en la constante `CACHE` para forzar que el `activate` del nuevo SW limpie el cache viejo y todos los clientes con la PWA instalada reciban el comportamiento correcto.

### Por qué no precaching en install

El precaching requiere conocer los nombres de los assets hasheados en tiempo de build. Sin `vite-plugin-pwa` (descartado en DEC-006 por incompatibilidad con Vite 8), inyectar ese manifiesto requeriría un script custom de post-build. La combinación network-first para HTML + cache-first para assets resuelve el problema raíz sin necesidad de precaching.

## Consecuencias

### Positivas

- El usuario siempre recibe el HTML del deploy actual, con las referencias correctas a los assets hasheados.
- Los assets content-hashed se sirven cache-first, lo que es correcto y eficiente porque son inmutables por definición.
- Se conserva el fallback offline: si la red falla, se sirve el HTML cacheado.
- El bump `v2 → v3` obliga a todos los clientes con la PWA instalada a limpiar el cache viejo.
- Resuelve el problema raíz sin necesidad de precaching ni de script custom de post-build.

### Negativas

- Cada carga de la app en línea realiza una request de red para `index.html` antes de renderizar (coste de network-first frente a cache-first).
- La versión del cache (`CACHE`) sigue subiéndose manualmente con cada deploy, como en `DEC-006`.
- Sin precaching, los assets solo quedan cacheados tras su primera descarga; el uso offline requiere haber cargado la app antes.

## Referencias

- `DEC-006` (PWA implementada manualmente sin `vite-plugin-pwa`; SW `v2` original con cache-first).
- `DEC-019` (deploy en Vercel, contexto en el que se manifiesta el HTML obsoleto).
- `public/sw.js`
