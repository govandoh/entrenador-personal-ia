# DEC-028 · Monorepo pnpm, paquetes `@fitnet/*` y fronteras de dependencias

- **Estado:** Aceptada
- **Fecha:** 2026-09-19
- **Decisores:** Leads de los workstreams B, D y E
- **Etiquetas:** arquitectura, devex, monorepo

## Contexto y problema

El repo es una sola app Vite con `src/{pose,geometry,exercises,ui}` y 2 318 líneas de código. `src/ui/CameraView.tsx` (299 líneas) concentra cámara, loop de `requestAnimationFrame`, selección de ejercicio y las reglas de voz de `DEC-016` en un `if/else` por ejercicio. No hay tests, ni CI, ni interfaz común entre trackers (`SquatResult`, `BicepCurlResult` y `ShoulderPressResult` son tipos distintos con `atBottom`/`atTop`/`atPeak`).

Con cinco desarrolladores trabajando en paralelo sobre pose, análisis, ML, backend y UI, un único `src/` sin fronteras garantiza conflictos y acoplamiento. Se necesita una estructura donde la propiedad de cada área sea explícita, las dependencias vayan en una sola dirección y el código de análisis sea probable sin React ni navegador.

## Opciones consideradas

1. **Seguir con una sola app y carpetas por feature** (`src/features/*`). Descartada: no impide imports cruzados, no permite publicar `analysis-core` como paquete probable en Node ni compartir tipos con `ml/` y con las Edge Functions.
2. **Repos separados por paquete** (polyrepo). Descartada: los cambios de contrato exigen PRs coordinados en varios repos; el equipo es pequeño y el CI compartido es más simple en un monorepo.
3. **Monorepo con npm workspaces**. Viable pero pnpm tiene resolución estricta (evita "phantom dependencies"), instalación más rápida y es el estándar en monorepos TypeScript actuales.
4. **Monorepo pnpm workspaces con paquetes `@fitnet/*` y regla de lint de fronteras** (elegida). Turborepo se añadirá solo cuando el tiempo de build lo justifique.

## Decisión

### Layout objetivo (alcanzado en el PR 6 de la migración, no el día uno)

```
fitnet/
├─ apps/web/                      # el src/ actual → shell + features/{workout,capture,routines,profile,trainer}
├─ packages/
│  ├─ contracts/     @fitnet/contracts     # tipos + zod, semver, co-propiedad
│  ├─ pose-engine/   @fitnet/pose-engine   # camera.ts, detect-only, CameraPoseSource, ReplayPoseSource, SkeletonRenderer
│  ├─ analysis-core/ @fitnet/analysis-core # angles.ts, FeatureExtractor, trackers, RepSegmenter, analyzers, FatigueAnalyzer, FeedbackPolicy, AnalysisPipeline
│  ├─ ml-runtime/    @fitnet/ml-runtime    # ModelRegistry, sesiones ONNX en Worker, MlAnalyzer
│  ├─ domain/        @fitnet/domain        # entidades, repositorios (puertos), casos de uso
│  ├─ api-client/    @fitnet/api-client    # adaptadores BaaS, CoachAssistant HTTP, cola offline
│  └─ ui/            @fitnet/ui            # ExerciseOverlay, chips, onboarding, tokens
├─ ml/                            # Python: datasets/, features/, train/, eval/, export_onnx.py, thresholds.yaml
├─ models/manifest.json           # artefactos publicados (task, version, url, sha256, featureSchemaVersion)
├─ fixtures/landmarks/*.json      # secuencias golden compartidas por TS y Python
├─ supabase/{migrations,functions/{coach,...}}
├─ e2e/                           # Playwright
├─ docs/  .claude/  .github/
```

### Dirección de dependencias (regla eslint `import/no-restricted-paths`)

```
contracts ← pose-engine ← analysis-core ← ml-runtime
contracts ← domain ← api-client
apps/web importa todo; nada importa apps/web
```

- `@mediapipe/tasks-vision` se importa **solo** en `pose-engine`. `analysis-core` usa `contracts.Landmark` (mismo truco de compatibilidad estructural que `Point2D` en `DEC-009`).
- `supabase/` lo importa solo `api-client`.
- `packages/ui` no contiene lógica de dominio ni de análisis.

### Reglas de `packages/contracts`

Es **co-propiedad** de los leads B y D. Cualquier cambio exige: 2 aprobaciones, bump semver, campo `schemaVersion` en todo dato persistido, y los cambios rompientes conviven como `v2` junto a `v1` con adaptador durante un release. Solo se edita en ramas `adr/*` o `contracts/*` (un hook de Claude Code lo bloquea en otras ramas; ver `DEC-032`).

### Migración strangler (siempre desplegable)

Se ejecuta por PRs numerados 0–11 (tabla completa en `ARCHITECTURE.md`): fixtures y golden tests primero (PR 1), contratos y adaptadores finos (PR 2), separación detección/dibujo (PR 3), `FeedbackPolicy` (PR 4), `AnalysisPipeline` (PR 5), y solo entonces la conversión a workspace pnpm con `git mv` sin cambios de lógica (PR 6). La app se despliega tras cada PR.

### Tooling asociado

pnpm workspaces, Vitest 4 + Playwright, commitlint + husky, script `typecheck`, GitHub Actions (lint/typecheck/test/build), Vercel preview por PR. Cobertura mínima por paquete: `analysis-core` ≥ 80 %. Presupuesto Lighthouse: shell ≤ 350 kB gz, modelos cargados de forma perezosa.

## Consecuencias

### Positivas

- Cada workstream tiene un directorio propio y CODEOWNERS puede exigir su revisión.
- `analysis-core` se prueba en Node con fixtures, sin cámara ni React.
- Los tipos de `contracts` se comparten con `ml/` (espejo pydantic) y con las Edge Functions (zod).

### Negativas

- `package.json`, scripts y CI cambian de npm a pnpm; hay que verificar que `pnpm build` produce el mismo `dist/` y que Vercel sigue desplegando (PR 0).
- La migración ocupa varios sprints antes de que exista el primer paquete real; durante ese tiempo conviven `src/` y la documentación del layout objetivo.
- Mayor ceremonia para cambiar un contrato (2 aprobaciones, semver): es el costo deliberado de proteger la interfaz entre equipos.

## Referencias

- `ARCHITECTURE.md` (diagrama, contratos núcleo, tabla de migración).
- `docs/WORKSTREAMS.md` (propiedad por paquete).
- `DEC-009` (patrón de tipo estructural sin dependencia de MediaPipe).
- `DEC-032` (agentes, hooks y CODEOWNERS).
