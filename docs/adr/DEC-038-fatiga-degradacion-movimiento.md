# DEC-038 · Detección de fatiga por degradación del patrón de movimiento

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-1 (`src/analysis/fatigue.ts`)
- **Fecha:** 2026-09-19
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** analysis-core, metricas
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-028 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** El usuario pidió detección de fatiga como parte del alcance de Fitnet. No hay sensores adicionales disponibles ni se pueden agregar sin romper la restricción de costo cero.  
**Fundamento:** En entrenamiento de fuerza la velocidad de la fase concéntrica cae de forma monótona conforme se acumula fatiga dentro de una serie, incluso con la carga constante. Es el principio del entrenamiento basado en velocidad. Junto con la pérdida de recorrido y el aumento de asimetría entre lados, da una estimación razonable a partir de los mismos landmarks que ya se procesan.  
**Decisión:** Agregar `src/analysis/fatigue.ts` con `FatigueDetector`. Las primeras tres repeticiones de cada serie establecen la línea base de velocidad y recorrido. A partir de ahí se compara el promedio de las últimas tres contra esa línea base. El puntaje combina caída de velocidad con peso 2, pérdida de recorrido con peso 1.5 y asimetría con peso 40, y se limita a 100.  
**Por qué promediar las últimas tres y no la última:** Una repetición con un landmark ruidoso no debe disparar un salto de nivel. La asimetría además se suaviza con media móvil.  
**Niveles:** fresco, moderado a partir de 10% de caída, alto a partir de 20% y crítico a partir de 30%. El nivel crítico activa `shouldRest` y el mensaje pasa a tener prioridad sobre el resto de la retroalimentación.  
**Limitación declarada:** No es un diagnóstico médico ni una medición de fatiga fisiológica. Es un indicador de degradación del patrón, útil para sugerir descanso.  
**Alcance de la línea base:** Se reinicia con `startNewSet` al cerrar cada serie, no con `reset`, para que el contador de repeticiones no se pierda al empezar una serie nueva.
**Actualización 2026-09-22:** En curl y press la ventana de análisis empezaba cuando el brazo ya había subido, y lo que se medía como fase de esfuerzo era la bajada. La caída de velocidad al subir era invisible. Corregido en DEC-045.

## Notas de integración

`FatigueState` ya no lleva `message` ni hay `FATIGUE_COLOR` en el módulo: la UI los resuelve desde `level`. Defecto detectado al integrar: los trackers de v2 pasan la asimetría del cuadro que cierra la repetición, que en reposo es ≈ 0, así que el término de asimetría no aporta. Se corrige en I-2 pasando la del punto de esfuerzo. Los pesos de v2 (2 / 1,5 / 40) difieren de la fórmula `fatigue_index` de `METRICS.md` §3; conciliarlos es trabajo de I-2 con DEC.
