# DEC-060 · Responsive y áreas seguras como regla de diseño y de funcionalidad

- **Estado:** Aceptada
- **Fecha:** 2026-09-24
- **Decisores:** Equipo (pedido explícito del responsable del proyecto), Workstream E
- **Etiquetas:** ui, accesibilidad, proceso

## Contexto y problema

Al probar el PR de la Fase 1 en un celular, el paso 3 del cuestionario no bajaba al marcar el equipo: el contenedor usaba `min-height: 100dvh` y crecía con el contenido; con el `body` en `overflow: hidden`, lo de abajo quedaba fuera de alcance. La revisión encontró el mismo tipo de fallo en otros lugares:
- el paso 4 del cuestionario y su botón "Crear mi programa", inalcanzables;
- la bienvenida sin margen para el notch;
- botones que se encogían a 30 px en pantallas bajas;
- el texto del botón principal partido en dos líneas a 320 px;
- la barra superior del entrenamiento bajo la Dynamic Island.

Las pruebas unitarias no pueden ver nada de esto: son fallos de maquetación que solo aparecen en ciertos tamaños.

## Opciones consideradas

1. **Revisión manual en uno o dos celulares por PR** — barata, pero no cubre la variedad de tamaños ni detecta a tiempo lo que solo pasa con notch o en horizontal.
2. **Regla escrita + tokens de áreas seguras + auditoría automática en una matriz de tamaños** (elegida).

## Decisión

La app debe ser responsiva y funcional en cualquier celular, en vertical y en horizontal, respetando notch, Dynamic Island, esquinas redondeadas y barra de gestos. Se concreta así:

- **Matriz mínima de dispositivos** (ancho × alto en px CSS):
  - Android 320×568 y 360×740, y Pixel 7 412×915;
  - iPhone SE 375×667;
  - iPhone 15 Pro 393×852 y 15 Pro Max 430×932, ambos con Dynamic Island;
  - iPhone 15 Pro en horizontal, 852×393.
- **Áreas seguras solo desde tokens:** `--safe-top/right/bottom/left` y `--gutter-left/right` en `src/ui/tokens.css`; nadie escribe `env(safe-area-inset-*)` fuera de ahí. Todo contenedor de pantalla completa o fijo se aparta de esas zonas.
- **Scroll:** un contenedor de pantalla completa con scroll usa `height`, nunca `min-height`, y `overflow-y: auto`. Sus hijos no se encogen (`flex-shrink: 0`): si no caben, la pantalla se desplaza.
- **Texto:** ningún control parte su texto fuera de su caja; el botón principal va en una sola línea con tamaño `clamp()`. Los títulos con mayúsculas acentuadas usan interlineado de 1,1 como mínimo.
- **Tamaños:** los elementos grandes (anillo de 33 nodos, nivelador, contador) escalan con `min()`/`clamp()` sobre `vw` y `dvh`.
- **Objetivos táctiles:** 44 px, y nunca por debajo de 40 px en ningún tamaño.
- **Verificación:** `scripts/audit-responsive.cjs` recorre la matriz con las áreas seguras simuladas y debe terminar en "SIN PROBLEMAS" antes de pedir revisión de un PR de UI. Comprueba desbordes, alcance con el dedo, áreas seguras, texto y objetivos táctiles. Se sigue exigiendo la prueba en un celular real (regla dura 1).

Se propone, como paso siguiente y con su propia DEC, añadir `@playwright/test` para correr la auditoría en CI; hoy el script usa un Playwright instalado aparte y no es dependencia del repo.

## Consecuencias

### Positivas

- El fallo que reportó el equipo y otros seis del mismo tipo quedan corregidos y cubiertos por una comprobación repetible.
- Las áreas seguras se ajustan en un solo lugar.

### Negativas

- La auditoría no corre todavía en CI: depende de que quien abre el PR la ejecute.
- Las áreas seguras reales solo se ven en el dispositivo: la auditoría las simula con los valores típicos de cada modelo.

## Referencias

- `docs/DESIGN.md` §7, `src/ui/tokens.css`, `scripts/audit-responsive.cjs`.
- `DEC-058` (identidad y movimiento), regla dura 1 de `AGENTS.md` (mobile-first).
