# DEC-048 · Banco de pruebas del motor sin cámara

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-1
- **Fecha:** 2026-09-22
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** calidad, tests
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-038 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** Todo el análisis de movimiento se había escrito sin poder probarlo en celular. Tres errores graves solo aparecieron al pasar movimientos sintéticos por los trackers reales.  
**Decisión:** `scripts/pruebas-motor.mjs`, que se corre con `npm run test:motor`. Compila los módulos puros con el TypeScript del proyecto y los alimenta con las demos del tutorial, a distintas velocidades de cuadro y con ruido gaussiano de semilla fija. No agrega dependencias.  
**Qué cubre:** 37 pruebas. Técnica correcta a 15, 30 y 60 fps; temblor de 8 y 15 mm; ritmo rápido legítimo; tirones; recorridos parciales; fatiga progresiva; y los cuatro métodos del modo manual, con pausas del temporizador y salidas anticipadas.  
**Qué no cubre, y hay que decirlo:** La calidad de los landmarks reales ni el comportamiento con una persona frente a la cámara. Las demos son movimientos perfectos con ruido agregado; una persona real se mueve distinto. El banco sirve para no romper lo que ya funciona, no para calibrar umbrales: eso solo se hace en celular.

## Notas de integración

En este repo las comprobaciones se portaron a Vitest (`src/**/*.test.ts`, helper `src/testing/syntheticMotion.ts`) y corren en `pnpm check` y en CI. El script `scripts/pruebas-motor.mjs` no se importa. Las pruebas de trackers 3D llegan con I-2.
