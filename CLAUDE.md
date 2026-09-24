@AGENTS.md

# CLAUDE.md — Fitnet (específico de Claude Code)

Todo el contexto del proyecto, las reglas duras, la propiedad por workstream y la regla de oro están en `AGENTS.md` (incluido arriba). Este archivo solo añade lo que aplica a Claude Code. El estado actual del proyecto está en `docs/STATUS.md`; no se duplica aquí.

## Cómo trabajar en una sesión

1. **Ubícate antes de tocar nada.** Lee `docs/STATUS.md` (hito actual, PRs en curso, issues abiertas) y, según la historia, `ARCHITECTURE.md` y `docs/WORKSTREAMS.md` para saber qué paquete/directorio es tuyo. Si la tarea cruza una frontera de paquete, detente y pide un cambio de contrato (issue con la plantilla `adr` + `/adr`), no lo resuelvas con un import cruzado.
2. **Propón un plan antes de cambios grandes.** Para cualquier cambio que toque más de un módulo, un contrato, un umbral o un snapshot golden: lista archivos a tocar/crear, contratos afectados y cómo se va a probar. Espera aprobación antes de escribir código.
3. **No instalar dependencias sin avisar.** Cualquier `pnpm add`/`npm install` se discute primero y, si se aprueba, se documenta (DEC si es una tecnología nueva). No introducir frameworks ni servicios fuera de los decididos en `docs/adr/`.
4. **Documentar decisiones vía `/adr`.** Si durante la sesión se toma una decisión técnica (umbral nuevo, proveedor, patrón), invoca `/adr` para generar el borrador MADR en `docs/adr/` y añade la fila al índice. No dejes decisiones solo en comentarios de código o en el mensaje de commit.
5. **Probar en celular es la verdad.** Cualquier cambio en cámara, detección, trackers, voz o PWA se valida en un celular real (`pnpm dev` con HTTPS local o preview de Vercel). Indica explícitamente qué no pudiste probar en desktop.
6. **No cambies snapshots golden** (`fixtures/`, tests `*.test.ts` con snapshots) sin una DEC enlazada. Si un cambio legítimo los altera, crea la DEC primero.
7. **Cierra la sesión dejando rastro.** Si cambió el estado del proyecto (PR mergeado, hito alcanzado, decisión tomada), actualiza `docs/STATUS.md` con la fecha. El agente `docs-keeper` puede hacerlo por ti.
8. **Comentarios en código:** explican el "por qué" (cálculos geométricos, máquinas de estados, umbrales), citando la DEC (`// ver DEC-016`). Español o inglés, consistente dentro del archivo.

## Skills disponibles (`.claude/skills/`)

| Skill | Qué hace | Cuándo usarla |
|---|---|---|
| `/adr` | Crea `docs/adr/DEC-NNN-<slug>.md` desde la conversación, actualiza los índices y propone el commit en rama `adr/*`. | Al tomar cualquier decisión técnica. |
| `/fixture` | Guía para grabar con `?debug=record`, nombrar, validar el esquema v1, registrar el fixture y crear su golden. | Al añadir un ejercicio, vista de cámara o caso de error. |
| `/promote-model` | Verifica el reporte contra `ml/thresholds.yaml` y el `sha256`, actualiza `models/manifest.json` y exige DEC. | Solo en ramas `adr/*` o `contracts/*`, con reporte aprobado. |
| `/pr-ready` | Corre lint/typecheck/test/build, revisa el diff, exige DEC si toca rutas protegidas y arma el cuerpo del PR. | Antes de abrir cualquier PR. |
| `/fitnet-diseno` | Aplica la identidad visual y el sistema de movimiento de `docs/DESIGN.md` (`DEC-058`) y dice qué skill de animación usar. | Antes de tocar cualquier pantalla, componente o animación. |
| `/animate`, `/review-animations`, `/improve-animations`, `/find-animation-opportunities`, `/emil-design-eng`, `/mobile-native`, `/pick-ui-library`, `/animation-vocabulary` | Skills de Emil Kowalski (MIT, `.claude/skills/THIRD-PARTY.md`) para construir, revisar y auditar movimiento y pulido móvil. | Siempre a través de `/fitnet-diseno`, cuyas reglas prevalecen (sin librerías nuevas, tokens, presupuesto de la cámara). |

## Hooks (`.claude/settings.json` + `.claude/hooks/*.mjs`)

Scripts Node ESM sin dependencias; leen el evento por stdin y corren desde la raíz del repo.

| Evento | Script | Efecto |
|---|---|---|
| `PreToolUse` (Edit/Write/MultiEdit) | `guard-protected-paths.mjs` | **Bloquea** (exit 2) ediciones en `packages/contracts/**`, `src/contracts/**` y `models/manifest.json` si la rama no empieza por `adr/` o `contracts/`. Cambia de rama o pide el cambio de contrato. |
| `PostToolUse` (Edit/Write/MultiEdit) | `lint-on-edit.mjs` | `eslint --fix` sobre el `.ts`/`.tsx` editado si hay `node_modules`; nunca falla el paso. |
| `Stop` | `remind-status.mjs` | Recuerda actualizar `docs/STATUS.md` si hubo cambios en `src/`, `packages/`, `apps/`, `ml/` o `supabase/` sin tocarlo. Solo avisa. |

`.claude/settings.local.json` es personal y está en `.gitignore`; los hooks de `settings.json` se **acumulan** con los locales, no se reemplazan (cómo desactivarlos: `.claude/README.md`). No pongas ahí reglas que el equipo deba compartir.

## Agentes

Los diez agentes de `.claude/agents/` (`architect-guardian`, `adr-scribe`, `pose-engine-dev`, `analysis-dev`, `ml-engineer`, `backend-dev`, `ui-dev`, `qa-engineer`, `coach-prompt-engineer`, `docs-keeper`) están en la tabla de `AGENTS.md` y descritos en `.claude/README.md`. La sesión principal orquesta: delega a un agente solo trabajo dentro de su propiedad y compone los resultados. Un agente nunca redelega su tarea completa a otro.

## Tareas típicas y dónde van

Antes de editar, ubica la historia en esta tabla; si no encaja en una sola fila, es un cambio de contrato.

| Historia | Directorio hoy (`src/`) | Directorio objetivo | Workstream / agente | Necesita DEC |
|---|---|---|---|---|
| Ajustar un umbral angular o el cooldown de un tracker | `src/exercises/*.ts` | `packages/analysis-core` | B / `analysis-dev` | Sí (cambia golden) |
| Añadir un ejercicio nuevo | `src/exercises/` + chip en `CameraView.tsx` | `analysis-core` (tracker) + `contracts` (`ExerciseId`) + `ui` (chip) | B + E; contrato → issue + DEC | Sí |
| Añadir un ejercicio al asistente (ola de `DEC-056`) | `src/exercises/` (configuración) + ejemplos del k-NN (`src/analysis/poseClassifier.ts`) | `analysis-core` + `ml/` (datos) | B (+ C para grabar y etiquetar) | Solo si los umbrales cambian golden |
| Cambiar la frase de voz o la prioridad entre mensajes | `CameraView.tsx` l.146-188 | `analysis-core/feedback` (`FeedbackPolicy`) | B | Si cambia DEC-016 |
| Conservar `worldLandmarks` o cambiar el modelo de MediaPipe | `src/pose/poseDetector.ts` | `packages/pose-engine` | A / `pose-engine-dev` | Sí si cambia versión/modelo |
| Grabar o añadir un fixture | — (PR 1) | `fixtures/landmarks/` + `*.test.ts` | A (fixture) y B (golden) | No |
| Pantalla nueva, estilos, onboarding, PWA | `src/ui/`, `public/` | `apps/web`, `packages/ui` | E / `ui-dev` | No, salvo dependencia nueva |
| Tabla, política RLS, Edge Function | — | `supabase/`, `packages/domain`, `api-client` | D / `backend-dev` | Sí si cambia el modelo de dominio |
| Prompt o esquema de salida del coach | — | `supabase/functions/coach/`, `evals/coach/` | D / `coach-prompt-engineer` | No, salvo cambio de modelo |
| Entrenar, evaluar o promover un modelo | — | `ml/`, `reports/`, `models/manifest.json` | C / `ml-engineer` (+ B para manifest) | Promoción vía gate, no DEC |
| Nueva métrica visible al usuario | — | `docs/METRICS.md` primero, luego `analysis-core` y `domain` | B + D | Sí |

## Convenciones de código

- Identificadores en inglés; textos de UI y mensajes de voz en español (`es-ES`).
- Constantes de umbral en mayúsculas con unidad en el nombre o el comentario (`GOOD_DEPTH_ANGLE = 90 // grados`); las temporales nuevas van en milisegundos, no en frames (`confirmMs`, no `MIN_RISING_FRAMES`).
- Todo módulo de `analysis-core` (hoy `src/exercises`, `src/geometry`, `src/analysis`) debe ser puro: sin React, sin DOM, sin `performance.now()` interno (recibe `t` del frame).
- Prettier con configuración por defecto; ESLint del repo. No desactivar reglas inline sin comentario que lo justifique.
- Tests junto al código (`squat.test.ts` al lado de `squat.ts`); fixtures en `fixtures/landmarks/`.

## Al cerrar la sesión

1. `pnpm check` en verde (o `/pr-ready`, que además revisa el diff y arma el cuerpo del PR).
2. Si tocaste cámara, trackers, voz o PWA: confirma en el mensaje final qué probaste en celular y qué no.
3. Si hubo una decisión: DEC creada con `/adr` y fila en `docs/adr/README.md`.
4. Si cambió el estado: `docs/STATUS.md` con fecha (el hook `Stop` te lo recuerda).
5. Commit con conventional commit en español — commitlint rechaza cualquier otro formato. No hagas push a `main`.

## Comandos útiles

```
pnpm install            # Node 22+, pnpm 12 (corepack enable)
pnpm dev                # Vite con HTTPS local (@vitejs/plugin-basic-ssl) y host expuesto a la LAN
pnpm build              # tsc -b && vite build
pnpm lint               # eslint .
pnpm typecheck          # tsc --noEmit (app y node)
pnpm test               # vitest run
pnpm check              # lint + typecheck + test + build (lo mismo que corre CI)
```

Ver `CONTRIBUTING.md` para el setup completo, cómo probar en celular y cómo grabar fixtures.

## Qué no hacer en este repo

- No leer ni editar `docs/academico/`: son entregables históricos del curso.
- No cambiar `public/sw.js` sin subir la constante `CACHE` (`DEC-025`).
- No enviar landmarks, métricas ni ningún dato de usuario a servicios externos desde el cliente; todo pasa por `api-client` y las Edge Functions (`DEC-029`, `DEC-033`).
- No escribir docs nuevos en la raíz: van en `docs/` con una responsabilidad por archivo (tabla en `AGENTS.md`).
