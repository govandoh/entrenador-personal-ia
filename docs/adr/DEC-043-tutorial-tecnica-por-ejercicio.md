# DEC-043 · Tutorial de técnica por ejercicio

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-1 (`src/exercises/demoPoses.ts`) e I-4 (pantallas)
- **Fecha:** 2026-09-22
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** ui, contenido
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-033 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** El usuario pidió un tutorial de cada ejercicio para ver la forma correcta de hacerlo. El catálogo tiene 60 ejercicios; solo 3 tienen análisis por cámara.  
**Alternativas consideradas:**  
(a) Videos o GIF de internet — descartado por derechos de autor, por depender de la red en una PWA pensada para funcionar sin conexión, y por no poder controlar la calidad.  
(b) Ilustraciones de inicio y fin de cada movimiento — 120 imágenes hechas a mano, con calidad difícil de sostener.  
(c) Ficha escrita para los 60, más demo 3D animada en los 3 con análisis.  
(d) Ficha escrita más demo 3D en los cerca de 20 ejercicios de peso corporal.  
**Decisión:** Opción (c), elegida por el usuario. La demo aporta más donde la app evalúa, porque muestra exactamente la técnica contra la que se compara al usuario. En ejercicios con máquina o polea, un esqueleto sin el equipo no enseña nada.  
**Ficha:** Pasos, errores comunes, respiración, músculos, equipo, consejo clave, y en los 3 con cámara, dónde colocar el celular. Once ejercicios de riesgo llevan una advertencia de seguridad. Todo en `src/exercises/tutorials.ts`, texto propio. El campo `videoUrl` queda reservado para grabaciones propias del equipo.  
**Demo 3D por cinemática directa:** `src/exercises/demoPoses.ts` genera los 33 landmarks a partir de unos pocos ángulos articulares por fase, en el mismo sistema de coordenadas que `worldLandmarks`. Se dibuja con el mismo `Pose3DView` del análisis en vivo, y el ángulo que se muestra se calcula con `calculateAngle3D`, la función que evalúa al usuario. Lo que se enseña y lo que se exige coinciden por construcción.  
**Consecuencia no planeada, y la más valiosa:** Las demos sirvieron como datos de prueba del motor. Alimentar los trackers reales con ellas destapó tres errores graves (DEC-044 y DEC-045) que habrían llegado al celular.  
**Cuándo se muestra:** A pedido, desde la biblioteca, el inicio, el editor de rutinas, el selector de ejercicios, el modo manual y la vista de cámara. Además, por elección del usuario, se abre solo la primera vez que alguien entrena cada ejercicio con cámara. Mientras está abierto, la detección se pausa: nadie debe sumar repeticiones mientras lee.  
**Por qué la hoja usa un portal:** El selector de ejercicios usa `backdrop-filter`, que convierte a su contenedor en el marco de referencia de los elementos fijos. Sin `createPortal`, la hoja del tutorial quedaría atrapada dentro del selector.

## Notas de integración

`tutorials.ts` (931 líneas de texto) se carga de forma perezosa al integrarse, para sacarlo del chunk principal. `demoPoses.ts` ya está integrado y sirve también como generador de secuencias 3D para los tests.
