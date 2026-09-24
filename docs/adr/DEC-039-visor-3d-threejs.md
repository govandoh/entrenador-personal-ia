# DEC-039 · Visor 3D del esqueleto con Three.js

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-4
- **Fecha:** 2026-09-19
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** ui, dependencias
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-029 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** El análisis pasó a 3D en DEC-036, pero la pantalla seguía mostrando únicamente la proyección plana del esqueleto sobre el video. No había forma de verificar visualmente que la profundidad se estuviera midiendo, ni de mostrarle al usuario qué información nueva tiene el sistema.  
**Alternativas consideradas:**  
(a) Proyectar el esqueleto 3D a mano sobre el canvas 2D existente — sin dependencias, pero con rotación, iluminación y orden de profundidad resueltos manualmente.  
(b) Three.js.  
**Decisión:** Opción (b), autorizada explícitamente por el usuario tras plantearle el costo. Se agrega `src/ui/Pose3DView.tsx`.  
**Decisiones de implementación:**  
- Actualización por API imperativa mediante `useImperativeHandle`, no por props. El bucle de detección corre a 60 cuadros por segundo y provocar un render de React por cuadro dejaría sin margen al hilo principal del celular.  
- Los huesos son un único `LineSegments` cuyos vértices se reescriben en el lugar, y las articulaciones un `InstancedMesh` de 33 esferas. Ambas decisiones evitan crear objetos por cuadro.  
- Se rota un grupo contenedor y no la cámara, para que la luz quede fija respecto al espectador y el esqueleto no se oscurezca al girar.  
- El eje Y de `worldLandmarks` apunta hacia abajo y Three.js lo usa hacia arriba, de ahí la inversión de signo al copiar las coordenadas.  
- La limpieza descarta geometrías, materiales y el contexto WebGL a mano. El recolector de basura de JavaScript no libera memoria de GPU.  
**Carga diferida:** Three.js agregaba cerca de 540 kB al paquete principal y hacía que la cámara esperara a la librería de render. Se carga con `React.lazy`, por lo que queda en un fragmento aparte que solo se descarga al abrir el visor. El paquete inicial bajó de 999 kB a 458 kB.
**Actualización 2026-09-22:** La escala original de la escena hacía que un cuerpo real midiera casi 7 unidades con una cámara que veía menos de 5: los pies quedaban fuera del cuadro. Se corrigió la escala y el encuadre, y se anclaron los pies al suelo. El mismo visor reproduce ahora las demos del tutorial (DEC-043).

## Notas de integración

Esta decisión cumple el requisito de la regla dura 9 (dependencia nueva con DEC) para `three` y `@types/three`. Condición al integrarlo: `Pose3DView` se carga siempre con `React.lazy` en un chunk aparte, fuera del presupuesto de 350 kB gz del shell.
