# DEC-049 · Registro de la interfaz: tuteo

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-4
- **Fecha:** 2026-09-22
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** ui, contenido
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-039 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** La app original usa "tú" ("Apunta tu cámara", "Baja un poco más", "Asegúrate"), y el usuario también escribe en "tú". En la fase 6 se introdujo voseo ("Bajá", "Pegá", "Tenés") en todos los textos nuevos, y el onboarding original ya tenía un caso aislado ("Posicioná... empezá").  
**Decisión:** Tuteo en toda la interfaz. Se corrigieron 68 casos con un mapa exacto de formas verbales, aplicado solo sobre palabras completas y verificado después con un escáner que reconoce tildes.  
**Mensajes de error de cámara:** El navegador los entrega en inglés ("Permission denied"). Se traducen a mensajes accionables en español según el tipo de error, por la restricción 6 del proyecto.

## Notas de integración

Aplica a toda la UI de este repo. Los textos ya integrados (`src/analysis/messages.ts`) están en tuteo.
