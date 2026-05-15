# Arquitectura del proyecto

> Documento vivo. Se actualiza a medida que el proyecto evoluciona.  
> Última actualización: 2026-05-06 — Fase 1b: onboarding PWA de 4 pantallas.

---

## Visión general

La aplicación es una PWA que corre completamente en el cliente (sin servidor). La cámara del celular alimenta un pipeline de detección de poses que produce landmarks en cada frame; esos landmarks se usan para calcular ángulos articulares, contar repeticiones y dar retroalimentación visual.

```
Cámara (getUserMedia)
      │
      ▼
 <video> element  ──────────────────────────────────┐
      │                                              │
      ▼                                              ▼
 MediaPipe PoseLandmarker              <canvas> overlay
 detectForVideo(video, timestamp)      DrawingUtils.drawConnectors()
      │                                DrawingUtils.drawLandmarks()
      ▼
 landmarks[33]  (x, y, z, visibility)
      │
      ▼
 geometry/angles.ts
 calculateAngle(A, B, C) → grados
      │
      ▼
 exercises/*.ts
 máquina de estados → phase, reps, feedback
      │
      ▼
 ui/FeedbackOverlay.tsx
 color según feedback (verde / amarillo / rojo)
```

---

## Módulos y responsabilidades

### `src/pose/camera.ts`
Único punto de contacto con la API del navegador para la cámara. Solicita el stream con `getUserMedia`, aplica las constraints de mobile (`facingMode: 'environment'`, resolución ideal 640×480), y conecta el stream al elemento `<video>`. Expone `startCamera()` y `stopCamera()` como funciones puras sin estado interno.

### `src/pose/poseDetector.ts`
Encapsula el ciclo de vida de `PoseLandmarker`. Tiene estado interno de módulo (singleton): una vez inicializado, el landmarker se reutiliza en todos los frames. Expone `initPoseDetector()` (async, llamar una vez al montar) y `detectAndDraw()` (llamar en cada frame del loop de animación). El dibujo del esqueleto vive aquí mientras no haya lógica de feedback por color; cuando exista `FeedbackOverlay`, el dibujo se separará.

### `src/ui/Onboarding/`
Flujo de onboarding de 4 pantallas que se muestra la primera vez que el usuario abre la app (controlado por `localStorage('ob_complete_v1')`).

- **`OnboardingFlow.tsx`** — Orquestador: mantiene el índice de pantalla activo y renderiza la pantalla correspondiente. La pantalla Splash auto-avanza a los 2.8s; las demás esperan acción del usuario.
- **`SplashScreen.tsx`** — Logo animado (SVG inline con gradiente verde-teal y landmarks amarillos), nombre de la app y loader de tres puntos pulsantes.
- **`HowItWorksScreen.tsx`** — Tres step-cards que explican el flujo: apuntar cámara → detección de pose → feedback de técnica. Iconos SVG inline por paso.
- **`PermissionsScreen.tsx`** — Solicita permisos de cámara (`getUserMedia`) y notificaciones (`Notification.requestPermission`) con contexto claro antes de que el navegador muestre el diálogo nativo. Si el usuario deniega la cámara, CameraView lo maneja con su propio mensaje de error.
- **`GetStartedScreen.tsx`** — Ilustración SVG del esqueleto de pose detection, selector visual de cámara frontal/trasera (guarda en `localStorage('preferred_camera')`), y botón CTA que llama `onComplete()`.
- **`onboarding.css`** — Todos los estilos del onboarding aislados. Usa `@keyframes` con `animation-delay` escalonado para el efecto stagger en cada pantalla. Design tokens en `:root`.

**Flujo de datos:**
```
App.tsx
  └─ localStorage('ob_complete_v1') === '1'?
       No → <OnboardingFlow onComplete={handleComplete} />
               └─ onComplete() → localStorage.setItem + setReady(true)
       Sí → <CameraView />
               └─ useState inicial lee localStorage('preferred_camera')
```

### `src/ui/CameraView.tsx`
Componente React responsable del ciclo de vida de la cámara y del ejercicio activo.
- `squatTrackerRef` / `curlTrackerRef` — instancias en `useRef`. Persisten entre cambios de cámara y de ejercicio.
- `activeExRef` — ref (no estado) al ejercicio activo, leído en el RAF loop para evitar stale closures.
- En cada iteración del RAF: llama `detectAndDraw()`, pasa landmarks al tracker activo, dispara voz en transiciones, actualiza `exerciseResult`.
- Botón inferior izquierdo: selector de ejercicio (cicla squat → curl → …). Al cambiar, ambos trackers se resetean.
- Botón inferior derecho: selector de cámara frontal/trasera (sin cambios respecto a v1).
- Renderiza `<ExerciseOverlay>` con el resultado y el nombre del ejercicio activo.

### `src/ui/ExerciseOverlay.tsx`
Overlay DOM sobre el video (no canvas). Recibe una interfaz mínima `OverlayResult { reps, feedbackLevel, feedbackMessage }` y un prop `exerciseName: string`. Compatible estructuralmente con `SquatResult` y `BicepCurlResult`. Renderiza:
- Label de ejercicio (top-left, pill semitransparente)
- Barra inferior (`ex-bottom-bar`): fondo negro 80% + blur, borde izquierdo colorido via `--feedback-color` CSS custom property, mensaje de feedback (izquierda) y contador de reps (derecha).
- El contador usa `key={result.reps}` para que React remonte el `<span>` y reinicie la animación CSS `ex-rep-pop` en cada nueva rep.
- `pointer-events: none` en el contenedor — los toques pasan al botón de cámara (z-index: 10).

**Detección de fondo en `SquatTracker`:**

```
Frame N:   kneeAngle baja → minAngleSeen se actualiza, prevKneeAngle = N
Frame N+1: kneeAngle sube > prevKneeAngle + 2° → atBottom = true (un solo frame)
           voz evalúa minAngleSeen (no kneeAngle actual)
Frame N+2: bottomFired = true → atBottom = false en todos los frames restantes
Al volver a standing → reset: bottomFired = false, minAngleSeen = 180
```

`GOOD_DEPTH_ANGLE` se exporta desde `squat.ts` para que `CameraView` use el mismo umbral sin duplicarlo.

### `src/ui/useSpeech.ts`
Hook de voz que envuelve `window.speechSynthesis`. Expone `speak(text)` memoizado con `useCallback`. Cancela la locución anterior antes de cada nueva para evitar cola de mensajes. Idioma: `es-ES`. Disparado desde `CameraView` solo en transiciones de estado (no por frame) vía `prevRef`.

### `src/geometry/angles.ts`
Módulo de geometría pura sin dependencias externas. Expone:
- `Point2D` — tipo mínimo `{ x: number; y: number }`. Compatible estructuralmente con `NormalizedLandmark` de MediaPipe (que tiene campos adicionales `z` y `visibility`).
- `calculateAngle(A, B, C): number` — ángulo en el vértice B usando `atan2`. Rango: 0–180°. Sin efectos secundarios; apto para pruebas unitarias aisladas.

```
radians = atan2(Cy−By, Cx−Bx) − atan2(Ay−By, Ax−Bx)
degrees = |radians × 180/π|
if degrees > 180 → degrees = 360 − degrees
```

### `src/exercises/squat.ts`
Máquina de estados para sentadilla. Exporta la clase `SquatTracker` con:
- `update(landmarks: NormalizedLandmark[]): SquatResult` — recibe los 33 landmarks del frame actual, devuelve fase, reps, nivel de feedback y mensaje.
- `reset()` — reinicia la fase y el contador.

**Diagrama de estados:**
```
         kneeAngle > 160°               kneeAngle < 100°
standing ──────────────────► transition ◄──────────────────── squatting
   ▲                           │   ▲                              │
   │     kneeAngle > 160°      ▼   │      kneeAngle < 100°        │
   └─────────────────────── (zona) ────────────────────────────────┘
                           100°–160°
                         (conserva fase)

Rep contada: squatting → standing
```

**Umbrales:** `STANDING_ANGLE=160°`, `BOTTOM_ANGLE=100°`, `GOOD_DEPTH=90°`.  
**Feedback:** verde `<90°`, amarillo `100–90°`, idle en transición/de pie.  
**Visibilidad:** si algún landmark clave (caderas, rodillas, tobillos) tiene `visibility < 0.5`, se retorna feedback idle sin resetear el estado interno.

### `src/exercises/bicepCurl.ts`
Segundo ejercicio implementado. Exporta `BicepCurlTracker` con el mismo contrato que `SquatTracker` (`update()` / `reset()`).

**Landmarks usados:** LEFT_SHOULDER(11)→LEFT_ELBOW(13)→LEFT_WRIST(15) y RIGHT_SHOULDER(12)→RIGHT_ELBOW(14)→RIGHT_WRIST(16).

**Detección de vista:**
- Visibilidad mínima del trío hombro-codo-muñeca por lado.
- Si `|visLeft - visRight| > 0.35` → vista lateral: solo el brazo más visible.
- Si diferencia menor → vista frontal/45°: ambos brazos.

**Clase interna `ArmTracker`:** Máquina de estados para un solo brazo. Usa el mismo algoritmo de "inversión de tendencia" que `SquatTracker` para detectar la cima real:
```
bajando (ángulo decreciente) → silencio (acumulando minAngleSeen)
cima real (ángulo sube +2°)  → atTop = true, evalúa minAngleSeen
subiendo → silencio
extendido → voz dice el número de rep
```

**Umbrales:** `EXTENDED_ANGLE=160°`, `FLEXED_ANGLE=60°`, `GOOD_FORM_ANGLE=50°`.

**Conteo:** Cada `ArmTracker` lleva sus propias reps; `BicepCurlTracker.reps` = suma de ambos. Soporta reps alternas (mancuernas) y simultáneas (barra).

### `src/exercises/` (próximas semanas)
Los ejercicios pendientes (press de hombro, plancha, lunges) seguirán el patrón de `SquatTracker` y `BicepCurlTracker`. Cuando haya 3+ ejercicios se evaluará si extraer `baseExercise.ts` con la lógica compartida.

### `src/storage/session.ts` (próximas semanas)
Wrapper de `localStorage` para persistir el historial de sesiones (ejercicio, reps, duración, fecha). No depende de ningún otro módulo del proyecto.

---

## Decisiones de diseño

### Video + Canvas superpuestos
El video ocupa la pantalla completa con `object-fit: cover`. El canvas se superpone con `position: absolute; inset: 0` y el mismo tamaño CSS. El canvas tiene fondo transparente por defecto, así el video se ve a través de él y solo el esqueleto dibujado es visible.

**Por qué no dibujar directamente sobre el video:** El elemento `<video>` no expone un contexto 2D. El canvas es el único mecanismo estándar para superponer gráficos sobre un stream de video en el browser.

**Dimensiones internas del canvas:** En cada frame, `canvas.width` y `canvas.height` se sincronizan con `video.videoWidth` y `video.videoHeight` (resolución real del stream). El CSS estira el canvas para llenar el contenedor. Esto garantiza que los landmarks (que vienen normalizados 0–1 por MediaPipe) se dibujen con la misma relación de aspecto que el video real.

### Singleton de módulo para PoseLandmarker
`PoseLandmarker` se crea una vez y se guarda en una variable de módulo (`let landmarker`). La inicialización es cara (descarga del modelo ~5 MB, compilación WASM); rehacerla en cada render o en cada montaje de componente sería un error de rendimiento severo. El patrón de singleton de módulo es más simple que un Context de React y suficiente para este caso donde solo hay una instancia activa de la cámara.

### Separación de inicialización y detección
`initPoseDetector()` es una operación async de una sola vez. `detectAndDraw()` es síncrona y se llama 30-60 veces por segundo. Mantenerlas separadas permite que el componente muestre un estado de carga mientras el modelo se descarga, sin bloquear el hilo principal.

### Loop de animación en React (`useEffect` + `requestAnimationFrame`)
El loop de `requestAnimationFrame` se inicia dentro de `useEffect` y se cancela con `cancelAnimationFrame` en el cleanup. La variable `cancelled` (flag booleano local al efecto) previene actualizaciones de estado sobre un componente ya desmontado, lo que generaría memory leaks y warnings de React.

### `facingMode: 'environment'` como default
La cámara trasera del celular tiene mejor calidad óptica y permite al usuario verse a sí mismo durante el ejercicio usando la pantalla como espejo. Para ejercicios donde el usuario necesita ver sus propias manos (bíceps curl), esta configuración es la correcta. Si en el futuro se necesita la cámara frontal, se expone como parámetro de `startCamera()`.

### Mobile-first: `dvw` / `dvh` y `viewport-fit=cover`
Se usa `100dvw` / `100dvh` (dynamic viewport units) en lugar de `100vw` / `100vh` porque en móviles las barras del navegador cambian de tamaño al hacer scroll, y las unidades dinámicas se adaptan a ese cambio. `viewport-fit=cover` en el meta viewport permite que el contenido llegue hasta el notch en iPhones con `padding-safe-area` cuando sea necesario.

---

## Lo que está pendiente de arquitectura

| Área | Decisión pendiente |
|---|---|
| Separación de dibujo y feedback | Cuando exista la lógica de color (verde/rojo/amarillo), `detectAndDraw` se dividirá: MediaPipe detecta, `FeedbackOverlay` dibuja según el nivel de feedback |
| Routing entre pantallas | Al agregar `ExerciseSelector`, se necesita decidir si usar estado de React (`useState`) o un router mínimo (`wouter` o React Router). Preferir estado hasta que la complejidad lo justifique |
| Plugin PWA | Diferido hasta semana 5-6. Ver DEC-006 en `DECISIONS.md` |
| Plataforma de deploy | GitHub Pages, Vercel o Netlify. Sin decidir aún |
