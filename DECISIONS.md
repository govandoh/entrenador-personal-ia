# Log de Decisiones Técnicas

Cada entrada sigue el formato: **fecha · contexto · alternativas consideradas · razón**.

---

## DEC-001 · Framework UI: React
**Fecha:** 2026-04-29  
**Contexto:** El proyecto necesita un framework para construir la interfaz. El anteproyecto dejaba abierta la elección entre React y Vue.  
**Alternativas:** Vue 3 (Composition API).  
**Razón:** React tiene mayor cantidad de ejemplos y referencias de integración con MediaPipe en GitHub, lo que reduce el riesgo de bloquearse al integrar la detección de poses. Ambos son viables técnicamente; el criterio fue disponibilidad de ejemplos del stack específico.

---

## DEC-002 · Build tool: Vite
**Fecha:** 2026-04-29  
**Contexto:** Se necesita un bundler/dev server para el proyecto React.  
**Alternativas:** Create React App (CRA).  
**Razón:** CRA está en modo mantenimiento y su ecosistema está en declive. Vite ofrece arranque en frío casi instantáneo, HMR nativo, y es el estándar actual de la industria para proyectos React nuevos. El template `react-ts` de Vite genera una configuración limpia y minimal.

---

## DEC-003 · Lenguaje: TypeScript
**Fecha:** 2026-04-29  
**Contexto:** El stack base es JavaScript; TypeScript es opcional pero suma tipado estático.  
**Alternativas:** JavaScript (ES2020+) plano.  
**Razón:** El equipo evaluó la curva de aprendizaje y decidió asumirla. El tipado explícito es especialmente valioso en este proyecto porque MediaPipe devuelve arrays de landmarks con estructura fija (33 puntos, cada uno con `x`, `y`, `z`, `visibility`); tener esos tipos definidos desde el inicio previene bugs silenciosos en los cálculos angulares.

---

## DEC-004 · API de MediaPipe: @mediapipe/tasks-vision (Tasks API)
**Fecha:** 2026-04-29  
**Contexto:** MediaPipe tiene dos APIs JS: la legacy (`@mediapipe/pose`) y la moderna (`@mediapipe/tasks-vision`).  
**Alternativas:** `@mediapipe/pose` (API legacy, basada en callbacks y archivos `.wasm` separados por solución).  
**Razón:** La API legacy está en modo solo-mantenimiento y su documentación oficial ya no recibe actualizaciones. `@mediapipe/tasks-vision` es la API unificada actual, tiene `PoseLandmarker` con modo `VIDEO` optimizado para streams de cámara, e incluye `DrawingUtils` para renderizar el esqueleto sin código manual de canvas. El modo `VIDEO` de `detectForVideo(video, timestampMs)` está diseñado específicamente para el patrón `requestAnimationFrame`.

---

## DEC-005 · Carga del WASM de MediaPipe: CDN (jsDelivr)
**Fecha:** 2026-04-29  
**Contexto:** Los archivos WASM de MediaPipe deben estar disponibles en tiempo de ejecución. Pueden servirse localmente (bundleados con Vite) o desde CDN.  
**Alternativas:** Copiar los archivos `.wasm` a `public/` y servirlos localmente.  
**Razón:** Bundlear WASM con Vite 8 requiere configuración no trivial (`assetsInlineLimit`, `optimizeDeps.exclude`, headers COOP/COEP para SharedArrayBuffer). Usar jsDelivr con versión fijada (`@0.10.22/wasm`) es la ruta recomendada en la documentación oficial de MediaPipe y elimina ese problema por completo. La desventaja es que requiere conexión a internet en el primer uso; aceptable para el alcance del proyecto.  
**Versión fijada:** `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm`

---

## DEC-007 · Directorio de desarrollo: C:\Dev-AI (fuera de OneDrive)
**Fecha:** 2026-04-29  
**Contexto:** El proyecto estaba alojado dentro de la carpeta de OneDrive (`OneDrive - Universidad Mariano Gálvez\NOVENO SEMESTRE\INTELIGENCIA ARTIFICAL\Project-Training-AI\`). Al iniciar el servidor de desarrollo de Vite, se producía el error `EPERM -4048: operation not permitted, rmdir node_modules\.vite\deps` porque OneDrive bloqueaba archivos de `node_modules` durante la sincronización en tiempo real.  
**Alternativas:** (a) Pausar OneDrive manualmente cada vez que se desarrolla; (b) excluir `node_modules` de la sincronización vía atributos del sistema; (c) mover el proyecto fuera de OneDrive.  
**Razón:** OneDrive no es adecuado como entorno de desarrollo activo: sincroniza `node_modules` (>150 MB, miles de archivos pequeños), genera locks que rompen herramientas de build, y no agrega valor porque el versionado real se hará con Git/GitHub. `C:\Dev-AI` es una ruta local sin sincronización en la nube, limpia y sin espacios en el path. OneDrive queda para almacenar documentos y entregables del curso, no código fuente.  
**Impacto:** El `CLAUDE.md` se movió al interior de `entrenador-personal-ia\` (donde le corresponde según la estructura del proyecto). Las sesiones futuras de Claude Code deben iniciarse desde `C:\Dev-AI\entrenador-personal-ia`.

---

## DEC-006 · Plugin PWA: diferido (incompatibilidad con Vite 8)
**Fecha:** 2026-04-29  
**Contexto:** `vite-plugin-pwa` es la herramienta estándar para generar service worker y validar el manifest en proyectos Vite. Al intentar instalarlo, falló con conflicto de peer dependency: solo soporta hasta Vite 7; el scaffold de Vite 9 instala Vite 8.  
**Alternativas:** (a) Downgrade a Vite 7; (b) `--legacy-peer-deps` y asumir posible incompatibilidad; (c) escribir el service worker manualmente.  
**Razón:** El plugin PWA no es necesario para el primer paso (cámara + esqueleto). Se difiere a la semana 5-6 cuando el alcance core esté cerrado. En ese momento se evaluará si el plugin ya actualizó soporte para Vite 8, si conviene hacer downgrade, o si se escribe el SW manualmente con Workbox CLI. No bloquea el desarrollo actual.
