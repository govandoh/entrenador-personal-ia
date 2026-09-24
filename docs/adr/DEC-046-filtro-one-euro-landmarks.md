# DEC-046 · Filtro One Euro sobre los landmarks

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-1 (`src/geometry/landmarkFilter.ts`)
- **Fecha:** 2026-09-22
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** analysis-core, pose-engine
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-036 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** Aun con la histéresis de DEC-045, un temblor de 15 mm seguía rompiendo el conteo en curl y press. En segmentos cortos como el antebrazo, 15 mm equivalen a varios grados.  
**Alternativas consideradas:**  
(a) Subir el umbral de histéresis — tapa el síntoma y debilita la detección de movimientos erráticos reales.  
(b) Promedio móvil sobre los landmarks — obliga a elegir entre temblor y retraso.  
(c) Filtro One Euro.  
**Decisión:** Opción (c), en `src/pose/landmarkFilter.ts`. Adapta su frecuencia de corte a la velocidad: filtra fuerte con el punto casi quieto, donde el temblor es lo único que hay, y deja pasar el movimiento rápido, donde el retraso sí importaría. Es la técnica estándar para estabilizar poses y manos en tiempo real (Casiez, Roussel y Vogel, CHI 2012).  
**Dónde se aplica:** Una sola vez, en la vista de cámara, antes de los trackers y del visor 3D. Todo lo que mide trabaja sobre la señal filtrada. La visibilidad no se filtra: los trackers la usan como compuerta y un valor retrasado dejaría pasar cuadros donde el punto ya no se ve.  
**Parámetros:** Corte mínimo 1.2 Hz, beta 0.8, corte de derivada 1 Hz. El filtro se reinicia si pasan más de 500 ms sin cuadros, para no arrastrar una posición vieja cuando el detector pierde a la persona.  
**Verificado:** 5 de 5 repeticiones con 8 y 15 mm de temblor en los tres ejercicios.

## Notas de integración

En este repo el filtro vive en `src/geometry/` (workstream B) porque es matemática pura, no captura. Resuelve también el comportamiento congelado 2 del PR 1 (spike de un frame que adelanta el fondo).
