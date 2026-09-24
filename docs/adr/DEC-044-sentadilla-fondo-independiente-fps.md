# DEC-044 · Sentadilla: confirmación del fondo independiente de la velocidad de cuadros

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-2
- **Fecha:** 2026-09-22
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** analysis-core, golden
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-034 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** Al pasar la demo de sentadilla por el tracker real, a 60 cuadros por segundo se contaron **cero** repeticiones, aunque el ángulo recorría de 80° a 173° y la retroalimentación salía verde.  
**Causa:** El fondo se confirmaba solo si el ángulo subía más de 2° entre un cuadro y el siguiente. Eso hace depender el conteo de la velocidad de cuadros: a 60 fps, una subida controlada avanza menos de 2° por cuadro y nunca se confirma. El error viene del código original y el cambio a 3D lo heredó. En curl y press el equipo ya había corregido este patrón en DEC-016, pero la sentadilla quedó con la versión vieja. Es una explicación plausible del conteo errático en celulares rápidos.  
**Decisión:** El fondo se confirma cuando el ángulo ya subió 8° por encima del mínimo acumulado en la bajada. No depende de cuántos cuadros haya, y 8° de margen supera con holgura el temblor de los landmarks. La histéresis de fases, que mantiene `squatting` hasta los 160°, garantiza que la confirmación ocurra antes de cerrar el ciclo.  
**Verificado:** 5 de 5 repeticiones contadas a 15, 30 y 60 fps.

## Notas de integración

Cambia el comportamiento congelado en los golden del PR 1 (el fondo dependía de los fps, `fixtures/README.md` punto 1), así que su integración en I-2 actualiza snapshots enlazando esta DEC y DEC-054.
