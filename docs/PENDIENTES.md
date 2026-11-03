# MovexNet — Pendientes del roadmap comercial

> Responsabilidad de este archivo: lo que falta, lo que se dejó a medias y lo que espera a alguien en el roadmap comercial, más el gasto del crédito de la API. El estado de cada tarea vive en `docs/ROADMAP-COMERCIAL.md` §3; aquí va lo que no cabe ahí. Lo escribe solo el coordinador (`docs/COORDINADOR.md`), en la rama `coordinador/bitacora`, cada vez que lanza o cierra una hija; Gerardo puede marcar «resuelto» en §1. Se fusiona a `main` cuando Gerardo quiera.

**Última actualización:** 2026-11-03, al crear el archivo; el coordinador todavía no está en marcha.

## 1. Espera a Gerardo

| Desde | Qué | Para | Estado |
|---|---|---|---|
| 2026-11-03 | Crear el workspace `movexnet` en platform.claude.com con tope de US$60 al mes (US$75 si entra R-35), sin método de pago ni recarga automática | R-10, R-14, R-32, R-33, R-34 | pendiente |
| 2026-11-03 | Crear una llave en ese workspace y cargarla como variable `MOVEXNET_ANTHROPIC_API_KEY` en el entorno de la nube (menú del entorno, Editar); nunca en el repositorio ni en el chat | R-32, R-33, R-34, R-35 | pendiente |
| 2026-11-03 | Cargar la llave como secreto de Supabase (`supabase secrets set ANTHROPIC_API_KEY=...`) y `SUPABASE_ACCESS_TOKEN` en el entorno de la nube | R-10, R-14 | pendiente |
| 2026-11-03 | Revisar la red del entorno: salida a `api.anthropic.com`, Supabase, `data.mendeley.com`, `github.com`, `storage.googleapis.com` y Kaggle; credenciales `KAGGLE_USERNAME` y `KAGGLE_KEY` | R-06, R-08, R-09 | pendiente |
| 2026-11-03 | Arrancar el coordinador (`docs/COORDINADOR.md` §3) en una sesión en la nube con permisos sin aprobación manual | todas | pendiente |
| 2026-11-03 | Decir si la cesión de Edwar cubre el contenido portado de fitnetv2 (catálogo de 60 ejercicios y fichas de `tutorials.ts`); si no lo cubre, R-34 reescribe las fichas desde cero | R-34 | pendiente |
| 2026-11-03 | R-06 pide un clip tuyo en una carpeta local, que una sesión en la nube no ve: la hija prueba con video sintético y con un clip de Mendeley; la prueba con tu clip queda aquí | R-06 | pendiente |
| 2026-11-03 | Definir dónde quedan las grabaciones propias para que una sesión en la nube las alcance (bucket privado o Drive con conector), antes de R-11 | R-11 | pendiente |
| 2026-11-03 | El 24 de noviembre: revocar las llaves y dejar la función `coach` en `COACH_MODE=mock` o con `COACH_GLOBAL_BUDGET_USD=0` hasta aprobar presupuesto pagado | R-10, R-14 | pendiente |
| 2026-11-03 | Fusionar los PRs de las hijas (DEC-070), empezando por R-01: fusionar el PR de DEC-081 y DEC-084 es aceptarlas | todas | pendiente |

## 2. Hijas activas

| Tarea | Sesión | Modelo · esfuerzo (por qué) | Rama | Lanzada | Próximo chequeo |
|---|---|---|---|---|---|

## 3. Esperando fusión

| Tarea | PR | CI | Desde |
|---|---|---|---|

## 4. Se dejó a medias o sin hacer

| Tarea | Qué quedó | Dónde sigue |
|---|---|---|

## 5. Bloqueadas o fallidas

| Tarea | Intentos | Motivo | Qué la desbloquea |
|---|---|---|---|

## 6. Gasto del crédito de la API (vence el 2026-11-24)

Tope del workspace: US$60. Último lote: 2026-11-22. El estimado sale de `docs/PLAN-COMERCIAL.md` §5 y de cada fila del roadmap; el real, de lo que informa cada hija.

| Tarea | Estimado (US$) | Real (US$) | Acumulado (US$) |
|---|---|---|---|
| R-10 | 2 | | |
| R-14 | 4 | | |
| R-32 | 35 | | |
| R-33 | 9 | | |
| R-34 | 3 | | |
| R-35 (opcional) | 13 | | |

## 7. Registro

| Fecha | Evento |
|---|---|
| 2026-11-03 | Archivo creado con la pauta del coordinador. Por verificar con la primera hija: si `create_session` acepta `environment_variables` para fijar el esfuerzo y si acepta el ID `claude-sonnet-5-5` |
