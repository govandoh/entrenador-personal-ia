# Decisiones técnicas — índice

Las decisiones viven en **`docs/adr/`** en formato MADR, una por archivo. Este archivo se conserva porque el código y el historial de commits citan `DECISIONS.md` y los identificadores `DEC-NNN`; los identificadores no cambian.

- Cómo proponer una decisión, plantilla y reglas de aprobación: [`docs/adr/README.md`](docs/adr/README.md).
- Plantilla: [`docs/adr/TEMPLATE.md`](docs/adr/TEMPLATE.md).

| Rango | Origen | Enlace |
|---|---|---|
| DEC-001 … DEC-025 | MVP académico IA26 (abril–mayo 2026), migradas 1:1 | [`docs/adr/`](docs/adr/README.md#índice) |
| DEC-026 … DEC-033 | Fundación de Fitnet (2026-09-19) | [`docs/adr/`](docs/adr/README.md#índice) |

Acceso rápido a las más citadas desde el código:

| DEC | Tema | Archivo |
|---|---|---|
| DEC-009 | `calculateAngle` con `atan2` y `Point2D` | [docs/adr/DEC-009-angulos-atan2-point2d.md](docs/adr/DEC-009-angulos-atan2-point2d.md) |
| DEC-010 | Histéresis de umbral doble (sentadilla) | [docs/adr/DEC-010-sentadilla-histeresis-umbral-doble.md](docs/adr/DEC-010-sentadilla-histeresis-umbral-doble.md) |
| DEC-016 | Feedback de voz: confirmación por frames, sin colisiones | [docs/adr/DEC-016-feedback-voz-confirmacion-frames-prioridad.md](docs/adr/DEC-016-feedback-voz-confirmacion-frames-prioridad.md) |
| DEC-017 | Gate de conteo por confirmación de cima/fondo | [docs/adr/DEC-017-conteo-reps-gate-confirmacion.md](docs/adr/DEC-017-conteo-reps-gate-confirmacion.md) |
| DEC-021 | Delay de 450 ms al cambiar de cámara | [docs/adr/DEC-021-delay-450ms-cambio-camara.md](docs/adr/DEC-021-delay-450ms-cambio-camara.md) |
| DEC-022 / DEC-023 | Conteo unificado con cooldown (curl / press) | [DEC-022](docs/adr/DEC-022-curl-conteo-unificado-cooldown.md), [DEC-023](docs/adr/DEC-023-press-conteo-unificado-cooldown.md) |
| DEC-025 | Service Worker network-first para HTML | [docs/adr/DEC-025-service-worker-network-first.md](docs/adr/DEC-025-service-worker-network-first.md) |
| DEC-027 | Arquitectura híbrida de IA | [docs/adr/DEC-027-arquitectura-hibrida-ia.md](docs/adr/DEC-027-arquitectura-hibrida-ia.md) |
| DEC-028 | Monorepo pnpm y fronteras de paquetes | [docs/adr/DEC-028-monorepo-pnpm-fronteras-paquetes.md](docs/adr/DEC-028-monorepo-pnpm-fronteras-paquetes.md) |
| DEC-034 | Vía de implementación del análisis por IA (propuesta) | [docs/adr/DEC-034-via-implementacion-analisis-ia.md](docs/adr/DEC-034-via-implementacion-analisis-ia.md) |
| DEC-035 | Proyecto académico: sin facturación real, pagos simulados | [docs/adr/DEC-035-proyecto-academico-sin-facturacion-real.md](docs/adr/DEC-035-proyecto-academico-sin-facturacion-real.md) |

No agregar decisiones nuevas a este archivo: crear `docs/adr/DEC-NNN-*.md` y actualizar el índice de `docs/adr/README.md`.
