# DEC-036 · Migración del análisis a 3D con `worldLandmarks`

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-1 (`src/geometry/vectors3d.ts`), I-2 (trackers 3D) e I-3 (`poseDetector` devuelve `{screen, world}`)
- **Fecha:** 2026-09-19
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** analysis-core, pose-engine
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-026 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** Todos los cálculos angulares operaban sobre `result.landmarks`, las coordenadas normalizadas de pantalla. Ese espacio es una proyección: el ángulo medido depende de la posición y orientación de la cámara respecto al usuario. Un usuario girado 45° produce segmentos proyectados más cortos y ángulos sistemáticamente sobreestimados, al punto de que una sentadilla profunda real podía medirse como 120° en vez de 85°. La consecuencia práctica era pérdida de precisión y conteo poco confiable cuando el celular no estaba colocado en el ángulo ideal.  
**Hallazgo clave:** `PoseLandmarker` ya devolvía en cada cuadro un segundo conjunto, `result.worldLandmarks`, con coordenadas métricas 3D, origen en el punto medio de la cadera e independientes de la cámara. La aplicación lo recibía y lo descartaba. No hizo falta cambiar de modelo ni agregar ninguna dependencia de visión: el dato ya estaba disponible.  
**Alternativas consideradas:**  
(a) Corregir la proyección 2D con un factor derivado de la orientación estimada — requiere calibración, es frágil y solo compensa parcialmente.  
(b) Pedirle al usuario que se coloque siempre en el mismo ángulo — traslada el problema a la persona y no resuelve la imprecisión.  
(c) Usar `worldLandmarks` y calcular ángulos con producto punto en 3D.  
**Decisión:** Opción (c). Se agrega `src/geometry/vectors3d.ts` con `calculateAngle3D` basada en producto punto, más utilidades de orientación corporal, inclinación de tronco y asimetría. `detectAndDraw` pasa a devolver `PoseFrame` con ambos conjuntos: `screen` para dibujar el esqueleto sobre el video y `world` para toda la matemática. Los tres trackers se migran a `update(world, timeMs)`.  
**Por qué producto punto y no `atan2`:** En 3D no existe un sentido de giro bien definido sin un plano de referencia, y para una articulación solo importa la apertura. El coseno se limita a [-1, 1] antes de `Math.acos` porque la acumulación de error en punto flotante puede producir 1.0000000002, cuyo arcocoseno es NaN.  
**Validaciones nuevas que esto habilita:** Inclinación de tronco en sentadilla, arqueo lumbar en press y desplazamiento del codo en curl. Las tres eran indetectables en 2D porque el movimiento ocurre en profundidad, fuera del plano de la imagen, sin que la proyección cambie.  
**Se conserva `angles.ts`:** El módulo 2D no se elimina. Queda como referencia y para cualquier cálculo que deba operar sobre coordenadas de pantalla.

## Notas de integración

En este repo `calculateAngle3D` y el resto viven en `src/geometry/vectors3d.ts` con un tipo propio `Landmark3D` en lugar del `Landmark` de MediaPipe (regla de pureza de `analysis-core`, DEC-028).
