# DEC-008 · Onboarding: implementado en React con CSS nativo

- **Estado:** Aceptada
- **Fecha:** 2026-05-06
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** onboarding, ui

## Contexto y problema

El alcance del MVP no incluía onboarding, pero el equipo decidió agregarlo antes de la entrega porque la app arranca directamente en la cámara sin contexto para el usuario. Se evaluó si usar una librería de animaciones o slides (Framer Motion, Swiper).

## Opciones consideradas

1. **Framer Motion para animaciones** — ~150 KB; overkill para 4 pantallas estáticas con transición slide-in unidireccional.
2. **Swiper.js para el swipe entre pantallas** — overkill para el mismo caso.
3. **CSS puro con `@keyframes`** (elegida) — mismo resultado visual sin agregar dependencias al `package.json`.

## Decisión

CSS nativo con `@keyframes` y `animation-delay` escalonado produce el mismo resultado visual sin agregar dependencias al `package.json`. Framer Motion (~150 KB) y Swiper son overkill para 4 pantallas estáticas con transición slide-in unidireccional. La animación de "stagger" se logra con `:nth-child` + `animation-delay`, técnica estándar y sin JS.

### Decisiones de diseño

- Design system combinado: Apple Fitness (tipografía bold, blanco puro) + Samsung Health (cards redondeadas en gris claro) + Strava (CTA naranja `#FC4C02`).
- Splash auto-avanza a los 2.8s; las demás pantallas requieren acción del usuario.
- PermissionsScreen llama a `getUserMedia` con el contexto visible para que el navegador muestre el diálogo de permiso con sentido para el usuario.
- GetStartedScreen guarda la preferencia de cámara en `localStorage('preferred_camera')` y `CameraView` la lee en el `useState` inicial, sin props drilling.
- `localStorage('ob_complete_v1')` controla si el onboarding ya fue completado; la clave incluye versión para poder forzar re-show si se cambia el flujo en el futuro.

## Consecuencias

### Positivas

- El usuario recibe contexto antes de llegar a la cámara, en lugar de arrancar directamente en ella.
- No se agregan dependencias al `package.json`: se evitan Framer Motion (~150 KB) y Swiper.
- El efecto "stagger" se logra con `:nth-child` + `animation-delay`, técnica estándar y sin JS.
- El diálogo de permiso de cámara aparece con contexto visible para el usuario (PermissionsScreen).
- La preferencia de cámara viaja por `localStorage('preferred_camera')` sin props drilling.
- La clave versionada `ob_complete_v1` permite forzar re-show del onboarding si se cambia el flujo en el futuro.

### Negativas

- Se amplía el alcance del MVP con una funcionalidad no prevista originalmente, antes de la entrega.
- La animación queda limitada a un slide-in unidireccional; transiciones más complejas requerirían más CSS a mano o reconsiderar una librería.
- El estado del onboarding y la preferencia de cámara dependen de `localStorage`, cuyo acceso puede fallar en algunos navegadores (ver `DEC-024`).

## Referencias

- `DEC-013` (el tap "Comenzar a entrenar" del onboarding desbloquea el contexto de audio en iOS).
- `DEC-024` (acceso defensivo a `localStorage` para `ob_complete_v1` y `preferred_camera`).
- `src/ui/Onboarding/OnboardingFlow.tsx`
- `src/ui/Onboarding/SplashScreen.tsx`
- `src/ui/Onboarding/PermissionsScreen.tsx`
- `src/ui/Onboarding/GetStartedScreen.tsx`
- `src/ui/CameraView.tsx`
