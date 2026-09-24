# DEC-041 · Perfil, progreso y logros derivados del historial

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-4
- **Fecha:** 2026-09-19
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** dominio, ui
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-031 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** El alcance de Fitnet pide perfil de usuario con progresos, logros y definición de objetivos.  
**Decisión de diseño principal:** Nada de progreso se almacena de forma acumulada. Todas las estadísticas, el progreso de objetivos y los logros se derivan del historial de sesiones en cada render. El historial es la única fuente de verdad.  
**Razón:** Un contador acumulado puede desincronizarse por un error y quedar contradiciendo lo que muestra el historial, sin forma de saber cuál de los dos miente. Derivar elimina esa clase de error por completo. El costo de recalcular es despreciable frente al límite de 300 sesiones guardadas.  
**Cálculo de racha:** Se cuenta hacia atrás desde hoy. Si hoy todavía no se entrenó, la racha sigue viva cuando ayer sí, porque el día aún no terminó. Las claves de día se arman con componentes locales y no con `toISOString`, que convierte a UTC y corre un día entero en zonas horarias negativas como la de Guatemala.  
**Objetivos:** Cuatro tipos, según frecuencia semanal, repeticiones acumuladas, sesiones completadas o días de racha. Cada uno se contrasta contra la estadística que le corresponde.  
**Logros:** Ocho, con progreso parcial visible cuando aún no se desbloquean.

## Notas de integración

Al integrarlo, `computeStats`, `goalProgress` y `computeAchievements` reciben `now` como parámetro en vez de llamar a `Date.now()`, para poder probarlos.
