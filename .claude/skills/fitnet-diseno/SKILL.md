---
name: fitnet-diseno
description: Aplicar la identidad visual y el sistema de movimiento de Fitnet (la red de 33 puntos, paleta Tinta/Voltaje/Índigo, Barlow, catálogo de animaciones) a cualquier pantalla, componente o animación de `src/ui/**`, `index.html` o `public/**`. Úsala antes de diseñar o tocar interfaz, al añadir o revisar una animación, y antes de pedir revisión de un PR de UI. Es la capa de adaptación de las skills de Emil Kowalski (`animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `emil-design-eng`, `mobile-native`, `pick-ui-library`, `animation-vocabulary`) a este repo; sus reglas prevalecen sobre ellas.
---

# /fitnet-diseno — identidad y movimiento de Fitnet

La especificación completa (tokens, componentes, catálogo de momentos) está en `docs/DESIGN.md` y la decisión en `DEC-058`. Esta skill dice **cómo aplicarlas** y **qué skill de Emil usar en cada caso**, con las adaptaciones de Fitnet.

## 1. Antes de escribir código

1. Lee `docs/DESIGN.md` completo si no lo has leído en la sesión.
2. Ubica la tarea en el catálogo de momentos (sección 6 de `DESIGN.md`). Si la animación que te piden no está, pasa primero por el filtro de la skill `animate` (pasos 1 y 2: ¿debe animarse?, ¿con qué propósito?) y, si sobrevive, añádela al catálogo en el mismo PR.
3. Usa los tokens de `src/ui/tokens.css`. Si aún no existe, créalo con los valores de `DESIGN.md` (colores, tipografía, radios, curvas y duraciones) antes de la primera pantalla. **Nunca** escribas un hex, una curva o una duración suelta en un componente.

## 2. Qué skill de Emil usar

| Necesito… | Skill | Adaptación Fitnet |
|---|---|---|
| Construir una animación | `animate` (+ `RECIPES.md`) | Herramienta: CSS, `@starting-style` o WAAPI. Donde la receta use Motion, tradúcela a WAAPI o propone DEC. |
| Revisar un diff con movimiento | `review-animations` (+ `STANDARDS.md`) | Añade a su tabla de bloqueos: animación que provoque render de React por cuadro durante el entrenamiento; hex o curva fuera de los tokens. |
| Auditar todo el movimiento de la app | `improve-animations` | Los planes resultantes se guardan como issues con etiqueta `ws:E-app`, no como archivos sueltos en la raíz. |
| Buscar dónde falta o sobra movimiento | `find-animation-opportunities` | Contrasta cada propuesta con el catálogo de `DESIGN.md`. |
| Criterio general de pulido (sombras, bordes, detalles) | `emil-design-eng` | Nuestros bordes son la tarjeta de borde doble de `DESIGN.md`; no mezclar con otro estilo. |
| Que la PWA se sienta nativa en el celular | `mobile-native` | Ya usamos `100dvh` y `viewport-fit=cover`; si tocas `public/sw.js`, sube `CACHE` (`DEC-025`). |
| Elegir una librería | `pick-ui-library` | **Ninguna librería se instala sin DEC** (regla dura 9, `DEC-008`). Primero: HTML nativo (`<dialog>`, `popover`), CSS y WAAPI. Ya aprobadas: `react-router-dom` (`DEC-042`), `three` (`DEC-039`, siempre con `React.lazy`). |
| Nombrar un efecto | `animation-vocabulary` | — |

## 3. Reglas de Fitnet que mandan sobre las skills de Emil

1. **Sin librerías nuevas.** Ni Tailwind, ni shadcn, ni `motion`, ni NumberFlow, ni Sonner sin una DEC aprobada. Los patrones de Cult UI se rehacen en CSS (tabla en `DESIGN.md`, sección 8).
2. **Presupuesto de la cámara.** En `CameraView` y cualquier pantalla con detección activa: solo `transform`/`opacity` sobre elementos DOM, sin `setState` por cuadro para animar, sin filtros `blur()` sobre el video, sin sombras animadas. El esqueleto se dibuja en el canvas.
3. **La voz y la isla dicen lo mismo.** Un aviso visual de técnica siempre sale de `FeedbackPolicy` (`src/feedback/`), nunca de reglas en el componente.
4. **Movimiento reducido desde el primer commit**, con la variante de la tabla de `DESIGN.md`.
5. **Español en la interfaz, tuteo (`DEC-049`), sin emojis (`DEC-051`)**; identificadores en inglés.
6. **Nada de Apple como estilo.** Estructura sí (título grande, tarjetas, acciones abajo); colores y anillos, no: usamos el anillo de 33 nodos y la paleta propia.

## 4. Verificación antes de pedir revisión

- [ ] Ningún valor de color, curva o duración fuera de `src/ui/tokens.css` (`grep -nE "#[0-9A-Fa-f]{6}|cubic-bezier|[0-9]+ms" src/ui --include=*.tsx`).
- [ ] Cada animación nueva está en el catálogo de `docs/DESIGN.md` con frecuencia, propósito, curva, duración y variante reducida.
- [ ] `prefers-reduced-motion` probado (en el sistema o con DevTools).
- [ ] Responsive y áreas seguras (`DEC-060`): `node scripts/audit-responsive.cjs` termina en "SIN PROBLEMAS" en toda la matriz (320×568 a 430×932, Dynamic Island y horizontal). Nunca `env(safe-area-inset-*)` fuera de `tokens.css`, nunca `min-height: 100dvh` en un contenedor con scroll.
- [ ] Probado en celular real; en el PR se dice en cuál y qué no se pudo probar.
- [ ] `pnpm check` en verde y el shell dentro del presupuesto de 350 kB gz.
- [ ] Revisión con `review-animations` sobre el diff si hubo movimiento.
