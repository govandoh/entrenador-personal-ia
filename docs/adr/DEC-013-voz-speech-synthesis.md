# DEC-013 · Retroalimentación por voz: Web Speech API (SpeechSynthesis)

- **Estado:** Aceptada
- **Fecha:** 2026-05-06
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** voz, feedback

## Contexto y problema

Los usuarios que usan la cámara frontal tienen los ojos en el espejo de la pantalla y no pueden leer el texto del overlay fácilmente. Se evaluó cómo dar feedback auditivo sin costos ni dependencias externas.

## Opciones consideradas

1. **Audio pregrabado (MP3s)** — requiere assets, más MB, gestión de AudioContext.
2. **Servicio TTS en la nube (AWS Polly, Google TTS)** — costo, latencia, requiere backend.
3. **Web Speech API nativa (`SpeechSynthesis`)** (elegida) — sin dependencias, sin costo, disponible en iOS Safari y Android Chrome modernos.

## Decisión

`SpeechSynthesis` es la opción correcta para este proyecto: zero costo, zero dependencias, cero bytes extra en el bundle, y la API es estable. La voz en `es-ES` está disponible en todos los dispositivos móviles del mercado objetivo (Android 5+ y iOS 7+).

### Detalle de implementación

Hook `useSpeech()` con `speechSynthesis.cancel()` antes de cada locución para evitar acumulación. Disparos solo en transiciones de estado (no por frame): (1) rep completada → número + elogio cada 5/10; (2) llegada al fondo → "¡Buena profundidad!" o "Baja un poco más". El callback de `useSpeech` está memoizado con `useCallback` para evitar que el `useEffect` de RAF se re-ejecute innecesariamente.

### Limitación iOS conocida

El primer `speak()` debe ocurrir en el contexto de un evento de usuario. El tap "Comenzar a entrenar" en el onboarding desbloquea el contexto de audio; las llamadas posteriores desde RAF funcionan correctamente.

## Consecuencias

### Positivas

- Feedback auditivo para usuarios que no pueden leer el overlay mientras se miran en la cámara frontal.
- Zero costo, zero dependencias y cero bytes extra en el bundle; la API es estable.
- La voz en `es-ES` está disponible en todos los dispositivos móviles del mercado objetivo (Android 5+ y iOS 7+).
- Los disparos ocurren solo en transiciones de estado (no por frame), y el callback memoizado con `useCallback` evita re-ejecuciones innecesarias del `useEffect` de RAF.

### Negativas

- Limitación iOS: el primer `speak()` debe ocurrir en el contexto de un evento de usuario; la app depende del tap "Comenzar a entrenar" del onboarding para desbloquear el contexto de audio.
- `speechSynthesis.cancel()` antes de cada locución implica que una locución nueva interrumpe a la anterior si todavía no ha terminado.

## Referencias

- `DEC-008` (onboarding cuyo tap "Comenzar a entrenar" desbloquea el audio en iOS).
- `DEC-014` (detección del fondo real, momento en que se dispara la voz de profundidad).
- `DEC-016` (arquitectura de voz que resuelve las colisiones derivadas de `speechSynthesis.cancel()`).
- `src/ui/useSpeech.ts`
- `src/ui/CameraView.tsx`
