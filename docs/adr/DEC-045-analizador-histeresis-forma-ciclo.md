# DEC-045 · Analizador de movimiento: histéresis, forma del ciclo y fase de esfuerzo mínima

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-1 (`movementQuality.ts`) e I-2 (trackers)
- **Fecha:** 2026-09-22
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** analysis-core
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-035 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** El banco de pruebas encontró dos defectos graves en el diseño de DEC-037 y DEC-038.  
**Defecto 1, el más serio:** Con 8 mm de temblor por landmark, que es lo normal en MediaPipe, se rechazaban **todas** las repeticiones como "movimiento irregular". La suavidad contaba cada cambio de signo de la velocidad cuadro a cuadro, y el ruido producía decenas por repetición. En un celular real, la validación de DEC-037 habría dejado la app contando cero.  
**Corrección 1:** Cambios de dirección con histéresis. Solo cuenta un cambio cuando el ángulo retrocede más de 12° desde el último extremo. El temblor no alcanza ese margen; un titubeo real sí. Se toleran hasta dos titubeos antes de considerar el movimiento irregular, siguiendo el criterio de DEC-037 de preferir aceptar una repetición dudosa antes que rechazar una legítima.  
**Defecto 2:** En curl y press la ventana de análisis empezaba al entrar en la fase de contracción, cuando el brazo ya había subido. Lo que se medía como fase de esfuerzo era en realidad la bajada, así que la fatiga al subir era invisible.  
**Corrección 2:** Cada ejercicio declara la forma de su ciclo: si el esfuerzo es el ángulo mínimo o el máximo, y si el ciclo empieza con el esfuerzo (curl y press) o con la bajada (sentadilla). La ventana arranca en la última vuelta a la posición de reposo, y la pausa en reposo antes de moverse se recorta buscando el último cuadro dentro de 6° del extremo de reposo.  
**Corrección 3:** Con el filtro de DEC-046, dos tirones seguidos de press podían fusionarse en un ciclo de más de 800 ms. Lo que los delata es la fase de empuje, de 167 ms. Se agregó una duración mínima de la fase de esfuerzo de 250 ms. Una fase controlada dura 400 ms o más incluso a ritmo rápido, y el banco confirma que un ciclo de 1.5 s sigue contando.  
**Descartado:** Subir la duración mínima del press a 800 ms. Se probó, no resolvía el caso, y se revirtió.

## Notas de integración

Se corrigió el comentario de `computeSmoothness`: con `minSmoothness` 0,35 se tolera un titubeo, no dos (0,3 tolera dos).
