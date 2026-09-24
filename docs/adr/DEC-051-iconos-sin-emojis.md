# DEC-051 · Íconos en lugar de emojis

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-4
- **Fecha:** 2026-09-23
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** ui
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-041 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** El usuario pidió no usar emojis: se ven distintos en cada sistema operativo y no encajan con el resto de la interfaz. Había 11 en los filtros de grupos musculares y 8 en los logros.  
**Decisión:** Los filtros de grupos musculares quedan solo con texto, que es lo más limpio para un filtro. Los logros usan íconos propios en `src/ui/icons/AchievementIcon.tsx`, dibujados con el mismo trazo que la barra de navegación. No se agregó ninguna librería de íconos.  
**Verificado:** El escáner de caracteres pictográficos da cero en todo `src/`.

## Notas de integración

Coincide con la regla dura 4 de este repo (sin emojis).
