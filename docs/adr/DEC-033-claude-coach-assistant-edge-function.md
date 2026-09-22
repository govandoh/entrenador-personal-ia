# DEC-033 · Claude `claude-opus-5` para el `CoachAssistant` vía Edge Function, con salida estructurada y Batch API para resúmenes

- **Estado:** Aceptada
- **Fecha:** 2026-09-19
- **Decisores:** Leads de los workstreams D (Backend) y B (Análisis)
- **Etiquetas:** backend, coach-assistant, llm

## Contexto y problema

El alcance incluye coaching 1:1 asistido por IA, ajustes de rutina y resúmenes para entrenadores. `DEC-027` fija que el LLM recibe **solo métricas estructuradas** y nunca video, landmarks crudos ni la responsabilidad de contar reps. Falta decidir modelo, dónde vive la API key, cómo se garantiza que la salida sea consumible por la app (no texto libre) y cómo se controla el costo por usuario.

## Opciones consideradas

1. **Llamar a la API del LLM desde el cliente** con la key en el bundle. Descartada: expone la clave, no permite rate limit por usuario ni por tier.
2. **Reglas/plantillas sin LLM** para generar consejos. Descartada como solución única: no escala a rutinas, contexto del entrenador ni conversación; se conserva como fallback si la función falla.
3. **Modelo pequeño/barato por defecto** para todo. Descartada: los resúmenes y ajustes de rutina requieren razonamiento sobre múltiples métricas y objetivos; el costo se controla mejor con Batch API y caching que bajando de modelo.
4. **Claude `claude-opus-5` detrás de una Edge Function de Supabase, salida estructurada, prompt caching y Batch API para lo asíncrono** (elegida).

## Decisión

### Modelo y parámetros

- Modelo: **`claude-opus-5`**.
- Thinking adaptativo con `output_config.effort` **medio** para resúmenes; se ajusta por tarea según evals.
- **Salida estructurada** con `output_config.format` (JSON Schema) y validación con **zod** en la Edge Function antes de persistir o devolver.
- Prompt del sistema estable marcado con `cache_control` para abaratar llamadas repetidas.

### Modos de invocación

| Caso de uso | Modo | Motivo |
|---|---|---|
| `summarizeSession` (resumen nocturno de sesión) | **Batch API** (−50 %) | No requiere respuesta inmediata. |
| `trainerDigest` (digest semanal por entrenador) | **Batch API** | Idem. |
| `suggestRoutineAdjustments` | Batch o en línea según origen | Los ajustes pasan por revisión del entrenador antes de ser visibles al cliente. |
| Chat 1:1 en `CoachingThread` | **En línea** | Única interacción sincrónica. |

### Entrada y límites

- Entrada: `Metric`/`RepSummary` agregados por serie/sesión + perfil y objetivos del usuario. **Nunca** video ni landmarks crudos.
- El LLM no cuenta reps ni corrige al analizador; si detecta inconsistencias las reporta como observación.
- Sin consejo médico: el prompt del sistema lo prohíbe y las evals lo verifican.

### Infraestructura

- La API key vive **solo** en la Edge Function `supabase/functions/coach`; el cliente la invoca autenticado (JWT de Supabase).
- Rate limit por usuario y por tier (premium); tope de costo por usuario premium/mes pendiente de definir por el equipo.
- El puerto `CoachAssistant { summarizeSession, suggestRoutineAdjustments, trainerDigest }` se define en `@fitnet/contracts`; la implementación HTTP vive en `@fitnet/api-client`; prompts, esquemas y evals en `supabase/functions/coach/**` y `evals/coach/**`, propiedad de `coach-prompt-engineer` (`DEC-032`).

## Consecuencias

### Positivas

- La app consume JSON validado; un cambio de redacción del modelo no rompe la UI.
- Costo controlado: caching del prompt del sistema, Batch API para el grueso del volumen, rate limit por tier.
- La clave nunca llega al cliente; la autorización reutiliza Auth y RLS de Supabase.

### Negativas

- Dependencia de un proveedor de LLM y de su disponibilidad; el fallback es no mostrar coaching (las métricas siguen calculándose en el dispositivo).
- Latencia y costo del chat en línea; se limita a usuarios premium con entrenador.
- Requiere evals propias (`evals/coach/`) para detectar regresiones de calidad o de seguridad (consejo médico) al cambiar prompts o modelo.

## Referencias

- Documentación de la API de Claude (salida estructurada, prompt caching, Batch API): https://docs.claude.com/en/api
- `docs/DOMAIN.md` (`Metric`, `CoachingThread`, `Report`), `docs/DATA-GOVERNANCE.md`.
- `DEC-027`, `DEC-029`, `DEC-032`.
