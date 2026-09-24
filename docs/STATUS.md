# Fitnet — Estado del proyecto

> Documento vivo. Lo actualiza quien cierra un PR que cambie el hito, el estado de la migración o una decisión (o el agente `docs-keeper`). No contiene reglas ni arquitectura: ver `AGENTS.md` y `ARCHITECTURE.md`.

**Última actualización:** 2026-09-24 (noche, UI de la Fase 1)

## Hito actual: Sprint 0 — Fundación

El MVP académico (`entrenador-personal-ia`, curso IA26, entregado el 22/05/2026) pasa a ser Fitnet. El Sprint 0 establece documentación, decisiones, capa agéntica y tooling sin cambiar el comportamiento de la app en producción.

| Entregable | Contenido | Estado |
|---|---|---|
| PR 0 — tooling | pnpm 12 (`packageManager`), Vitest, scripts `typecheck` y `check`, CI en `.github/workflows/ci.yml`, commitlint + husky | **Mergeado en `main`** |
| Capa agéntica | `.claude/agents/*` (10), `.claude/skills/{adr,fixture,pr-ready,promote-model}`, `.claude/hooks/*.mjs` + `settings.json`, `.claude/README.md`, `.github/CODEOWNERS`, plantillas de PR e issues | **Mergeado en `main`** |
| Fundación documental | ADRs (migración DEC-001..025 + DEC-026..033), `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `docs/*`, `README.md`, `CONTRIBUTING.md`, `docs/academico/` | **Mergeado en `main`** |
| PR 1 — fixtures y golden | Flag `?debug=record`, esquema v1 (`fixtures/landmarks/SCHEMA.md`), generador determinista, 10 fixtures sintéticos, helper de replay y 32 golden tests con snapshots | **Mergeado en `main`** |
| Integración de fitnetv2, paso I-1 (`DEC-054`) + k-NN (`DEC-055`) | Motor puro en `src/geometry/{vectors3d,landmarkFilter,gravityAlign,standingCalibration,poseEmbedding}.ts` y `src/analysis/{movementQuality,fatigue,messages,poseClassifier}.ts`, `src/exercises/demoPoses.ts`, `src/testing/syntheticMotion.ts` | PR #40, **mergeado en `main`** |
| Motor 3D detrás de `?engine=3d` (I-2 + I-3, `DEC-057`) | `CycleDetector`, `Tracker3D` + definiciones, `FramePipeline` (One Euro → gravedad → calibración → contador), adaptador del acelerómetro con permiso de iOS; defectos de fitnetv2 corregidos. Sin el flag, producción no cambia | Mergeado (PR #40); el equipo ya lo vio en el preview, falta el informe de prueba por ejercicio y celular |
| Ola 1 del asistente (#39) | Flexiones, zancadas, puente de glúteo (definiciones 3D) y plancha (`PlankTracker`, isométrico), con demos 3D y chips en el modo 3D | Mergeado (PR #40); umbrales sin calibrar con personas |
| PR 4 — `FeedbackPolicy` (#13) | Política de voz de DEC-016 extraída de `CameraView` a `src/feedback/`, compartida por los dos motores | Mergeado (PR #40) |
| Grabación por guion y k-NN (#16, #36) | `?debug=record&cond=…&view=…&subject=…` guarda condición, sujeto y gravedad por frame; `pnpm knn <carpeta>` construye el modelo y lo evalúa LOSO | Mergeado (PR #40); faltan las grabaciones |
| Catálogo y generador de rutinas (#35) | `src/domain/catalog.ts` (60 ejercicios con etiquetas de equipo) y `routineGenerator.ts` (cuestionario → rutina, progresión de 8 semanas, semana 1 libre) | Mergeado (PR #40); sin pantallas |
| Identidad visual y movimiento (`DEC-058`) | `docs/DESIGN.md`, `src/ui/tokens.css`, skill `fitnet-diseno` y 8 skills de Emil Kowalski en `.claude/skills/`; bienvenida, navegación y pantallas con la identidad nueva | PR de la Fase 1 (UI), **sin probar en celular** |
| Pantallas de la Fase 1 (I-4 parcial, I-5, #34, #35) | Hoy (anillo de 33 nodos, semana, racha, fatiga), cuestionario de 4 pasos, programa de 8 semanas con semana 1 libre y Premium simulado (`MockPaymentProvider`), catálogo con filtros, perfil; historial local de series | PR de la Fase 1 (UI) |
| Entrenamiento con asistente (`DEC-058`, `DEC-059`) | Preparación con nivelador de burbuja y arranque automático, isla de aviso, contador, métricas, resumen de serie con velocidad y fatiga; la ola 1 usa el motor 3D sin flag | PR de la Fase 1 (UI); sentadilla, curl y press siguen en 2D |
| Tablero | 29 issues con etiquetas e hitos (ver abajo). El GitHub Project no se creó: el token de `gh` no tiene el scope `project` (issue #21) | Parcial |

## Tablero de issues

29 issues abiertas en `govandoh/entrenador-personal-ia`, con etiquetas `epic`, `historia`, `adr`, `equipo` y `ws:A-pose`/`ws:B-analysis`/`ws:C-ml`/`ws:D-backend`/`ws:E-app`/`ws:todos`.

| Rango | Contenido | Hito |
|---|---|---|
| #1–#10 | Épicas: perfil (#1), análisis 3D (#2), rutinas y calendario (#3), planes de entrenadores (#4), marketplace y coaching (#5), métricas/rankings/retos (#6), freemium (#7), fee de entrenadores (#8), núcleo de IA (#9), plataforma y DevEx (#10) | — |
| #11–#17 | Historias: PR 2 contrato `ExerciseTracker` (#11), PR 3 detección/dibujo y `worldLandmarks` (#12), PR 4 `FeedbackPolicy` (#13), PR 5 `AnalysisPipeline` (#14), fixtures reales en celular (#15), sprint de recolección de datos (#16), esquema Supabase inicial (#17) | Sprint 1 — Migración y datos |
| #18–#22 | Decisiones del equipo: usuarios de GitHub y CODEOWNERS (#18), nombre y visibilidad del repo (#19), entidad legal y pagos (#20), crear el GitHub Project (#21), tope de costo de IA, rankings, anti-trampa y aviso de privacidad (#22) | Sprint 0 — Fundación |
| #32–#39 | Análisis de rentabilidad: insumos (#32). Integración de fitnetv2 y núcleo de IA (DEC-054..056): I-2 trackers 3D (#33), I-4 UI de fitnetv2 (#34), I-5 cuestionario, generador y paywall (#35), k-NN conectado y primer modelo real (#36), experimento ST-GCN++ de 3 días (#37), conversión de MM-Fit y Fitness-AQA (#38), ola 1 del asistente (#39). I-3 se absorbió en #12 | Sin hito asignado |

El mapeo entre las 8 épicas de `PRODUCT.md` y las 10 issues `epic` está en `PRODUCT.md` (el tablero separa planes/marketplace y freemium/fee, y reparte comunidad dentro de #6).

## En producción

- PWA en Vercel (plan Hobby), deploy automático en cada push a `main` (DEC-019). URL: ver README.
- Tres ejercicios operativos con análisis por reglas: sentadilla (`SquatTracker`), curl de bíceps (`BicepCurlTracker`, vistas frontal y lateral), press de hombro (`ShoulderPressTracker`, polaridad invertida, umbrales clínicos).
- Conteo unificado con OR + cooldown (DEC-022/023), feedback visual (barra inferior) y de voz sin colisiones (DEC-016), onboarding de 4 pantallas, cambio de cámara con delay de 450 ms (DEC-021), SW network-first para HTML (DEC-025), `localStorage` defensivo (DEC-024).
- Sin backend, sin cuentas, sin recolección de datos. MediaPipe `@mediapipe/tasks-vision@0.10.35`, modelo `pose_landmarker_lite`.
- CI y Vitest configurados (PR 0): 32 tests verdes en `main` — `calculateAngle` (8 casos) y los golden de los 3 trackers sobre 10 fixtures sintéticos (PR 1). Los fixtures reales grabados en celular llegan con la issue #15.
- **fitnetv2** (`ecaldcc/07-FitNet`) sigue desplegada en fitnetv2.netlify.app con análisis 3D, catálogo y rutinas; convive con esta PWA mientras se integra por pasos (`DEC-054`).

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
| DEC-059 | La ola 1 (flexiones, zancadas, puente, plancha) usa el motor 3D sin flag; sentadilla, curl y press siguen en 2D hasta el issue #33. |
| DEC-058 | Identidad "la red de 33 puntos" (tema oscuro, Voltaje e Índigo, anillo de 33 nodos), movimiento en CSS con las reglas de Emil Kowalski y patrones de Cult UI sin dependencias. Reemplaza la sección de diseño de DEC-008. |
| DEC-054 | Este repositorio es la base; fitnetv2 entra en cinco pasos por workstream (I-1 motor puro, hecho; I-2 trackers 3D; I-3 detector y sensores; I-4 UI; I-5 cuestionario y paywall). |
| DEC-055 | Núcleo de IA: k-NN de posturas (después MLP) en TypeScript puro, sin TF.js ni ONNX; datos propios con etiqueta por guion; ST-GCN++ preentrenado como experimento de ≤ 3 días. Reemplaza la Fase 2 de DEC-034. |
| DEC-056 | Rutina personalizada: cuestionario libre, generador determinista por reglas, catálogo de fitnetv2 con asistente por olas, programa completo premium con `MockPaymentProvider`. |
| DEC-036..053 | Importadas de fitnetv2 (sus DEC-026..043, desplazamiento +10): análisis 3D, validación temporal, fatiga, One Euro, nivelación, calibración de pie, catálogo, rutinas, modo manual, entre otras. Tabla de equivalencias en DEC-054. |
| DEC-026 | Se levantan "sin backend" y "cero costos"; se conserva mobile-first y español; nueva regla: el video nunca sale del dispositivo. Modificada por DEC-035. |
| DEC-034 | Vía de implementación del análisis por IA en tres fases, con COCO-17 como representación canónica. Propuesta, ajustada por DEC-035; su Fase 2 la reemplaza DEC-055. |
| DEC-035 | **Fitnet es un proyecto de seminario y no factura.** Pagos simulados con un puerto intercambiable, cero costo absoluto, pesos preentrenados de licencia académica permitidos en el prototipo, y análisis de rentabilidad como entregable fuera del repositorio. |
| DEC-027 | Arquitectura híbrida de IA: modelos pequeños on-device + LLM en la nube solo con métricas; reglas como fallback. |
| DEC-028 | Monorepo pnpm con paquetes `@fitnet/*` y fronteras de dependencias; migración strangler en PRs 0–11. |
| DEC-029 | Supabase (`us-east-1`) como backend. |
| DEC-030 | Recurrente como pagos v1; Paddle secundario; Stripe no disponible en Guatemala. |
| DEC-031 | ONNX Runtime Web (WASM) en Worker + Hugging Face Hub para modelos. |
| DEC-032 | Organización agéntica (10 agentes), workstreams A–E, CODEOWNERS, hooks. |
| DEC-033 | Claude `claude-opus-5` para `CoachAssistant` vía Edge Function, salida estructurada, Batch API. |

Índice completo: `docs/adr/README.md`.

## Próximos pasos (Sprint 1)

Siguen el orden de `DEC-054`. Tests: 289 en verde (antes 32).

1. **Probar el motor 3D en celulares** (Android e iOS) con `?engine=3d`: conteo de los 7 ejercicios, nivelación con el sensor (botón "Nivelar con el sensor" en iPhone), avisos de forma. Es el requisito para que el 3D pase a ser el predeterminado (`DEC-057`).
2. **Probar el PR de la Fase 1 (UI) en celular**: bienvenida, cuestionario, programa y Premium simulado, catálogo, y una serie completa de cada ejercicio con el nivelador y el resumen.
3. **Grabación por guion con el equipo** (`docs/ML-PIPELINE.md` §1): primero los 5 integrantes, luego voluntarios — issue #16. Con 2 o más sujetos, `pnpm knn <carpeta>` da el primer reporte LOSO — issue #36.
4. **Predeterminar el motor 3D**: DEC propia, fixtures con `world` para los golden y retiro de los contadores 2D — issue #33.
5. PR 2 (`src/contracts/`, issue #11): requiere una rama `contracts/*`. Tipos candidatos: `ExerciseDefinition3D`, `Tracker3DResult` y `FrameInput`, ya estables en el código.
6. PR 3: separar detección y dibujo (`CameraPoseSource` + `ReplayPoseSource`) — issue #12. La parte de sensores ya está.
7. **I-4 (E + D), lo que falta:** editor de rutinas, modo manual para ejercicios sin cámara, tutoriales, logros del perfil y `Pose3DView` lazy — issue #34. Catálogo, programa, perfil y router ya están.
8. **I-5 (D + E):** hecho en el PR de la Fase 1 (UI); falta el calendario con recordatorios — issue #35.
9. Experimento con ST-GCN++ preentrenado (≤ 3 días), cuando exista el dataset mínimo — issue #37; datasets públicos — issue #38.

Detalle de cada PR y su red de seguridad: `ARCHITECTURE.md` §2.4.

## Pendientes que solo el equipo puede resolver (no bloquean el Sprint 0)

| # | Pendiente | Issue |
|---|---|---|
| 1 | Usuarios de GitHub de los otros 4 desarrolladores (colaboradores y CODEOWNERS reales; hoy placeholders `@dev-a`..`@dev-e`, `@lead-b`, `@lead-d`, que GitHub ignora en silencio). | #18 |
| 2 | ¿Renombrar el repo a `fitnet`? ¿Público (branch protection gratis) o privado (Student Pack)? | #19 |
| 3 | ~~Tope de gasto mensual~~. **Resuelto por `DEC-035`:** el proyecto no factura, así que la regla es cero costo y todo va sobre planes gratuitos. | — |
| 4 | ~~Entidad legal y proveedor de pagos~~. **Resuelto por `DEC-035`:** los pagos son simulados, no hace falta entidad ni NIT. Precios y forma de la cuota pasan a ser variables del análisis de rentabilidad. | #20, reconvertida |
| 5 | Crear el GitHub Project "Fitnet": requiere que el token de `gh` tenga el scope `project` (`gh auth refresh -s project`). | #21 |
| 6 | Tope de costo del asistente IA por usuario premium/mes; frescura de rankings y reglas anti-trampa; aviso de privacidad por datos de salud alojados en EE. UU. (`DATA-GOVERNANCE.md` §5). | #22 |
| 7 | Renombrar: existe una app de rutinas llamada fitnetapp.com, lo que refuerza cambiar el nombre del producto y del repo. | #19 |
