# AGENTS.md — Fitnet

Guía operativa para cualquier agente de IA (Claude Code, Codex, Cursor, Gemini CLI) y para desarrolladores nuevos. Es vendor-neutral; lo específico de Claude Code está en `CLAUDE.md`. Estado vivo del proyecto: `docs/STATUS.md`.

## Qué es Fitnet

PWA mobile-first de entrenamiento con análisis de movimiento en tiempo real. La cámara del celular alimenta MediaPipe Pose (33 landmarks); sobre esos landmarks se cuentan repeticiones, se evalúa la técnica y se dan retroalimentación visual y de voz en español. Nació como MVP del curso IA26 (UMG, mayo 2026) con tres ejercicios (sentadilla, curl de bíceps, press de hombro) y evoluciona hacia una app de gimnasio completa: perfiles, análisis de fatiga/velocidad/consistencia, rutinas y calendario, planes de entrenadores, coaching asistido por IA, rankings, comunidad y modelo freemium. Visión y alcance: `docs/PRODUCT.md`.

## Mapa del repositorio

### Estado actual (`src/`, app Vite única)

| Ruta | Qué hay | Deuda conocida |
|---|---|---|
| `src/pose/camera.ts` | `startCamera`/`stopCamera` con `getUserMedia`. | — |
| `src/pose/poseDetector.ts` | Singleton `PoseLandmarker` (lite, `delegate: 'GPU'`), `detectAndDraw()` detecta **y** dibuja. | Descarta `result.worldLandmarks` (3D); mezcla detección y render. |
| `src/geometry/angles.ts` | `calculateAngle(A,B,C)` con `atan2`, tipo `Point2D` (2D, el que usa producción). | — |
| `src/geometry/{vectors3d,landmarkFilter,gravityAlign,standingCalibration,poseEmbedding}.ts` | Motor 3D puro traído de fitnetv2 (I-1 de `DEC-054`): ángulos 3D, filtro One Euro, nivelación por gravedad, calibración de pie, vector de rasgos del k-NN. Con tests. | Sin conectar a la UI hasta I-2/I-3. |
| `src/analysis/` | `movementQuality` (validación temporal por rep), `fatigue`, `messages`, `poseClassifier` (k-NN, `DEC-055`). Workstream B. Con tests. | Sin conectar a la UI hasta I-2. |
| `src/exercises/{squat,bicepCurl,shoulderPress}.ts` | Trackers con histéresis y gate de confirmación. | Sin interfaz común (`atBottom`/`atTop`/`atPeak`); constantes en frames a 60 fps (`REP_COOLDOWN_FRAMES=15`, `MIN_RISING_FRAMES=3`); `ArmTracker` y `ArmPressTracker` son el mismo detector con polaridad invertida. |
| `src/ui/CameraView.tsx` (299 líneas) | Cámara, loop RAF, selector de ejercicio, reglas de voz. | `if/else` por ejercicio (l. 138-142) y política de voz de DEC-016 inline (l. 146-188); `setState` por frame. |
| `src/ui/ExerciseOverlay.tsx`, `useSpeech.ts`, `Onboarding/` | Overlay DOM, voz `es-ES`, onboarding de 4 pantallas. | — |
| `public/sw.js`, `public/manifest.json` | PWA manual (network-first HTML, cache-first assets). | — |
| `docs/academico/` | Entregables del curso (histórico, no se edita). | — |

### Layout objetivo (monorepo pnpm; se alcanza en el PR 6 de `ARCHITECTURE.md`)

```
apps/web/            shell + features/{workout,capture,routines,profile,trainer}
packages/contracts   @fitnet/contracts   tipos + zod (co-propiedad B y D)
packages/pose-engine @fitnet/pose-engine cámara, detect-only, PoseSource, SkeletonRenderer
packages/analysis-core @fitnet/analysis-core ángulos, features, trackers, analyzers, FeedbackPolicy, AnalysisPipeline
packages/ml-runtime  @fitnet/ml-runtime  ModelRegistry, ONNX en Worker, MlAnalyzer
packages/domain      @fitnet/domain      entidades, puertos, casos de uso
packages/api-client  @fitnet/api-client  adaptadores Supabase, CoachAssistant HTTP, cola offline
packages/ui          @fitnet/ui          componentes, tokens
ml/                  Python: datasets, features (paridad con TS), train, eval, export ONNX
models/manifest.json artefactos publicados (sha256, versión)
fixtures/landmarks/  secuencias golden compartidas TS/Python
supabase/            migraciones, Edge Functions (coach)
e2e/                 Playwright
```

Hasta que exista `packages/`, las mismas fronteras aplican a `src/pose` (A), `src/exercises` + `src/geometry` + `src/analysis` (B), `src/ui` (E).

## Reglas duras vigentes

1. **Mobile-first.** La prueba real es en celular (Android Chrome, iOS Safari). No se desarrolla para webcam de escritorio ni hay app nativa.
2. **El video nunca sale del dispositivo.** A la nube solo viajan landmarks y métricas estructuradas, con consentimiento explícito por grabación (`docs/DATA-GOVERNANCE.md`).
3. **No exponer claves.** API keys (Claude, pagos, service-role) viven solo en Edge Functions o secretos de CI. Nunca en el bundle ni en el repo.
4. **Español en UI y documentación entregable; identificadores de código en inglés.** Sin emojis en docs ni código.
5. **No cambiar snapshots golden sin una DEC enlazada en el PR.** Los fixtures de `fixtures/landmarks/` congelan el comportamiento en producción.
6. **`packages/contracts/**`, `src/contracts/**` y `models/manifest.json` solo se editan en ramas `adr/*` o `contracts/*`**, con 2 aprobaciones y bump semver (`docs/WORKSTREAMS.md`). En Claude Code lo bloquea el hook `guard-protected-paths.mjs`; en el PR lo exige CODEOWNERS.
7. **Cero costo, sin excepciones.** Fitnet es un proyecto de seminario y no factura (`DEC-035`): todo va sobre planes gratuitos (Supabase Free, Vercel Hobby, Kaggle, GitHub Actions, Hugging Face). Cualquier gasto real requiere DEC y aprobación explícita.
8. **Los pagos son simulados.** Se implementa el puerto `PaymentProvider` con `MockPaymentProvider`; el flujo es completo y demostrable, pero ningún cobro es real y la interfaz debe decirlo. Nunca integrar una pasarela real ni pedir datos de tarjeta.
9. **No instalar dependencias ni introducir tecnologías sin discutirlo**; si hace falta, proponerlo como opción con su DEC.

## Dirección de dependencias

```
contracts ← pose-engine ← analysis-core ← ml-runtime
contracts ← domain ← api-client
apps/web importa todo; nada importa apps/web
```

`@mediapipe/tasks-vision` solo en `pose-engine`; `onnxruntime-web` solo en `ml-runtime`; SDK de Supabase solo en `api-client`. `analysis-core` no importa React ni APIs del navegador: debe correr en Node con fixtures. Regla de lint: `import/no-restricted-paths` (`DEC-028`).

## Workstreams y propiedad

| Workstream | Posee | Consume |
|---|---|---|
| A. Pose & Captura | `packages/pose-engine`, `apps/web/src/features/capture`, `fixtures/` | `contracts.pose`, `recording` |
| B. Análisis & Runtime | `packages/analysis-core`, `packages/ml-runtime`, `models/manifest.json` | `contracts.*`, artefactos de C |
| C. ML Training | `ml/`, reportes de evaluación, artefactos ONNX | `fixtures`, `contracts.features` |
| D. Backend de producto | `packages/domain`, `packages/api-client`, `supabase/` | `contracts.domain`, `coach` |
| E. App & UI | `apps/web` (salvo capture), `packages/ui`, `e2e/` | todo vía interfaces |

`packages/contracts`: co-propiedad B + D. `docs/adr/`: aprueban B, D y E. Detalle, rituales y DoD: `docs/WORKSTREAMS.md`.

## Regla de oro

**Un agente edita solo dentro de su propiedad.** Si para cumplir una historia necesita algo de otro paquete (un campo nuevo en `LandmarkFrame`, un método en `FormAnalyzer`, una tabla), pide un **cambio de contrato**: abre un issue, propone la DEC (`docs/adr/TEMPLATE.md`) y espera la aprobación. No importa por rutas relativas a otro paquete, no duplica tipos, no "arregla de paso" código ajeno.

## Flujo de trabajo

- **Ramas cortas** desde `main`: `feat/*`, `fix/*`, `chore/*`, `adr/*`, `contracts/*`. `main` siempre desplegable (Vercel).
- **Conventional commits en español**: `feat(analysis-core): agregar PeakDetector basado en tiempo`, `docs(adr): DEC-034 ...`. **commitlint** (hook `commit-msg` de husky) rechaza los mensajes que no cumplan el formato.
- **Antes de abrir el PR:** `pnpm check` (lint + typecheck + test + build) en verde. El mismo comando corre en CI (`.github/workflows/ci.yml`).
- **PR pequeño** (< 400 líneas), 1 revisor obligatorio (2 si toca contratos o `docs/adr/`), squash merge, plantilla `.github/PULL_REQUEST_TEMPLATE.md` con checklist DoD.
- **Definition of Done:** tests verdes; golden intactos o DEC enlazada; docs del paquete actualizadas; preview probado en celular; entrada en CHANGELOG si aplica; `docs/STATUS.md` actualizado si cambió el estado del proyecto.
- **Antes de un cambio grande, proponer plan** (archivos a tocar, contratos afectados) y esperar aprobación.
- El trabajo se organiza en issues de GitHub con etiquetas `epic`, `historia`, `adr`, `equipo` y `ws:A-pose`..`ws:E-app` (`ws:todos` para lo transversal), agrupadas por hito (`Sprint 0 — Fundación`, `Sprint 1 — Migración y datos`). Ver `docs/STATUS.md`.

## Dónde está cada cosa

| Necesito… | Archivo |
|---|---|
| Visión, alcance, freemium, roadmap | `docs/PRODUCT.md` |
| Pipeline actual y objetivo, contratos, tabla de migración por PR | `ARCHITECTURE.md` |
| Por qué se decidió algo | `docs/adr/README.md` (índice), `DECISIONS.md` (acceso rápido) |
| Definición formal de una métrica | `docs/METRICS.md` |
| Entidades y glosario | `docs/DOMAIN.md` |
| Datos, fixtures, entrenamiento, evaluación, promoción de modelos | `docs/ML-PIPELINE.md` |
| Consentimiento, retención, RLS, licencias de datasets | `docs/DATA-GOVERNANCE.md` |
| Quién posee qué, rituales, DoD | `docs/WORKSTREAMS.md` |
| Estado actual y próximos pasos | `docs/STATUS.md` |
| Setup local, grabar fixtures, correr tests | `CONTRIBUTING.md` |
| Entregables históricos del curso | `docs/academico/README.md` |
| Agentes, skills y hooks de Claude Code | `.claude/README.md`, `CLAUDE.md` |

## Agentes especializados (`.claude/agents/`)

Cada agente tiene una sola responsabilidad y directorios acotados; espejan los workstreams para que la regla de propiedad sea la misma para humanos (CODEOWNERS) y para IA (`DEC-032`). Definiciones completas y detalle de hooks: `.claude/README.md`.

| Agente | Responsabilidad | Posee |
|---|---|---|
| `architect-guardian` | Revisa fronteras y contratos; propone ADR ante decisiones implícitas. | Nada (solo lectura). |
| `adr-scribe` | Redacta ADR en MADR y mantiene los índices. | `docs/adr/**`, `DECISIONS.md`. |
| `pose-engine-dev` | Cámara, MediaPipe, `PoseSource`, renderer, fixtures. | `src/pose/**` → `packages/pose-engine`, `fixtures/`. |
| `analysis-dev` | Trackers, analizadores, feedback, pipeline, golden. | `src/exercises/**`, `src/geometry/**`, `src/analysis/**` → `packages/analysis-core`, `packages/ml-runtime`. |
| `ml-engineer` | Datasets, features, entrenamiento, evaluación, ONNX. | `ml/**`, `models/**`. |
| `backend-dev` | Esquema, RLS, Edge Functions, `domain`, `api-client`. | `supabase/**`, `packages/domain`, `packages/api-client`. |
| `ui-dev` | Pantallas mobile-first, PWA, accesibilidad. | `src/ui/**`, `src/App.tsx`, `index.html`, `public/**` → `apps/web`, `packages/ui`. |
| `qa-engineer` | Tests, fixtures sintéticos, Playwright, DoD. | `**/*.test.ts`, `fixtures/**`, `e2e/**`. |
| `coach-prompt-engineer` | Prompts, esquemas y evals del `CoachAssistant`. | `supabase/functions/coach/**`, `evals/coach/**`. |
| `docs-keeper` | `docs/STATUS.md`, READMEs, `AGENTS.md`/`CLAUDE.md` sincronizados. | Solo Markdown. |

Si trabajas sin estos agentes (otra herramienta), asume el rol que corresponda a los directorios que tocas y respeta el mismo límite.
