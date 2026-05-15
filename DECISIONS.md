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

## DEC-014 · Detección de fondo real: mínimo local por giro de ángulo
**Fecha:** 2026-05-06  
**Contexto:** La voz disparaba al entrar a la fase "squatting" (primer frame con `kneeAngle < 100°`), no en el punto más bajo real. Esto causaba discrepancia: la voz decía "Baja un poco más" con el ángulo de entrada (~98°), pero el visual luego mostraba verde cuando el usuario llegaba a 85°.  
**Raíz del problema:** Dos relojes distintos: el visual se actualiza cada frame con el ángulo actual; la voz disparaba una sola vez en la transición de fase, con el ángulo de ese instante preciso.  
**Solución:** Detección de mínimo local por inversión de tendencia. El tracker acumula `minAngleSeen` (mínimo ángulo visto desde que entró a squatting) y detecta el fondo cuando `kneeAngle > prevKneeAngle + 2°` (el ángulo empezó a subir más de 2°). En ese frame exacto: `atBottom = true`, se evalúa `minAngleSeen` y se dispara la voz. La condición estricta `>` (no `>=`) más el umbral de 2° previene falsos positivos por ruido de landmarks.  
**Flujo temporal resultante:**
```
bajando      → silencio (acumulando minAngleSeen)
fondo real   → voz evalúa minAngleSeen: "¡Excelente!" o "Baja más"
subiendo     → silencio
standing     → voz dice solo el número de rep
```
**Por qué no "bottom = cuando kneeAngle es mínimo":** El mínimo solo se conoce a posteriori (necesitarías ver el siguiente frame para saber que era el más bajo). La inversión de tendencia (+2°) es el primer frame donde es matemáticamente confirmable que el mínimo ya pasó.

---

## DEC-013 · Retroalimentación por voz: Web Speech API (SpeechSynthesis)
**Fecha:** 2026-05-06  
**Contexto:** Los usuarios que usan la cámara frontal tienen los ojos en el espejo de la pantalla y no pueden leer el texto del overlay fácilmente. Se evaluó cómo dar feedback auditivo sin costos ni dependencias externas.  
**Alternativas:** (a) Audio pregrabado (MP3s) — requiere assets, más MB, gestión de AudioContext; (b) Servicio TTS en la nube (AWS Polly, Google TTS) — costo, latencia, requiere backend; (c) Web Speech API nativa (`SpeechSynthesis`) — sin dependencias, sin costo, disponible en iOS Safari y Android Chrome modernos.  
**Razón:** `SpeechSynthesis` es la opción correcta para este proyecto: zero costo, zero dependencias, cero bytes extra en el bundle, y la API es estable. La voz en `es-ES` está disponible en todos los dispositivos móviles del mercado objetivo (Android 5+ y iOS 7+).  
**Detalle de implementación:** Hook `useSpeech()` con `speechSynthesis.cancel()` antes de cada locución para evitar acumulación. Disparos solo en transiciones de estado (no por frame): (1) rep completada → número + elogio cada 5/10; (2) llegada al fondo → "¡Buena profundidad!" o "Baja un poco más". El callback de `useSpeech` está memoizado con `useCallback` para evitar que el `useEffect` de RAF se re-ejecute innecesariamente.  
**Limitación iOS conocida:** El primer `speak()` debe ocurrir en el contexto de un evento de usuario. El tap "Comenzar a entrenar" en el onboarding desbloquea el contexto de audio; las llamadas posteriores desde RAF funcionan correctamente.

---

## DEC-012 · Overlay de feedback: barra inferior de ancho completo con CSS custom property
**Fecha:** 2026-05-06  
**Contexto:** La pill original (fondo 18% de opacidad, texto pequeño) era poco visible sobre el video en condiciones de luz variable. El rep counter separado requería que el usuario mirara dos zonas distintas de la pantalla.  
**Alternativas:** (a) Mantener pill + counter separados pero hacerlos más grandes; (b) overlay semitransparente sobre toda la pantalla; (c) barra inferior de ancho completo con el mensaje y el counter en la misma fila.  
**Razón:** La barra inferior unifica en un solo bloque toda la información relevante (mensaje + reps). El fondo oscuro al 80% con `backdrop-filter: blur(16px)` garantiza legibilidad sobre cualquier fondo de video. El borde izquierdo colorido (`border-left: 5px solid var(--feedback-color)`) da la señal semántica de color sin depender de que el usuario lea el texto. El counter a la derecha es inmediatamente reconocible como número de reps (patrón establecido por Peloton, Apple Fitness+). La animación pop en el counter (`key={result.reps}` → remount de React → reinicio de `@keyframes`) da feedback inmediato de que la rep fue registrada.

---

## DEC-011 · Feedback de ejercicio: overlay DOM sobre canvas (no dibujo en canvas)
**Fecha:** 2026-05-06  
**Contexto:** El contador de reps y el mensaje de feedback necesitan renderizarse sobre el video. Dos opciones principales: (a) dibujar texto/formas directamente en el canvas 2D junto al esqueleto, o (b) un componente React superpuesto con `position: absolute`.  
**Alternativas:** (a) Canvas 2D con `ctx.fillText()` y `ctx.fillRect()` para fondo/texto; (b) componente DOM con `position: absolute; z-index: 5; pointer-events: none`.  
**Razón:** El overlay DOM permite usar backdrop-filter blur, border-radius y las mismas fuentes del sistema que usa el onboarding, sin código de layout manual en canvas. El `pointer-events: none` en el contenedor del overlay garantiza que los toques pasen al botón de cambio de cámara (z-index: 10). El re-render de React a ~60fps es aceptable para actualizar un número y un string; React solo modifica los nodos del DOM que cambiaron.  
**Estado en RAF:** `setExerciseResult()` se llama cada frame. Se decidió no throttlear por ahora — el contador debe ser inmediato. Si en celulares de gama baja aparece jank, el primer paso sería memoizar el componente con `React.memo`.

---

## DEC-009 · Cálculo de ángulos: atan2 con tipo propio Point2D
**Fecha:** 2026-05-06  
**Contexto:** La función de cálculo angular necesita recibir landmarks de MediaPipe pero `geometry/angles.ts` no debería depender del paquete `@mediapipe/tasks-vision` para mantenerse aislado y testeable.  
**Alternativas:** (a) Importar `NormalizedLandmark` directamente; (b) usar un tipo local compatible estructuralmente; (c) recibir `x, y` como parámetros separados.  
**Razón:** Se define `Point2D { x, y }` en el propio módulo. `NormalizedLandmark` tiene `x`, `y`, `z`, `visibility` — es compatible estructuralmente, así que puede pasarse donde se espera `Point2D` sin casting. El módulo de geometría queda sin dependencias externas, lo que facilita pruebas unitarias aisladas.  
**Fórmula:** `atan2(Cy−By, Cx−Bx) − atan2(Ay−By, Ax−Bx)`, valor absoluto, espejo si > 180°. Rango de salida: 0–180°.

---

## DEC-010 · Máquina de estados de sentadilla: histéresis de umbral doble
**Fecha:** 2026-05-06  
**Contexto:** Detectar la fase "abajo" / "arriba" de la sentadilla a partir del ángulo de rodilla. Una solución naive con un único umbral genera "flutter" (oscilación rápida entre estados) cuando el ángulo oscila alrededor del umbral por ruido en los landmarks.  
**Alternativas:** (a) Umbral único con debounce por tiempo; (b) promedio de N frames; (c) histéresis con umbral doble (zona muerta).  
**Razón:** La histéresis con zona muerta (100°–160°) es la solución estándar para máquinas de estados con señales ruidosas. La zona intermedia conserva el estado anterior, eliminando el flutter sin introducir latencia artificial. Es determinista, sin parámetros de tiempo y comprensible por cualquier integrante del equipo.  
**Umbrales:** `STANDING_ANGLE = 160°` (entrada al estado "de pie"), `BOTTOM_ANGLE = 100°` (entrada al estado "abajo"), `GOOD_DEPTH_ANGLE = 90°` (feedback verde). Calibrados empíricamente para sentadilla estándar con vista lateral o de 45°.  
**Conteo de reps:** Transición `squatting → standing` = +1 rep. Esto garantiza que la rep se cuente solo cuando el usuario vuelve a la posición alta completa.

---

## DEC-008 · Onboarding: implementado en React con CSS nativo
**Fecha:** 2026-05-06  
**Contexto:** El alcance del MVP no incluía onboarding, pero el equipo decidió agregarlo antes de la entrega porque la app arranca directamente en la cámara sin contexto para el usuario. Se evaluó si usar una librería de animaciones o slides (Framer Motion, Swiper).  
**Alternativas:** (a) Framer Motion para animaciones; (b) Swiper.js para el swipe entre pantallas; (c) CSS puro con `@keyframes`.  
**Razón:** CSS nativo con `@keyframes` y `animation-delay` escalonado produce el mismo resultado visual sin agregar dependencias al `package.json`. Framer Motion (~150 KB) y Swiper son overkill para 4 pantallas estáticas con transición slide-in unidireccional. La animación de "stagger" se logra con `:nth-child` + `animation-delay`, técnica estándar y sin JS.  
**Decisiones de diseño:**  
- Design system combinado: Apple Fitness (tipografía bold, blanco puro) + Samsung Health (cards redondeadas en gris claro) + Strava (CTA naranja `#FC4C02`).  
- Splash auto-avanza a los 2.8s; las demás pantallas requieren acción del usuario.  
- PermissionsScreen llama a `getUserMedia` con el contexto visible para que el navegador muestre el diálogo de permiso con sentido para el usuario.  
- GetStartedScreen guarda la preferencia de cámara en `localStorage('preferred_camera')` y `CameraView` la lee en el `useState` inicial, sin props drilling.  
- `localStorage('ob_complete_v1')` controla si el onboarding ya fue completado; la clave incluye versión para poder forzar re-show si se cambia el flujo en el futuro.

---

## DEC-015 · Curl de bíceps: detección de cima por inversión de tendencia + soporte frontal/lateral
**Fecha:** 2026-05-15  
**Contexto:** Segundo ejercicio de la app. El curl de bíceps puede ejecutarse con la cámara frontal (vista de frente, ambos brazos visibles) o lateral (perfil, un solo brazo dominante en frame). Necesitaba decidir cómo manejar ambas vistas con un único tracker.  
**Alternativas:** (a) Dos trackers separados (uno para cada brazo) con lógica de selección manual; (b) un único tracker que detecta automáticamente el modo de vista; (c) pedir al usuario que indique si usa vista frontal o lateral.  
**Razón:** Se implementó detección automática de vista por diferencia de visibilidad: si `|visibilidad_izquierda - visibilidad_derecha| > 0.35`, la app infiere vista lateral y usa solo el brazo más visible. Si la diferencia es menor, usa ambos brazos (vista frontal o de 45°). El umbral 0.35 es empírico — un brazo mirando de frente al objetivo es significativamente más visible que el opuesto.  
**Detección de cima:** Igual que el fondo en sentadillas — inversión de tendencia (+2°). El ángulo de codo sube durante la contracción (menor grado = más contraído); cuando el ángulo vuelve a crecer más de 2°, se confirma que se pasó la cima. `GOOD_FORM_ANGLE = 50°` es el umbral de "contracción completa".  
**Ángulos:** `EXTENDED_ANGLE = 160°` (brazo extendido), `FLEXED_ANGLE = 60°` (entrada a fase contraída), `GOOD_FORM_ANGLE = 50°` (contracción completa).  
**Conteo de reps:** Cada `ArmTracker` cuenta sus propias reps; `BicepCurlTracker` suma ambos. Esto permite contar reps alternas (curl con mancuernas alternando brazos) y reps simultáneas (barra).

---

## DEC-006 · Plugin PWA: diferido (incompatibilidad con Vite 8)
**Fecha:** 2026-04-29  
**Contexto:** `vite-plugin-pwa` es la herramienta estándar para generar service worker y validar el manifest en proyectos Vite. Al intentar instalarlo, falló con conflicto de peer dependency: solo soporta hasta Vite 7; el scaffold de Vite 9 instala Vite 8.  
**Alternativas:** (a) Downgrade a Vite 7; (b) `--legacy-peer-deps` y asumir posible incompatibilidad; (c) escribir el service worker manualmente.  
**Razón:** El plugin PWA no es necesario para el primer paso (cámara + esqueleto). Se difiere a la semana 5-6 cuando el alcance core esté cerrado. En ese momento se evaluará si el plugin ya actualizó soporte para Vite 8, si conviene hacer downgrade, o si se escribe el SW manualmente con Workbox CLI. No bloquea el desarrollo actual.
