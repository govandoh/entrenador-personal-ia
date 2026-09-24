# DEC-040 · Catálogo de ejercicios y modelo de rutinas

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-4
- **Fecha:** 2026-09-19
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** dominio, ui
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-030 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** El usuario pidió un menú para crear y calendarizar rutinas de todos los músculos del cuerpo, con nivel de dificultad por ejercicio. La aplicación solo sabe analizar tres ejercicios por cámara, porque solo para esos tres existe un tracker con máquina de estados y umbrales validados.  
**Tensión de fondo:** Un catálogo de cuerpo completo implica que la mayoría de los ejercicios no tendrán análisis de técnica. Ocultar esa diferencia le prometería al usuario algo que no se está haciendo.  
**Decisión:** Catálogo mixto de 60 ejercicios en 11 grupos musculares, con un campo `tracking` que distingue tres modos: `camera` para los tres con análisis 3D, `reps` para conteo manual y `time` para temporizador. La distinción se muestra de forma explícita en toda la interfaz, con una etiqueta 3D en el selector y un botón "Analizar" contra una etiqueta "Manual" en la pantalla de inicio.  
**Modelo de rutinas:** Una rutina agrupa días; cada día tiene un día de la semana, un nombre libre, los grupos musculares que cubre y sus ejercicios. Cada entrada de ejercicio lleva su propia dificultad, series, repeticiones, segundos de sostén, descanso y método. Solo una rutina puede estar activa, y es la que manda en el calendario de la pantalla de inicio.  
**Dificultad:** Bajo, medio y alto. Al elegir un nivel se aplica un preajuste de volumen que el usuario puede ajustar después. El nivel no es solo una etiqueta: cambia series, repeticiones y descanso.  
**Métodos de entrenamiento:** Se incluyen series normales, rest-pause, dropset y superserie, pedidos explícitamente. La división empuje, tirón y pierna se entrega como plantilla sembrada en el primer arranque, junto con una de cuerpo completo y una división por músculo.  
**Persistencia:** `localStorage`, según la restricción de no usar backend. Los identificadores se generan localmente y las fechas se guardan como epoch en milisegundos para evitar ambigüedad de zona horaria al serializar.

## Notas de integración

DEC-056 amplía el modelo: `equipment` pasa de texto libre a etiquetas filtrables, se añaden `locations` y `movementPattern`, y `RoutineExercise` gana `loadKg` para poder medir progresión. Los colores (`DIFFICULTY_COLORS`) salen del catálogo a la UI.
