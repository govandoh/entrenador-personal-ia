# Arquitectura del proyecto

> Documento vivo. Se actualiza a medida que el proyecto evoluciona.  
> Última actualización: 2026-04-29 — Fase 1: pipeline cámara + esqueleto.

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

### `src/ui/CameraView.tsx`
Componente React responsable del ciclo de vida de la cámara dentro de React. Usa `useEffect` para inicializar el detector y la cámara al montar, y limpia el stream y el `requestAnimationFrame` al desmontar. Mantiene estado de UI (`loading` / `ready` / `error`) para mostrar mensajes al usuario. Es el único lugar donde vive `requestAnimationFrame`.

### `src/exercises/` (próximas semanas)
Un archivo por ejercicio, más un `baseExercise.ts` con la máquina de estados genérica. Cada ejercicio define qué ángulos medir y cuáles son los umbrales para las fases `down` / `up` y para el nivel de feedback.

### `src/geometry/angles.ts` (próximas semanas)
Una función pura: `calculateAngle(A, B, C): number`. Recibe tres landmarks, devuelve el ángulo en grados usando `Math.atan2`. Sin efectos secundarios, fácil de testear de forma aislada.

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
