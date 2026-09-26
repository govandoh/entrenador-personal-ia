# DEC-058 · Identidad visual "la red de 33 puntos", sistema de movimiento y skills de animación

- **Estado:** Aceptada (propuesta aprobada por el equipo el 2026-09-24)
- **Fecha:** 2026-09-24
- **Decisores:** Workstream E (App & UI), con revisión de B y D (`docs/adr/README.md`)
- **Etiquetas:** ui, diseño, movimiento, proceso

## Contexto y problema

La Fase 1 añade pantallas nuevas (Hoy, catálogo, cuestionario, programa con Premium simulado, preparación con nivelador, resumen de serie) sobre una app que hoy solo tiene la cámara y el onboarding. El sistema visual vigente viene de `DEC-008` (Apple Fitness + Samsung Health + CTA naranja de Strava) y no tiene tokens, identidad propia ni reglas de movimiento; fitnetv2 trae otro estilo distinto en `app-ui.css`.

En la revisión de la primera propuesta, el equipo pidió tomar Apple y Samsung como referencia de estructura pero con identidad propia, y definir animaciones con las skills de Emil Kowalski (https://emilkowal.ski/skill) y los componentes de Cult UI (https://www.cult-ui.com/) como referencia.

## Opciones consideradas

1. **Mantener el sistema de `DEC-008`** — sin trabajo nuevo, pero es una mezcla de tres marcas ajenas, en tema claro que compite con la cámara, y sin reglas de movimiento.
2. **Adoptar el estilo de fitnetv2** — ya existe en código, pero sus colores y anillos son los de Apple Fitness y no tiene tokens.
3. **Identidad propia con Tailwind, shadcn y `motion` para usar Cult UI tal cual** — componentes listos, pero cambia la forma de escribir estilos de toda la app, añade tres dependencias y suma decenas de kB al shell, que comparte hilo con la detección.
4. **Identidad propia en CSS nativo con tokens, patrones de Cult UI rehechos y las skills de Emil instaladas en el repo** (elegida).

## Decisión

Adoptamos la identidad "la red de 33 puntos" y el sistema de movimiento descritos en `docs/DESIGN.md`, implementados con CSS nativo, `@starting-style` y WAAPI, sin dependencias nuevas.

- **Identidad:** el motivo son los nodos y líneas del esqueleto; el progreso se dibuja con un anillo de 33 nodos (uno por landmark de MediaPipe) en lugar de anillos concéntricos.
- **Paleta:** Tinta `#0B0E14`, Pizarra `#141925`, Voltaje `#D7FF3A` (acción y bien hecho), Índigo `#7B6CFF` (asistente, red y técnica), Ámbar `#FFB547` (corregir), Coral `#FF6B57` (error). Tema oscuro por defecto.
- **Tipografía:** Barlow Condensed (cifras, títulos y botones en itálica mayúscula) y Barlow (texto), licencia OFL, servidas desde la propia app (`src/ui/fonts/`, con hash de Vite para que el service worker no sirva una versión vieja) para funcionar sin conexión y sin pedidos a terceros.
- **Movimiento:** curvas `cubic-bezier(0.23, 1, 0.32, 1)`, `cubic-bezier(0.77, 0, 0.175, 1)` y `cubic-bezier(0.32, 0.72, 0, 1)`; duraciones de 140, 180, 240 y 380 ms; solo `transform` y `opacity`; variante para `prefers-reduced-motion` en cada animación; catálogo cerrado de momentos en `docs/DESIGN.md`, sección 6.
- **Presupuesto de la cámara:** durante el entrenamiento nada anima provocando renders de React por cuadro y no se usan efectos de GPU (shaders, blur sobre video).
- **Cult UI** se usa como referencia de patrones (isla dinámica, tarjeta de textura, número animado, cajón familiar, retícula de puntos, pestañas con dirección), rehechos en CSS; no se instala su stack.
- **Skills:** se instalan en `.claude/skills/` ocho skills de Emil Kowalski (MIT) para web, con una capa de adaptación `fitnet-diseno` cuyas reglas prevalecen. Atribución y licencia en `.claude/skills/THIRD-PARTY.md`.
- Las maquetas de referencia están en el lienzo de diseño "Fitnet · Propuesta de diseño" (privado del equipo; se comparte desde su menú).

Esta DEC reemplaza la sección "Decisiones de diseño" de `DEC-008` (paleta y referencias de marca). Se mantiene de `DEC-008` la decisión de usar CSS nativo sin librerías de animación.

## Consecuencias

### Positivas

- Identidad reconocible y ligada a lo que hace la app (leer 33 puntos del cuerpo), distinta de Apple Fitness y de la competencia (fitnetapp.com).
- Tokens únicos en `src/ui/tokens.css`: un cambio de color o curva se hace en un solo lugar.
- Sin dependencias nuevas ni costo en el bundle más allá de las fuentes (Barlow y Barlow Condensed en woff2, subconjunto latino).
- Las skills dan a cualquier agente el mismo criterio de movimiento, y `review-animations` sirve como revisión automática en los PR de UI.

### Negativas

- Hay que rehacer en CSS lo que Cult UI da hecho con `motion`; el arrastre con inercia de las hojas será más simple que con resortes. Si se queda corto, se propone `motion` con su propia DEC.
- El tema oscuro por defecto deja pendiente un tema claro; se evaluará con uso real.
- El onboarding y la pantalla de cámara actuales deben migrarse a los tokens nuevos; hasta entonces convivirán dos estilos.
- Las skills de Emil se actualizan a mano (procedimiento en `THIRD-PARTY.md`).

## Referencias

- `docs/DESIGN.md` (especificación), `.claude/skills/fitnet-diseno/SKILL.md` (aplicación).
- `DEC-008` (CSS nativo, sistema visual anterior), `DEC-039` (three.js), `DEC-042` (router), `DEC-049` (tuteo), `DEC-051` (íconos sin emojis), `DEC-025` (service worker).
- Emil Kowalski, skills: https://github.com/emilkowalski/skills
- Cult UI: https://github.com/nolly-studio/cult-ui
- ui-ux-pro-max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
