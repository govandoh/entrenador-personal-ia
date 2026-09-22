# Fitnet — Estado del proyecto

> Documento vivo. Lo actualiza quien cierra un PR que cambie el hito, el estado de la migración o una decisión (o el agente `docs-keeper`). No contiene reglas ni arquitectura: ver `AGENTS.md` y `ARCHITECTURE.md`.

**Última actualización:** 2026-09-21

## Hito actual: Sprint 0 — Fundación

El MVP académico (`entrenador-personal-ia`, curso IA26, entregado el 22/05/2026) pasa a ser Fitnet. El Sprint 0 establece documentación, decisiones, capa agéntica y tooling sin cambiar el comportamiento de la app en producción.

| Entregable | Contenido | Estado |
|---|---|---|
| PR 0 — tooling | pnpm 12 (`packageManager`), Vitest, scripts `typecheck` y `check`, CI en `.github/workflows/ci.yml`, commitlint + husky | **Mergeado en `main`** |
| Capa agéntica | `.claude/agents/*` (10), `.claude/skills/{adr,fixture,pr-ready,promote-model}`, `.claude/hooks/*.mjs` + `settings.json`, `.claude/README.md`, `.github/CODEOWNERS`, plantillas de PR e issues | **Mergeado en `main`** |
| Fundación documental | ADRs (migración DEC-001..025 + DEC-026..033), `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `docs/*`, `README.md`, `CONTRIBUTING.md`, `docs/academico/` | **Mergeado en `main`** |
| PR 1 — fixtures y golden | Flag `?debug=record`, esquema v1 (`fixtures/landmarks/SCHEMA.md`), generador determinista, 10 fixtures sintéticos, helper de replay y 32 golden tests con snapshots | **Mergeado en `main`** |
| Tablero | 22 issues con etiquetas e hitos (ver abajo). El GitHub Project no se creó: el token de `gh` no tiene el scope `project` (issue #21) | Parcial |

## Tablero de issues

22 issues abiertas en `govandoh/entrenador-personal-ia`, con etiquetas `epic`, `historia`, `adr`, `equipo` y `ws:A-pose`/`ws:B-analysis`/`ws:C-ml`/`ws:D-backend`/`ws:E-app`/`ws:todos`.

| Rango | Contenido | Hito |
|---|---|---|
| #1–#10 | Épicas: perfil (#1), análisis 3D (#2), rutinas y calendario (#3), planes de entrenadores (#4), marketplace y coaching (#5), métricas/rankings/retos (#6), freemium (#7), fee de entrenadores (#8), núcleo de IA (#9), plataforma y DevEx (#10) | — |
| #11–#17 | Historias: PR 2 contrato `ExerciseTracker` (#11), PR 3 detección/dibujo y `worldLandmarks` (#12), PR 4 `FeedbackPolicy` (#13), PR 5 `AnalysisPipeline` (#14), fixtures reales en celular (#15), sprint de recolección de datos (#16), esquema Supabase inicial (#17) | Sprint 1 — Migración y datos |
| #18–#22 | Decisiones del equipo: usuarios de GitHub y CODEOWNERS (#18), nombre y visibilidad del repo (#19), entidad legal y pagos (#20), crear el GitHub Project (#21), tope de costo de IA, rankings, anti-trampa y aviso de privacidad (#22) | Sprint 0 — Fundación |

El mapeo entre las 8 épicas de `PRODUCT.md` y las 10 issues `epic` está en `PRODUCT.md` (el tablero separa planes/marketplace y freemium/fee, y reparte comunidad dentro de #6).

## En producción

- PWA en Vercel (plan Hobby), deploy automático en cada push a `main` (DEC-019). URL: ver README.
- Tres ejercicios operativos con análisis por reglas: sentadilla (`SquatTracker`), curl de bíceps (`BicepCurlTracker`, vistas frontal y lateral), press de hombro (`ShoulderPressTracker`, polaridad invertida, umbrales clínicos).
- Conteo unificado con OR + cooldown (DEC-022/023), feedback visual (barra inferior) y de voz sin colisiones (DEC-016), onboarding de 4 pantallas, cambio de cámara con delay de 450 ms (DEC-021), SW network-first para HTML (DEC-025), `localStorage` defensivo (DEC-024).
- Sin backend, sin cuentas, sin recolección de datos. MediaPipe `@mediapipe/tasks-vision@0.10.35`, modelo `pose_landmarker_lite`.
- CI y Vitest configurados (PR 0): 32 tests verdes — `calculateAngle` (8 casos) y los golden de los 3 trackers sobre 10 fixtures sintéticos (PR 1). Los fixtures reales grabados en celular llegan con la issue #15.

## Comportamiento congelado que hay que revisar

Los golden del PR 1 documentan cinco sensibilidades del análisis por reglas (detalle en `fixtures/README.md`). Son el argumento empírico para DEC-027:

1. **El evento de fondo depende de los fps.** La misma trayectoria a 30 y 60 fps cuenta las mismas 5 reps, pero el primer `atBottom` llega 67 ms antes. `RISING_THRESHOLD` compara contra el frame anterior. Lo corrige el PR 7 (umbrales en ms) y exigirá una DEC para actualizar snapshots.
2. **Un spike de ruido de un frame adelanta el fondo hasta 12 frames**, con lo que la voz felicita antes de que el usuario baje. El gate `bottomFired` sí evita reps falsas. Lo resuelve el suavizado del `FeatureExtractor` (PR 7).
3. **Un curl parcial deja el tracker atrapado en `flexed`**: 5 ciclos producen una sola transición y 364 frames con el mismo mensaje pegado.
4. **Una sentadilla sistemáticamente corta no genera ningún feedback**: se queda en `standing` y "Baja un poco más" solo se emite en `squatting`.
5. Curl bilateral y curl lateral producen resúmenes idénticos, así que ninguno cubre regresiones de `activeArm`.

## Decisiones recientes

| DEC | Decisión |
|---|---|
| DEC-026 | Se levantan "sin backend" y "cero costos"; se conserva mobile-first y español; nueva regla: el video nunca sale del dispositivo. |
| DEC-027 | Arquitectura híbrida de IA: modelos pequeños on-device + LLM en la nube solo con métricas; reglas como fallback. |
| DEC-028 | Monorepo pnpm con paquetes `@fitnet/*` y fronteras de dependencias; migración strangler en PRs 0–11. |
| DEC-029 | Supabase (`us-east-1`) como backend. |
| DEC-030 | Recurrente como pagos v1; Paddle secundario; Stripe no disponible en Guatemala. |
| DEC-031 | ONNX Runtime Web (WASM) en Worker + Hugging Face Hub para modelos. |
| DEC-032 | Organización agéntica (10 agentes), workstreams A–E, CODEOWNERS, hooks. |
| DEC-033 | Claude `claude-opus-5` para `CoachAssistant` vía Edge Function, salida estructurada, Batch API. |

Índice completo: `docs/adr/README.md`.

## Próximos pasos (Sprint 1)

1. Mergear `adr/fitnet-fundacion` y el PR 1 de fixtures; verificar que Vercel sigue desplegando con pnpm.
2. Grabar 3–5 fixtures reales por ejercicio en celular (`?debug=record`) y reemplazar los sintéticos en los golden — issue #15.
3. PR 2: `src/contracts/` (`LandmarkFrame`, `TrackerOutput`, `ExerciseTracker`) y adaptadores sobre los trackers; eliminar el `if/else` de `CameraView.tsx:138-142` — issue #11.
4. PR 3: separar detección y dibujo; `CameraPoseSource` + `ReplayPoseSource`; conservar `worldLandmarks` — issue #12.
5. PR 4: `FeedbackPolicy` con las dos estrategias de DEC-016 y tests — issue #13.
6. PR 5: `AnalysisPipeline` + store + `WorkoutScreen`; Playwright smoke — issue #14.
7. Sprint de recolección de datos (≥ 20 voluntarios, issue #16) y esquema inicial de Supabase (issue #17).

Detalle de cada PR y su red de seguridad: `ARCHITECTURE.md` §2.4.

## Pendientes que solo el equipo puede resolver (no bloquean el Sprint 0)

| # | Pendiente | Issue |
|---|---|---|
| 1 | Usuarios de GitHub de los otros 4 desarrolladores (colaboradores y CODEOWNERS reales; hoy placeholders `@dev-a`..`@dev-e`, `@lead-b`, `@lead-d`, que GitHub ignora en silencio). | #18 |
| 2 | ¿Renombrar el repo a `fitnet`? ¿Público (branch protection gratis) o privado (Student Pack)? | #19 |
| 3 | Confirmar el levantamiento de "sin backend / cero costos" y el tope mensual aceptable antes de ingresos. | #19, #20 |
| 4 | Entidad legal: empresa en Guatemala (Recurrente + banco local) vs. Stripe Atlas. Precios en GTQ o USD; fee de entrenador plano vs. porcentaje. | #20 |
| 5 | Crear el GitHub Project "Fitnet": requiere que el token de `gh` tenga el scope `project` (`gh auth refresh -s project`). | #21 |
| 6 | Tope de costo del asistente IA por usuario premium/mes; frescura de rankings y reglas anti-trampa; aviso de privacidad por datos de salud alojados en EE. UU. (`DATA-GOVERNANCE.md` §5). | #22 |
