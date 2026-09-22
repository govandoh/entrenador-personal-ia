# DEC-032 · Organización agéntica: workstreams, agentes de una sola responsabilidad, CODEOWNERS y hooks

- **Estado:** Aceptada
- **Fecha:** 2026-09-19
- **Decisores:** Leads de los workstreams B, D y E
- **Etiquetas:** proceso, agentes, gobernanza

## Contexto y problema

Cinco desarrolladores y varias sesiones de IA (Claude Code, Codex, Cursor, Gemini CLI) trabajarán en paralelo sobre el mismo monorepo (`DEC-028`). El MVP se construyó con una sola sesión de Claude Code guiada por un `CLAUDE.md` de 200 líneas que mezclaba contexto, reglas, cronograma del curso y estado del proyecto; ese formato no escala a un equipo ni a herramientas distintas. Se necesita que la misma regla de propiedad aplique a humanos y a agentes, que la documentación sea legible por cualquier IA sin contexto previo, y que las decisiones no queden implícitas en el código.

## Opciones consideradas

1. **Un único agente generalista** con acceso a todo el repo. Descartada: reproduce el problema de `CameraView.tsx` a nivel organizativo; nadie es responsable de nada y los cambios de contrato se hacen "de paso".
2. **Agentes por tecnología** (agente React, agente Python, agente SQL). Descartada: no coinciden con las fronteras de paquetes ni con la propiedad de los devs.
3. **Agentes que espejan los workstreams, con una responsabilidad, herramientas mínimas y directorios acotados** (elegida), complementados con skills, hooks y CODEOWNERS.

## Decisión

### Workstreams y propiedad (detalle en `docs/WORKSTREAMS.md`)

| Workstream | Posee |
|---|---|
| A. Pose & Captura | `packages/pose-engine`, `apps/web/src/features/capture`, `fixtures/` |
| B. Análisis & Runtime | `packages/analysis-core`, `packages/ml-runtime`, `models/manifest.json` |
| C. ML Training | `ml/`, reportes de evaluación, artefactos ONNX |
| D. Backend de producto | `packages/domain`, `packages/api-client`, `supabase/` |
| E. App & UI | `apps/web` (salvo capture), `packages/ui`, `e2e/` |

`packages/contracts` es co-propiedad de B y D (2 aprobaciones). `docs/adr/` requiere aprobación de B, D y E. `.github/CODEOWNERS` codifica esta tabla; hasta tener los usuarios de GitHub de los otros cuatro desarrolladores se usan placeholders `@dev-a`..`@dev-e`.

### Agentes (`.claude/agents/<nombre>.md`)

| Agente | Responsabilidad única | Herramientas | Límite |
|---|---|---|---|
| `architect-guardian` | Revisar PRs/diffs contra fronteras de paquetes y contratos; proponer ADR al detectar una decisión implícita. | Read, Grep, Glob | No edita código. |
| `adr-scribe` | Redactar/actualizar ADRs en MADR; mantener `docs/adr/README.md`. | Read, Write, Edit en `docs/adr/**`, `DECISIONS.md` | Solo docs de decisiones. |
| `pose-engine-dev` | Cámara, MediaPipe, `PoseSource`, renderer, fixtures de landmarks. | Todo, dentro de `packages/pose-engine`, `fixtures/` | La prueba en celular es la verdad. |
| `analysis-dev` | Trackers, analizadores, políticas de feedback, pipeline; golden tests. | Todo, dentro de `packages/analysis-core`, `ml-runtime` | No cambia snapshots sin DEC. |
| `ml-engineer` | `ml/`: datasets, features (paridad), entrenamiento, evaluación, export ONNX, manifest. | Todo, dentro de `ml/`, `models/` | No promueve sin reporte. |
| `backend-dev` | Esquema, RLS, migraciones, Edge Functions (`coach`), adaptadores `api-client`. | Todo, dentro de `supabase/`, `packages/domain`, `api-client` | Nunca expone claves al cliente. |
| `ui-dev` | Pantallas mobile-first, `packages/ui`, accesibilidad, PWA. | Todo, dentro de `apps/web`, `packages/ui` | No mete lógica de dominio en componentes. |
| `qa-engineer` | Tests, fixtures sintéticos, Playwright, verificación de DoD. | Todo, en `**/*.test.ts`, `e2e/` | No cambia lógica de producción. |
| `coach-prompt-engineer` | Prompts, esquemas de salida y evals del `CoachAssistant`; prompt caching. | Read, Edit en `supabase/functions/coach/**`, `evals/coach/**` | Salida siempre JSON validado; sin consejo médico. |
| `docs-keeper` | Mantener `docs/STATUS.md`, READMEs de paquetes, `AGENTS.md`/`CLAUDE.md` sincronizados con el código. | Read, Edit en `**/*.md` | Solo Markdown. |

La sesión principal actúa como orquestador y compone agentes; ningún agente delega su responsabilidad completa a otro.

### Skills (`.claude/skills/`)

`/adr` (crear ADR desde la conversación), `/fixture` (guía para grabar y registrar un fixture), `/promote-model` (validar reporte + `sha256` + manifest), `/pr-ready` (corre lint/typecheck/test/golden y arma la descripción del PR con checklist DoD).

### Hooks (`.claude/settings.json` + `.claude/hooks/*.mjs`, compartidos en el repo)

- `PreToolUse` (`guard-protected-paths.mjs`): bloquea `Edit`/`Write`/`MultiEdit` en `packages/contracts/**`, `src/contracts/**` y `models/manifest.json` salvo que la rama sea `adr/*` o `contracts/*`.
- `PostToolUse` (`lint-on-edit.mjs`): ejecuta `eslint --fix` sobre los archivos `.ts`/`.tsx` editados.
- `Stop` (`remind-status.mjs`): recuerda actualizar `docs/STATUS.md` si hubo cambios en `src/`, `packages/`, `apps/`, `ml/` o `supabase/`.

### Regla de oro (en `AGENTS.md`)

Un agente edita solo dentro de su propiedad. Si necesita algo de otro paquete, pide un cambio de contrato (issue + ADR); no lo hackea.

### Documentación por responsabilidad única

`CLAUDE.md` se reduce a lo específico de Claude Code e incluye `@AGENTS.md`; `AGENTS.md` es vendor-neutral; el estado vivo pasa a `docs/STATUS.md`; las decisiones a `docs/adr/`. Tabla completa de archivos y responsabilidades en `AGENTS.md`.

## Consecuencias

### Positivas

- La misma frontera protege contra un humano apurado y contra un agente sobreconfiado.
- Cualquier IA que lea `AGENTS.md` + `ARCHITECTURE.md` + `docs/WORKSTREAMS.md` puede decir qué paquete tocar para una historia sin preguntar.
- Las decisiones implícitas se detectan en revisión (`architect-guardian`) y se convierten en ADR.

### Negativas

- Más archivos de configuración que mantener (`.claude/agents`, `skills`, `settings.json`, CODEOWNERS); `docs-keeper` existe para eso.
- Branch protection con CODEOWNERS obligatorio solo está disponible gratis en repos públicos; si el equipo elige repo privado, cada integrante debe reclamar el GitHub Student Developer Pack.
- Hasta tener los usuarios reales, CODEOWNERS con placeholders no bloquea nada.

## Referencias

- `AGENTS.md`, `CLAUDE.md`, `docs/WORKSTREAMS.md`, `docs/adr/README.md`.
- `DEC-028` (fronteras de paquetes que estos agentes respetan).
- Documentación de subagentes y hooks de Claude Code: https://docs.claude.com/en/docs/claude-code
