# DEC-056 · Rutina personalizada: cuestionario libre, generador por reglas, catálogo por olas y paywall en el programa completo

- **Estado:** Aceptada
- **Fecha:** 2026-09-24
- **Decisores:** responsable del proyecto; leads de los workstreams D (Backend de producto) y E (App & UI)
- **Etiquetas:** producto, dominio, ui, freemium

## Contexto y problema

Fitnet quiere servir para entrenar en casa y en el gimnasio. Al crear una rutina personalizada o elegir una de pago, el usuario debe poder configurar:

1. su objetivo;
2. su nivel;
3. dónde entrena y con qué equipo;
4. el tipo de programa.

Hay apps de rutinas parecidas en el mercado (fitnetapp.com, por ejemplo); el diferenciador de Fitnet es el asistente de ejercicios en tiempo real.

fitnetv2 (DEC-054) aporta un catálogo de 60 ejercicios con 3 analizados por cámara, rutinas con 3 plantillas (PPL, cuerpo completo, división por músculo), editor y modo manual (DEC-040, DEC-047, DEC-052). No tiene cuestionario ni generador, y no permite filtrar el catálogo:
- `equipment` es texto libre;
- no hay lugar de entrenamiento;
- el nivel del perfil (`experience`) se guarda pero no se usa;
- los presets de dificultad no distinguen objetivo.

Además, entrenar en casa sin equipo no es posible con los 3 ejercicios de cámara actuales: curl y press necesitan mancuernas.

## Opciones consideradas

1. **Generar la rutina con el LLM del `CoachAssistant` (DEC-033).** Flexible, pero tiene costo por llamada (regla de cero costo, DEC-035), la salida no es determinista y la rutina dependería de la red.
2. **Solo plantillas fijas.** Simple, pero no personaliza por equipo ni objetivo.
3. **Generador determinista por reglas sobre un catálogo filtrable** (elegida). El LLM, si se usa, solo explica o ajusta después, con revisión del entrenador (DEC-033).

Para el paywall se consideraron tres ubicaciones: antes del cuestionario, solo en planes de entrenador, o **cuestionario libre y programa completo premium** (elegida por el responsable del proyecto).

## Decisión

### Cuestionario (libre)

| Paso | Pregunta | Valores |
|---|---|---|
| 1 | Objetivo | `muscle_gain` (ganar músculo), `weight_loss` (perder peso), `strength_gain` (ganar fuerza) |
| 2 | Nivel | `beginner`, `intermediate`, `advanced` (reutiliza `experience` del perfil de fitnetv2) |
| 3 | Lugar y equipo | `gym_full` (gimnasio completo), `home_none` (casa sin equipo), `home_limited` (casa con equipo limitado) + checklist de etiquetas |
| 4 | Programa | días por semana (2–6), duración de la sesión y tipo (`full_body`, `upper_lower`, `ppl`). Se sugiere uno por reglas; el usuario puede cambiarlo. |

Las respuestas se guardan en `Profile` (`goal`, `experienceLevel`, `trainingLocation`, `equipment[]`, `daysPerWeek`, `sessionMinutes`, `programType`; ver `docs/DOMAIN.md`).

### Catálogo

Se adopta el catálogo de fitnetv2 (DEC-040) con tres cambios:

- `equipment` pasa a **etiquetas**: `bodyweight`, `dumbbell`, `barbell`, `bench`, `band`, `pullup_bar`, `kettlebell`, `machine`, `cable`, `cardio_machine`. Un ejercicio es elegible si todas sus etiquetas están en el equipo del usuario.
- Se añaden `locations` (`gym`, `home`) y `movementPattern` (`knee_dominant`, `hip_hinge`, `horizontal_push`, `vertical_push`, `horizontal_pull`, `vertical_pull`, `isolation_upper`, `isolation_lower`, `core`, `cardio`).
- `tracking` se conserva (`camera` | `reps` | `time`). `camera` se muestra como la insignia **"con asistente"**.

El asistente crece **por olas**. Pasar un ejercicio a `camera` es configuración (ángulo primario, polaridad, umbrales de `movementQuality`) más ejemplos para el k-NN (DEC-055), no un tracker escrito a mano:

| Ola | Ejercicios que pasan a `camera` | Habilita |
|---|---|---|
| 0 (hoy) | sentadilla, curl de bíceps, press de hombro | — |
| 1 | flexiones, zancadas, puente de glúteo, plancha (isométrico: tiempo y cadera caída) | Rutina de casa sin equipo con asistente |
| 2 | peso muerto rumano, remo con mancuerna, elevaciones laterales, extensión sobre la cabeza, sentadilla goblet (reusa la sentadilla) | Casa con mancuernas |
| 3 | peso muerto, hip thrust, sentadilla frontal (reusa la sentadilla) | Gimnasio |

Máquinas y poleas se quedan en `reps` (modo manual, DEC-047). Así las rutinas siempre tienen variedad aunque el asistente no cubra todo.

### Generador de rutinas

Es una función pura en el dominio (`packages/domain`, hoy `src/routines/`), sin LLM y determinista:

1. Filtra el catálogo por etiquetas de equipo y lugar.
2. Elige la división según días y nivel:
   - principiante → cuerpo completo 2–3 días;
   - intermedio → torso/pierna 4 días o PPL 3 días;
   - avanzado → PPL 5–6 días.
3. Llena cada día por patrones de movimiento (por ejemplo, un día de cuerpo completo: rodilla, cadera, empuje, tracción y core), **prefiriendo `tracking: camera`** a igualdad de patrón.
4. Fija la prescripción por objetivo. Sustituye a los `DIFFICULTY_PRESETS` de fitnetv2, que no distinguen objetivo:

   | Objetivo | Series × reps | Descanso |
   |---|---|---|
   | Fuerza | 3–5 × 3–6 | 2–3 min |
   | Hipertrofia | 3–4 × 8–12 | 60–90 s |
   | Pérdida de peso | 2–3 × 12–15 | 30–45 s, con superseries |

   El volumen se ajusta por nivel.
5. Métodos avanzados (rest-pause, dropset) solo desde nivel intermedio.

La salida es una `Routine` del modelo de fitnetv2, más `loadKg` en `RoutineExercise` para medir progresión.

### Freemium

| Libre | Premium |
|---|---|
| Cuestionario completo | Programa completo (todas las semanas) |
| Semana 1 de la rutina generada, ejecutable con asistente | Calendario y progresión automática |
| Las 3 plantillas de fitnetv2 y los ejercicios con asistente | Planes publicados por entrenadores |
| Rutinas propias básicas | Ajustes por progreso y análisis avanzado |

El cobro usa `MockPaymentProvider` con el aviso de "pago simulado" (DEC-035). Mientras no exista Supabase (#17), las respuestas y la rutina se guardan en `localStorage` defensivo (DEC-024).

## Consecuencias

### Positivas

- El usuario ve valor (su semana 1 personalizada, con asistente) antes del paywall. Es el embudo que mide el análisis de rentabilidad.
- Cero costo y resultado reproducible y testeable.
- El catálogo por olas convierte el crecimiento del asistente en una cola de trabajo clara para los workstreams B y C.

### Negativas

- Las reglas de prescripción son simplificaciones de la literatura de entrenamiento y hay que revisarlas con un entrenador; no son consejo médico.
- Migrar `equipment` de texto a etiquetas toca los 60 ejercicios del catálogo de fitnetv2.
- Hasta la ola 1, la rutina de casa sin equipo tiene un solo ejercicio con asistente (sentadilla).

## Referencias

- `DEC-040`, `DEC-047`, `DEC-052` (fitnetv2), `DEC-054`, `DEC-055`, `DEC-035`, `DEC-033`, `DEC-024`.
- `docs/PRODUCT.md` (E3, E8, freemium), `docs/DOMAIN.md` (Profile, Exercise, ProgramTemplate).
