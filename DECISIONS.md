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

## DEC-018 · Press de Hombro: ángulos seguros, polaridad invertida y detección de pico
**Fecha:** 2026-05-15  
**Contexto:** Tercer ejercicio. El shoulder press usa los mismos landmarks que el curl (shoulder-elbow-wrist), pero la polaridad del movimiento es inversa: el esfuerzo AUMENTA el ángulo del codo (pesas overhead = ángulo alto ≈ 150-165°). El pico del movimiento es el MÁXIMO de ángulo, no el mínimo.  
**Umbrales y justificación clínica:**  
- `PRESSED_ANGLE = 150°`: entrada a fase "pressed". Zona de histéresis: 100°–150° (50° de zona muerta).  
- `LOWERED_ANGLE = 100°`: entrada a fase "lowered" (pesas a nivel de hombro, codo ≈ 90°).  
- `GOOD_LOCKOUT_ANGLE = 145°`: mínimo para feedback verde. Se usa 145° en lugar de 170°+ para no exigir hiperextensión del codo bajo carga; MediaPipe también tiende a subestimar ligeramente el ángulo en vista frontal.  
- `SAFE_LOW_ANGLE = 80°`: feedback rojo por debajo de este valor. Bajar el codo por debajo de la línea del hombro con carga externa comprime el tendón supraespinoso entre el acromion y la cabeza humeral (síndrome de impingement). 80° es el límite clínico conservador para press frontal.  
**Detección de pico:** Análoga al curl pero invertida. `fallingFrames` cuenta frames donde el ángulo desciende ≥ 0.5°/frame; `atPeak` se confirma con 3 frames consecutivos. `maxAngleSeen` acumula el máximo (vs. `minAngleSeen` del curl). `peakFired` actúa como gate del conteo (DEC-017).  
**Ángulo primario:** `Math.max(left, right)` — el brazo más extendido indica la calidad del press (vs. `Math.min` del curl donde menor = más contraído).  
**Estrategia de voz:** Clasificado como "pico al fin del esfuerzo" (DEC-016): `atPeak` guarda en `pressFormFeedbackRef`, `reps++` emite utterance combinado `"${n}. ¡Extensión completa!"`.

---

## DEC-017 · Conteo de reps: gate obligatorio por confirmación de cima/fondo
**Fecha:** 2026-05-15  
**Contexto:** Al probar el curl en celular se detectó que movimientos bruscos del dispositivo o la aparición momentánea de un brazo en frame disparaban reps falsas. El ángulo del codo puede saltar de 165° a 45° y volver en 2 frames por ruido o movimiento de cámara, cumpliendo la condición `flexed → extended` sin que el usuario haya hecho ningún curl.  
**Raíz del problema:** El conteo de reps solo chequeaba la transición de fase (`flexed → extended`), pero no si el movimiento había sido validado como intencional. El mecanismo de confirmación (`topFired` / `bottomFired`) ya existía para detectar el punto extremo del movimiento, pero no estaba siendo usado como prerequisito del conteo.  
**Consecuencia secundaria:** Sin `topFired`, `curlFormFeedbackRef` estaba vacío cuando el conteo disparaba → el usuario solo escuchaba el número, sin evaluación de forma.  
**Solución:** Agregar `&& this.topFired` (curl) / `&& this.bottomFired` (sentadilla, aplicar en futura revisión) al condicional de `reps++`. Una rep solo se registra si previamente se confirmó el punto extremo del movimiento mediante N frames consecutivos de tendencia sostenida.  
**Garantía resultante:** `atTop` siempre ocurre ANTES de `reps++` (son eventos excluyentes en el mismo frame; `topFired` solo se resetea en el mismo frame que `reps++`). Esto garantiza que `curlFormFeedbackRef` siempre tiene el mensaje de forma cuando el conteo dispara.  
**Patrón para todos los ejercicios:** Todo tracker debe tener un flag `peakConfirmed` (o `topFired`/`bottomFired`) que actúe como gate del conteo. Nunca contar una rep solo por transición de fase.

---

## DEC-016 · Arquitectura de feedback de voz: confirmación por frames y prioridad sin colisiones
**Fecha:** 2026-05-15  
**Contexto:** Durante pruebas del curl de bíceps se detectaron dos problemas: (1) la voz disparaba con pequeños movimientos de ruido de MediaPipe, dando feedback incorrecto antes de que el usuario completara la contracción; (2) el feedback de forma (`atTop`/`atBottom`) y el conteo de reps (`reps > prevReps`) disparaban en secuencia rápida, y como `useSpeech` cancela la locución anterior, el conteo cortaba el feedback de forma o viceversa.  
**Raíz del problema 1:** `DESCENDING_THRESHOLD = 2°` en un solo frame es insuficiente para landmarks de brazo, que tienen más ruido que los de pierna. Un spike de ruido de 3° confirma falsamente que se pasó la cima.  
**Raíz del problema 2:** Para el curl, `atTop` y `reps++` ocurren dentro de ~200ms (la confirmación de cima precede en pocos frames a la extensión completa). `speechSynthesis.cancel()` en `useSpeech` hace que el último utterance siempre gane, suprimiendo el primero.  
**Solución 1 — Confirmación por frames consecutivos:** Reemplazar el threshold de un frame por un contador de `risingFrames`. `atTop` solo se confirma después de `MIN_RISING_FRAMES = 3` frames consecutivos donde `angle > prevAngle + 0.5°`. Esto requiere ~50ms de tendencia sostenida a 60fps, filtrando spikes de ruido sin latencia perceptible. El parámetro `MIN_RISING_FRAMES` puede calibrarse por ejercicio según el ruido esperado del joint (brazo > pierna).  
**Solución 2 — Estrategia por tipo de ejercicio:**  
- **Ejercicios cuyo peak/bottom es el fin del esfuerzo** (curl, press de hombro): `atTop` no habla; guarda el mensaje en un ref `curlFormFeedbackRef`. Cuando `reps++`, se emite un único utterance combinado: `"3. ¡Excelente contracción!"`. Sin colisión posible.  
- **Ejercicios cuyo peak/bottom es el punto medio del recorrido** (sentadilla, lunge): `atBottom` habla de inmediato (el feedback "baja más" es accionable mientras el usuario sigue abajo). Cuando `reps++`, se respeta un cooldown de 1500ms desde la última locución; si está dentro del cooldown, el conteo de esa rep se suprime (el usuario ya recibió audio en ese ciclo).  
**Patrón para futuros ejercicios:** Al diseñar cada ejercicio, clasificar el peak/bottom según si ocurre al fin del esfuerzo o a mitad, y elegir la estrategia correspondiente. Documentar la clasificación en el tracker del ejercicio.  
**Impacto:** `ArmTracker` agrega `risingFrames: number` al estado; `CameraView` agrega `curlFormFeedbackRef` y `lastSpeakTimeRef`.

---

## DEC-006 · PWA implementada manualmente (sin vite-plugin-pwa)
**Fecha original de diferimiento:** 2026-04-29 · **Fecha de resolución:** 2026-05-15  
**Contexto:** `vite-plugin-pwa` falló por incompatibilidad de peer dependency con Vite 8 (solo soporta hasta Vite 7). Se había diferido para la semana 5-6.  
**Alternativas evaluadas en semana 5-6:** (a) Downgrade a Vite 7 — riesgo de romper otras dependencias; (b) `--legacy-peer-deps` — plug-in sin probar con Vite 8, posibles bugs silenciosos; (c) implementación manual del SW + manifest.  
**Decisión:** Implementación manual. El `public/manifest.json` declara `display: standalone`, `theme_color: #FC4C02`, `background_color: #0a0a0a` y referencia `favicon.svg` como único ícono (escalable SVG, compatible con Chrome/Edge/Firefox; Safari requiere `apple-touch-icon` separado, cubierto con `<link>` en `index.html`). El `public/sw.js` usa estrategia **cache-first para app shell** (mismo origen) y **network-only para CDN externos** (archivos WASM y modelo de MediaPipe son demasiado grandes para el cache del SW; el cache HTTP del browser ya los maneja). El SW se registra en `main.tsx` en el evento `load` para no bloquear el hilo principal durante el arranque. La versión del cache (`CACHE = 'entrenador-ia-v2'`) se sube manualmente con cada deploy para forzar re-descarga en los usuarios con el PWA instalado.  
**Por qué no Workbox CLI:** Agrega un paso de build extra y una dependencia de CLI. Para un SW de 30 líneas con una sola estrategia, el overhead no está justificado.

---

## DEC-019 · Plataforma de deploy: Vercel
**Fecha:** 2026-05-15  
**Contexto:** Cierra la decisión pendiente de sección 5.3 del anteproyecto (GitHub Pages vs. Vercel vs. Netlify). La app necesita deploy en URL pública para la entrega del 22/05.  
**Alternativas:** (a) GitHub Pages — requiere rama `gh-pages` o configurar Actions; no tiene preview deployments automáticos por PR; solo soporta sitios estáticos sin rewrite rules; (b) Netlify — similar a Vercel en features, interface menos familiar; (c) Vercel — integración directa con GitHub, deploy automático en cada push a `main`, preview URL por rama, zero-config para proyectos Vite (detecta automáticamente el framework y usa `vite build`).  
**Decisión:** Vercel. El proyecto Vite se detecta automáticamente; no requiere `vercel.json` ni configuración adicional. El output directory `dist/` y el comando `vite build` son inferidos por Vercel. El plan Hobby (gratuito) es suficiente para el alcance del proyecto y no requiere tarjeta de crédito (cumple restricción dura 5).  
**Impacto:** Cada push a `main` dispara un deploy automático. La URL de producción queda fija para incluir en los entregables del curso.

---

## DEC-020 · HTTPS en desarrollo local: @vitejs/plugin-basic-ssl
**Fecha:** 2026-05-15  
**Contexto:** La API `getUserMedia` con `facingMode: 'environment'` (cámara trasera) exige un contexto seguro (HTTPS o `localhost`). Al exponer el dev server en la red local con `host: true` para probar desde el celular, `localhost` ya no aplica — el celular accede por IP (ej. `192.168.x.x`), que es HTTP sin TLS. Cierra la decisión pendiente de sección 5.4 (ngrok vs. deploy continuo).  
**Alternativas:** (a) ngrok — tunnel HTTPS gratuito pero requiere instalar la herramienta, autenticarse, y la URL cambia en cada sesión; (b) usar directamente la URL de Vercel como entorno de pruebas — implica hacer push por cada cambio, ciclo muy lento; (c) certificado local autofirmado con mkcert — requiere instalar la CA en cada celular de prueba; (d) `@vitejs/plugin-basic-ssl` — genera un certificado autofirmado en memoria, el navegador del celular muestra la advertencia "sitio no seguro" pero se puede ignorar una vez para desarrollo.  
**Decisión:** `@vitejs/plugin-basic-ssl`. No requiere instalación externa, no tiene tokens que expiren, la URL es siempre la IP local del equipo, y el certificado autofirmado es aceptable para desarrollo (el deploy de producción en Vercel tiene TLS real). La advertencia del navegador se ignora una vez y no vuelve a aparecer en la misma sesión.  
**Limitación:** iOS Safari rechaza certificados autofirmados con más severidad que Android Chrome. Si se necesita probar en iOS, la alternativa es usar la URL de preview de Vercel.

---

## DEC-021 · Delay de 450 ms al cambiar de cámara en PWA instalada
**Fecha:** 2026-05-15  
**Contexto:** Al cambiar entre cámara frontal y trasera desde el PWA instalado (modo standalone), `getUserMedia` lanzaba "Could not start video source" de forma intermitente — error que no aparecía al usar la app desde el navegador. La causa: `track.stop()` es síncrono en la API JavaScript, pero el hardware del dispositivo (sensor de cámara) no libera el recurso de forma inmediata; llamar `getUserMedia` antes de que el hardware esté libre produce la colisión.  
**Por qué solo en PWA instalada:** El navegador introduce su propio buffer de tiempo entre páginas o pestañas, lo que da margen suficiente para que el hardware se libere. El PWA standalone no tiene ese buffer — el cambio de cámara ocurre dentro del mismo proceso y el ciclo stop → start es inmediato.  
**Solución:** Flag `cameraStopPendingRef` (booleano) que se activa en el cleanup del `useEffect` cuando se detiene un stream. Al inicio del siguiente `setup()`, si el flag está activo, se espera 450 ms antes de llamar `getUserMedia`. Los 450 ms son un valor empírico conservador que cubre la mayoría de dispositivos Android e iOS. El flag se resetea al inicio del delay para no acumular esperas en cambios rápidos sucesivos.  
**Alternativas descartadas:** (a) reintentar `getUserMedia` con backoff exponencial — mayor complejidad y el usuario ve el error momentáneamente; (b) detectar el error específico "Could not start video source" y recuperar — frágil, el mensaje de error varía por navegador y versión.

---

## DEC-023 · Press de hombro: conteo unificado con cooldown (sin conteo por brazo)
**Fecha:** 2026-05-16  
**Contexto:** El diseño original de `ShoulderPressTracker` mantenía un contador de reps independiente en cada `ArmPressTracker` (`left.reps + right.reps`), igual que el diseño original del curl antes de DEC-022. En press bilateral (ambos brazos simultáneos), cada brazo completaba su ciclo de pressed → lowered y ambos contadores incrementaban, resultando en el doble de reps reales. El bug fue identificado por Codex al auditar el código tras DEC-022.  
**Decisión:** Aplicar exactamente el mismo patrón de DEC-022. `ArmPressTracker` deja de mantener su propio contador y emite `repCompleted: boolean` cuando su ciclo cumple todos los gates (`peakFired` confirmado). `ShoulderPressTracker` tiene el único contador `reps` y lo incrementa con OR logic + cooldown de **15 frames (~250 ms a 60 fps)**.  
**Comportamiento resultante:** Idéntico al DEC-022: press bilateral = 1 rep; press alterno = 1 rep por brazo; vista lateral = 1 rep por ciclo.  
**Por qué no se detectó antes:** El ejercicio se implementó (DEC-018) antes de que el bug del curl se corrigiera (DEC-022); al corregir el curl se documentó el patrón pero no se auditó el press.

---

## DEC-024 · localStorage defensivo: try/catch y validación de valor
**Fecha:** 2026-05-16  
**Contexto:** `App.tsx` y `CameraView.tsx` leían y escribían `localStorage` directamente sin manejo de errores. En Safari en modo privado y en algunos navegadores con storage bloqueado por política del sistema operativo o del propio navegador (sandboxed iframes, restricciones corporativas), `localStorage.getItem()` lanza `SecurityError`, rompiendo la inicialización de React. Adicionalmente, `CameraView.tsx` hacía `localStorage.getItem('preferred_camera') as FacingMode` —un cast exclusivamente de TypeScript que no valida en runtime— lo que permitía que un valor inválido (ej. `'back'`, `null`, vacío) llegara como constraint a `getUserMedia`, causando que la cámara fallara con un error críptico.  
**Decisión:** Envolver los cuatro puntos de acceso (2 `getItem` + 2 `setItem`) en bloques `try/catch`. En el catch, retornar el valor por defecto seguro (`false` para el onboarding, `'environment'` para la cámara) y continuar sin lanzar. En `CameraView`, reemplazar el cast por validación explícita: `v === 'user' || v === 'environment'`; cualquier otro valor cae al default.  
**Por qué no solo `?? 'environment'`:** El operador `??` cubre `null` y `undefined` pero no valores inválidos presentes en storage (`'back'`, `'front'`, una cadena vacía), ni el lanzamiento de excepciones de storage bloqueado. La combinación try/catch + validación explícita cubre ambos casos.

---

## DEC-025 · Service Worker: network-first para HTML, cache-first para assets estáticos
**Fecha:** 2026-05-16  
**Contexto:** El SW original (`v2`) aplicaba cache-first a todas las requests del mismo origen, incluido `index.html`. `index.html` no tiene hash en su nombre (a diferencia de `assets/index-HASH.js`), por lo que puede quedar cacheado indefinidamente en una versión vieja después de un deploy. Un usuario con la PWA instalada recibiría el HTML antiguo que apunta a assets ya eliminados del servidor, dejando la app inoperable o mostrando versiones obsoletas. El bug fue identificado por Codex.  
**Decisión:** Separar la estrategia según el tipo de request:  
- **Requests de navegación** (`e.request.mode === 'navigate'`, corresponde a `index.html`): **network-first**. Siempre se intenta la red; el resultado se guarda en cache. Si la red falla (offline), se sirve el HTML cacheado como fallback. Esto garantiza que el usuario siempre recibe el HTML del deploy actual, con las referencias correctas a los assets hasheados.  
- **Assets estáticos** (JS, CSS, iconos): **cache-first**. Los assets de Vite son content-hashed; si el contenido cambia, el nombre cambia. Son inmutables por definición: una URL dada siempre corresponde al mismo contenido. Cache-first es correcto y eficiente para ellos.  
- **CDN externos** (WASM, modelo MediaPipe): sin cambio, siguen siendo network-only (demasiado grandes; el cache HTTP del browser los maneja).  
**Bump de versión:** `v2 → v3` en la constante `CACHE` para forzar que el `activate` del nuevo SW limpie el cache viejo y todos los clientes con la PWA instalada reciban el comportamiento correcto.  
**Por qué no precaching en install:** El precaching requiere conocer los nombres de los assets hasheados en tiempo de build. Sin `vite-plugin-pwa` (descartado en DEC-006 por incompatibilidad con Vite 8), inyectar ese manifiesto requeriría un script custom de post-build. La combinación network-first para HTML + cache-first para assets resuelve el problema raíz sin necesidad de precaching.

---

## DEC-022 · Curl de bíceps: conteo unificado con cooldown (sin conteo por brazo)
**Fecha:** 2026-05-15  
**Contexto:** El diseño original de `BicepCurlTracker` mantenía un contador de reps independiente en cada `ArmTracker` (`left.reps + right.reps`). En vista frontal con curls bilaterales (ambos brazos simultáneos), cada brazo completaba su ciclo y ambos contadores incrementaban, resultando en el doble de reps reales. Sin un modelo de IA que clasifique automáticamente si el ejercicio es unilateral o bilateral, no es posible distinguir el caso sin introducir heurísticas adicionales frágiles.  
**Alternativas consideradas:**  
(a) Pedir al usuario que seleccione el modo (unilateral / bilateral) — agrega fricción en la UI y requiere que el usuario entienda la distinción.  
(b) Detectar el modo automáticamente por correlación temporal entre ambos brazos — requiere buffer de historial de ángulos y lógica de correlación, complejidad desproporcionada al alcance.  
(c) Conteo unificado en `BicepCurlTracker` con OR logic + cooldown de frames — simple, determinista, cubre los dos casos sin intervención del usuario.  
**Decisión:** Opción (c). `ArmTracker` ya no mantiene contador propio; emite `repCompleted: boolean` cuando su ciclo cumple todos los gates. `BicepCurlTracker` tiene el único contador `reps` y lo incrementa cuando `leftRes.repCompleted || rightRes.repCompleted` con `repCooldown === 0`. Tras contar, activa un cooldown de **15 frames (~250 ms a 60 fps)**. El cooldown absorbe la señal del segundo brazo en curls bilaterales (llega en 0-50 ms) sin bloquear curls alternos donde el segundo brazo dispara típicamente >500 ms después.  
**Comportamiento resultante:**  
- Curl bilateral (barra o mancuernas simultáneas): 1 rep por ciclo.  
- Curl alterno (mancuernas, un brazo después del otro): 1 rep por brazo → 2 reps por ciclo completo.  
- Vista lateral (un solo brazo visible): 1 rep por ciclo, igual que antes.  
**Trade-off aceptado:** En curls alternos muy rápidos (<250 ms entre brazos), el cooldown podría suprimir el segundo brazo. A 60 fps y con la cadencia normal de un curl (>500 ms por brazo), este caso no debería ocurrir en condiciones reales de entrenamiento.
