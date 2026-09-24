# DEC-054 · Integración de fitnetv2 en este repositorio por pasos y por workstream

- **Estado:** Aceptada
- **Fecha:** 2026-09-24
- **Decisores:** responsable del proyecto; leads de los workstreams B, D y E
- **Etiquetas:** proceso, arquitectura, analysis-core, ui, dominio

## Contexto y problema

El MVP académico se bifurcó en dos líneas del mismo grupo:

- **Este repositorio** (`govandoh/entrenador-personal-ia`) añadió la fundación de Fitnet: DEC-001..035, `AGENTS.md`, CI con Vitest, fixtures y 32 golden (PR 1), capa agéntica y tablero de issues. El análisis sigue siendo 2D por reglas.
- **fitnetv2** (`ecaldcc/07-FitNet`, desplegado en fitnetv2.netlify.app) añadió unas 10 500 líneas en 4 commits sobre el MVP (d456e95, 821abcb, 82e8783): análisis sobre `worldLandmarks`, validación temporal de repeticiones, fatiga, filtro One Euro, nivelación con acelerómetro, calibración de pie, catálogo de 60 ejercicios, rutinas con plantillas y editor, modo manual, perfil con logros, tutoriales y visor 3D con three.js. Sus decisiones son DEC-026..043, números que aquí ya tienen otro contenido.

fitnetv2 no tiene Vitest (usa `scripts/pruebas-motor.mjs`), ni cuestionario de personalización, ni generador de rutinas, ni paywall. Su análisis de código (septiembre 2026) encontró además estos defectos:

- constantes en frames en curl y press (`REP_COOLDOWN_FRAMES = 15`, confirmación de pico a `0.5°/frame × 3`);
- el término de asimetría de la fatiga es siempre ≈ 0;
- el "arqueo lumbar" del press es inclinación absoluta del tronco, evaluada sin exigir cadera visible;
- la nivelación ignora en silencio inclinaciones de más de 60°;
- `setState` por frame;
- pérdida de datos en `loadRoutines` y `saveSession`.

## Opciones consideradas

1. **Adoptar fitnetv2 como base y traer la fundación encima.** Conserva la UI tal cual, pero habría que rehacer la fundación documental, CI y golden sobre un árbol con lógica dentro de componentes, sin tests unitarios y con numeración de DEC en conflicto.
2. **Copiar fitnetv2 de una vez sobre este repositorio.** Rápido, pero es un PR de más de 10 000 líneas imposible de revisar, que rompe los golden sin DEC y mete dos dependencias de golpe.
3. **Este repositorio es la base; fitnetv2 entra por pasos ordenados por workstream** (elegida).

## Decisión

Este repositorio es la base (CI, golden, documentación, tablero). El código de fitnetv2 se integra en cinco pasos. Cada paso se refactoriza solo lo necesario para cumplir las reglas del repo:

- análisis puro, que recibe `t` del frame;
- umbrales temporales en ms;
- lógica de dominio fuera de los componentes;
- dependencias con DEC;
- tests Vitest.

La autoría es del mismo grupo; cada commit cita el commit de origen en fitnetv2. fitnetv2 no se modifica.

| Paso | Contenido | Workstream | Golden | Estado |
|---|---|---|---|---|
| I-1 | Motor puro: `vectors3d`, `gravityAlign` (parte pura de la nivelación), `landmarkFilter`, `standingCalibration`, `movementQuality`, `fatigue`, `demoPoses`; banco de pruebas portado a Vitest | B | Intactos | **Hecho** (commit 802e6c8) |
| I-2 | Trackers 3D sustituyen a los 2D, con los defectos corregidos (cooldown y pico en ms/margen, asimetría en el punto de esfuerzo, cadera visible y fase en el press, calibración congelada durante el ejercicio); fixtures sintéticos con `world` | B | **Cambian** (DEC-044 y esta) | Pendiente |
| I-3 | `poseDetector` devuelve `{screen, world}` y variante lite/full; `DeviceGravityTracker` como adaptador DOM de `GravityEstimator`; permiso de sensores en iOS | A | Intactos | Pendiente |
| I-4 | UI: catálogo, rutinas, editor, modo manual, perfil y logros, tutoriales (lazy), `Pose3DView` (lazy), router | E + D | Intactos | Pendiente |
| I-5 | Cuestionario, generador de rutinas y paywall (trabajo nuevo, DEC-056) | D + E | Intactos | Pendiente |

**Numeración.** Las DEC-026..043 de fitnetv2 se importan como **DEC-036..053** (desplazamiento fijo de +10), con su contenido literal, una línea de origen y notas de integración. DEC-001..025 coinciden en ambos repositorios.

| fitnetv2 | Aquí | Tema |
|---|---|---|
| DEC-026 | DEC-036 | Análisis 3D con `worldLandmarks` |
| DEC-027 | DEC-037 | Validación temporal de repeticiones |
| DEC-028 | DEC-038 | Fatiga por degradación del movimiento |
| DEC-029 | DEC-039 | Visor 3D con three.js |
| DEC-030 | DEC-040 | Catálogo de ejercicios y modelo de rutinas |
| DEC-031 | DEC-041 | Perfil, progreso y logros derivados |
| DEC-032 | DEC-042 | HashRouter y contexto de React |
| DEC-033 | DEC-043 | Tutorial de técnica por ejercicio |
| DEC-034 | DEC-044 | Fondo de sentadilla independiente de los fps |
| DEC-035 | DEC-045 | Histéresis y forma del ciclo |
| DEC-036 | DEC-046 | Filtro One Euro |
| DEC-037 | DEC-047 | Modo manual |
| DEC-038 | DEC-048 | Banco de pruebas sin cámara |
| DEC-039 | DEC-049 | Tuteo en la interfaz |
| DEC-040 | DEC-050 | Nivelación con el acelerómetro |
| DEC-041 | DEC-051 | Íconos sin emojis |
| DEC-042 | DEC-052 | Editor de rutinas con guardado explícito |
| DEC-043 | DEC-053 | Calibración con la postura de pie |

**Ubicación.** `src/analysis/` se añade al workstream B junto a `src/geometry/` y `src/exercises/`. El filtro, la calibración y la parte pura de la nivelación viven en `src/geometry/` y no en `src/pose/`: son matemática pura, no captura.

## Consecuencias

### Positivas

- La app en producción no cambia hasta I-2, y cada paso es revisable y reversible.
- Las comprobaciones de fitnetv2 pasan a CI (91 tests en I-1) y protegen los pasos siguientes.
- Los defectos de fitnetv2 se corrigen al integrar, no después.
- `demoPoses` da fixtures 3D sintéticos que hoy no existen (ningún fixture del PR 1 trae `world`).

### Negativas

- Durante la integración conviven dos versiones desplegadas (Vercel y Netlify) con capacidades distintas.
- I-2 cambia snapshots golden: exige revisar cada diferencia de comportamiento.
- Hay que mantener la tabla de equivalencias de numeración mientras se cite el código de fitnetv2.

## Referencias

- `ecaldcc/07-FitNet`, commits d456e95, 821abcb y 82e8783.
- DEC-036..053 (importadas), `DEC-055` (núcleo de IA), `DEC-056` (rutina personalizada).
- `ARCHITECTURE.md` §2.4 (migración por PRs), `fixtures/README.md` (comportamientos congelados).
