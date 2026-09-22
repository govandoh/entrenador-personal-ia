# DEC-026 · Levantamiento de las restricciones del MVP y alcance de Fitnet

- **Estado:** Aceptada
- **Fecha:** 2026-09-19
- **Decisores:** Leads de los workstreams B, D y E (ver `docs/WORKSTREAMS.md`)
- **Etiquetas:** producto, proceso, alcance

## Contexto y problema

`entrenador-personal-ia` fue el MVP del curso IA26 (UMG), entregado el 22/05/2026: una PWA React 19 + Vite 8 + TypeScript que corre MediaPipe Pose en el celular, calcula ángulos con `atan2` y evalúa tres ejercicios (sentadilla, curl de bíceps, press de hombro) con máquinas de estados y umbrales angulares fijos. El `CLAUDE.md` original imponía seis restricciones duras, derivadas del curso: mobile-first, **sin backend**, stack fijo, deploy gratuito, **cero costos económicos** y español en UI/docs.

El proyecto pasa a ser **Fitnet**, una aplicación de gimnasio completa con el siguiente alcance formal (8 puntos):

1. Perfiles de usuario con objetivos y progreso.
2. Análisis de movimiento "3D": fatiga, patrones incorrectos, velocidad y consistencia, además del conteo actual.
3. Rutinas y calendario de entrenamiento.
4. Métodos de entrenamiento (rest-pause, dropset, push/pull/legs, superset).
5. Planes de entrenadores: marketplace de planes y coaching 1:1 asistido por IA.
6. Métricas, rankings y retos.
7. Comunidad.
8. Modelo freemium: usuarios premium y fee mensual para entrenadores.

Cuentas, entrenadores, pagos y rankings son imposibles sin servidor. Las restricciones "sin backend" y "cero costos" del MVP bloquean el alcance nuevo; hay que decidir qué se conserva y qué se levanta, y dejarlo documentado para que ninguna sesión (humana o de IA) siga aplicando las reglas del curso por inercia.

## Opciones consideradas

1. **Mantener todas las restricciones del MVP** y limitar Fitnet a lo que cabe en el cliente (historial en IndexedDB, sin cuentas). Descartada: el alcance formal (puntos 5, 6, 7 y 8) es inviable sin backend ni cobros.
2. **Levantar todas las restricciones sin sustituirlas**, incluida mobile-first y el stack. Descartada: la base de código y el equipo son React + TypeScript + MediaPipe; cambiar de stack o construir app nativa no aporta al alcance y multiplica el trabajo.
3. **Levantar solo "sin backend" y "cero costos", sustituyéndolas por reglas nuevas** (elegida): se permite backend y proveedores externos con la condición de operar en planes gratuitos hasta que existan ingresos; se conservan mobile-first, PWA, español y se añade la regla de privacidad "el video nunca sale del dispositivo".

## Decisión

Se levantan las restricciones 2 ("sin backend"), 4 ("deploy gratuito" en su forma original) y 5 ("cero costos") del MVP y se reemplazan por el conjunto vigente:

| Regla | Estado | Detalle |
|---|---|---|
| Mobile-first, prueba en celular | Se conserva | La PWA es el único cliente; no hay app nativa. |
| Sin backend | **Se levanta** | Se adopta un BaaS (ver `DEC-029`). |
| Stack fijo | Se ajusta | Se mantiene React + TypeScript + MediaPipe; se admiten paquetes nuevos justificados por ADR (ONNX Runtime Web, zustand, zod, Vitest, Playwright). |
| Deploy gratuito | Se ajusta | Vercel Hobby mientras no haya cobro; su plan Hobby prohíbe uso comercial, así que al lanzar planes de pago se migra a Cloudflare Pages o Vercel Pro (requiere DEC propia). |
| Cero costos | **Se sustituye** por "cero costo mientras no haya ingresos": free tiers, sin tarjeta cuando sea posible, y cualquier gasto se paga con revenue. El tope mensual aceptable antes de ingresos lo fija el equipo (pendiente, ver `docs/STATUS.md`). |
| Español en UI y docs | Se conserva | Identificadores de código en inglés. |
| Privacidad | **Nueva** | El video de la cámara nunca sale del dispositivo; a la nube solo viajan landmarks y métricas estructuradas, con consentimiento explícito (ver `docs/DATA-GOVERNANCE.md`). |

El producto se renombra **Fitnet** en UI y documentación. El repositorio puede renombrarse a `govandoh/fitnet` sin romper clones (GitHub redirige); la decisión de renombrar y de mantenerlo público o privado queda pendiente del equipo.

El alcance se organiza en cuatro fases (detalle en `docs/PRODUCT.md`): Fase 1 núcleo de IA + plataforma; Fase 2 perfiles, rutinas y calendario; Fase 3 entrenadores, marketplace y coaching; Fase 4 comunidad y pagos.

## Consecuencias

### Positivas

- Desbloquea los 8 puntos del alcance formal.
- Las reglas nuevas quedan explícitas en `AGENTS.md`; ninguna sesión de IA vuelve a declinar un backend "porque el curso lo prohibía".
- La regla de privacidad convierte una propiedad accidental del MVP (todo en el cliente) en un compromiso de producto verificable.

### Negativas

- Aparecen costos potenciales (Supabase Pro, Vercel Pro, API de Claude, comisiones de pago) que hoy no existen; se mitigan con free tiers y con el tope pendiente.
- Aparecen obligaciones legales nuevas: entidad legal para cobrar (ver `DEC-030`), aviso de privacidad por datos de salud alojados en EE. UU. (ver `DEC-029`).
- La app en producción del MVP debe seguir funcionando durante toda la migración (estrategia strangler en `ARCHITECTURE.md`).

## Nota posterior (2026-09-22) — modificada por `DEC-035`

Esta ADR asumió explotación comercial. El alcance aclarado es que **Fitnet no saldrá a la venta**: es un proyecto de seminario y el modelo de negocio es objeto de análisis, no de facturación. Cambian tres puntos de la tabla de arriba:

- **Cero costos** vuelve a ser absoluto, sin la coletilla "mientras no haya ingresos". No hay tope que fijar: todo va sobre planes gratuitos.
- **Deploy gratuito**: Vercel Hobby se queda. La migración a Cloudflare Pages o Vercel Pro solo existía por la prohibición de uso comercial de ese plan y queda sin efecto.
- **Obligaciones legales**: no hace falta entidad legal, NIT ni cuenta bancaria. El aviso de privacidad sigue siendo exigible por ética de investigación con los voluntarios del sprint de datos.

El alcance funcional no se reduce: suscripciones, planes premium y cuota de entrenadores se implementan completos contra un proveedor simulado (`DEC-035`).

## Referencias

- `DEC-035` (proyecto académico sin facturación real).
- `CLAUDE.md` del MVP (historial git anterior a esta ADR), sección "Restricciones duras".
- `docs/PRODUCT.md`, `docs/STATUS.md`, `docs/DATA-GOVERNANCE.md`.
- `DEC-027`, `DEC-028`, `DEC-029`, `DEC-030`.
