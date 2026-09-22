# DEC-021 · Delay de 450 ms al cambiar de cámara en PWA instalada

- **Estado:** Aceptada
- **Fecha:** 2026-05-15
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** pwa, pose-engine

## Contexto y problema

Al cambiar entre cámara frontal y trasera desde el PWA instalado (modo standalone), `getUserMedia` lanzaba "Could not start video source" de forma intermitente — error que no aparecía al usar la app desde el navegador. La causa: `track.stop()` es síncrono en la API JavaScript, pero el hardware del dispositivo (sensor de cámara) no libera el recurso de forma inmediata; llamar `getUserMedia` antes de que el hardware esté libre produce la colisión.

### Por qué solo en PWA instalada

El navegador introduce su propio buffer de tiempo entre páginas o pestañas, lo que da margen suficiente para que el hardware se libere. El PWA standalone no tiene ese buffer — el cambio de cámara ocurre dentro del mismo proceso y el ciclo stop → start es inmediato.

## Opciones consideradas

1. **Reintentar `getUserMedia` con backoff exponencial** — mayor complejidad y el usuario ve el error momentáneamente.
2. **Detectar el error específico "Could not start video source" y recuperar** — frágil, el mensaje de error varía por navegador y versión.
3. **Flag `cameraStopPendingRef` con espera de 450 ms antes de `getUserMedia`** (elegida) — valor empírico conservador que cubre la mayoría de dispositivos Android e iOS.

## Decisión

Flag `cameraStopPendingRef` (booleano) que se activa en el cleanup del `useEffect` cuando se detiene un stream. Al inicio del siguiente `setup()`, si el flag está activo, se espera 450 ms antes de llamar `getUserMedia`. Los 450 ms son un valor empírico conservador que cubre la mayoría de dispositivos Android e iOS. El flag se resetea al inicio del delay para no acumular esperas en cambios rápidos sucesivos.

## Consecuencias

### Positivas

- Elimina el error intermitente "Could not start video source" al cambiar de cámara en el PWA standalone.
- Solución simple y determinista, sin reintentos ni dependencia del texto del mensaje de error.
- El delay solo aplica cuando hubo un stream detenido previamente (flag activo), no en el primer arranque.
- El reset del flag al inicio del delay evita acumular esperas en cambios rápidos sucesivos.

### Negativas

- Se introduce una espera fija de 450 ms en cada cambio de cámara, aunque el hardware se libere antes.
- El valor de 450 ms es empírico y cubre "la mayoría" de dispositivos; no hay garantía para todos los modelos Android e iOS.

## Referencias

- `DEC-006` (PWA implementada manualmente, modo standalone donde se manifiesta el bug).
- `src/ui/CameraView.tsx`
