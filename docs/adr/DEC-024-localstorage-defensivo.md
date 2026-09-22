# DEC-024 · localStorage defensivo: try/catch y validación de valor

- **Estado:** Aceptada
- **Fecha:** 2026-05-16
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** storage, pwa

## Contexto y problema

`App.tsx` y `CameraView.tsx` leían y escribían `localStorage` directamente sin manejo de errores. En Safari en modo privado y en algunos navegadores con storage bloqueado por política del sistema operativo o del propio navegador (sandboxed iframes, restricciones corporativas), `localStorage.getItem()` lanza `SecurityError`, rompiendo la inicialización de React. Adicionalmente, `CameraView.tsx` hacía `localStorage.getItem('preferred_camera') as FacingMode` —un cast exclusivamente de TypeScript que no valida en runtime— lo que permitía que un valor inválido (ej. `'back'`, `null`, vacío) llegara como constraint a `getUserMedia`, causando que la cámara fallara con un error críptico.

## Opciones consideradas

1. **Acceso directo a `localStorage` con cast `as FacingMode`** (comportamiento original) — lanza `SecurityError` con storage bloqueado y no valida el valor en runtime.
2. **Solo `?? 'environment'`** — el operador `??` cubre `null` y `undefined` pero no valores inválidos presentes en storage (`'back'`, `'front'`, una cadena vacía), ni el lanzamiento de excepciones de storage bloqueado.
3. **try/catch en los cuatro puntos de acceso + validación explícita del valor** (elegida) — cubre ambos casos.

## Decisión

Envolver los cuatro puntos de acceso (2 `getItem` + 2 `setItem`) en bloques `try/catch`. En el catch, retornar el valor por defecto seguro (`false` para el onboarding, `'environment'` para la cámara) y continuar sin lanzar. En `CameraView`, reemplazar el cast por validación explícita: `v === 'user' || v === 'environment'`; cualquier otro valor cae al default.

### Por qué no solo `?? 'environment'`

El operador `??` cubre `null` y `undefined` pero no valores inválidos presentes en storage (`'back'`, `'front'`, una cadena vacía), ni el lanzamiento de excepciones de storage bloqueado. La combinación try/catch + validación explícita cubre ambos casos.

## Consecuencias

### Positivas

- La inicialización de React ya no se rompe en Safari en modo privado ni en navegadores con storage bloqueado (sandboxed iframes, restricciones corporativas).
- Un valor inválido en `preferred_camera` (`'back'`, `'front'`, cadena vacía) ya no llega como constraint a `getUserMedia`; cae al default `'environment'`.
- Los defaults seguros (`false` para el onboarding, `'environment'` para la cámara) están explícitos en el código.

### Negativas

- Cuando el storage está bloqueado, la preferencia de cámara y el estado de onboarding completado no persisten entre sesiones: el usuario verá el onboarding de nuevo y la cámara arrancará en `'environment'`.
- La validación explícita `v === 'user' || v === 'environment'` debe actualizarse manualmente si se añaden nuevos valores a `FacingMode`.

## Referencias

- `DEC-008` (onboarding, origen de las claves `ob_complete_v1` y `preferred_camera` en `localStorage`).
- `src/App.tsx`
- `src/ui/CameraView.tsx`
