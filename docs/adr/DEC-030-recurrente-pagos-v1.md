# DEC-030 · Recurrente como proveedor de pagos v1 (Paddle secundario; Stripe no disponible en Guatemala)

- **Estado:** Aceptada
- **Fecha:** 2026-09-19
- **Decisores:** Lead del workstream D, con el equipo (implica decisión legal)
- **Etiquetas:** backend, pagos, negocio

## Contexto y problema

El modelo freemium (`docs/PRODUCT.md`) requiere cobrar dos cosas: la suscripción de usuarios premium y el fee mensual de los entrenadores que publican planes o dan coaching. El equipo está en Guatemala. **Stripe no acepta empresas guatemaltecas** (en América solo opera en EE. UU., Canadá, México y Brasil); la única vía sería Stripe Atlas, que implica constituir una entidad en Delaware (≈ 500 USD) y presentar declaraciones anuales en EE. UU. Mercado Pago no opera en Guatemala y PayPal cuesta entre 7 y 9 % efectivo.

## Opciones consideradas

1. **Stripe vía Stripe Atlas** — Descartada para v1: costo inicial, obligaciones fiscales en EE. UU. y complejidad legal desproporcionada antes de tener ingresos.
2. **PayPal** — Descartada: 7–9 % efectivo y experiencia de suscripción pobre.
3. **Mercado Pago** — Descartada: no opera en Guatemala.
4. **Paddle** (Merchant of Record, 5 % + 0.50 USD, acepta Guatemala) — Elegida como **proveedor secundario** para tarjetas internacionales; como MoR asume impuestos, pero la liquidación es internacional y su checkout está orientado a software.
5. **Recurrente** (elegida como v1) — Proveedor guatemalteco: GTQ y USD, checkout alojado, suscripciones, webhooks, sandbox, ≈ 4.5 % + IVA, liquidación en banco local; requiere NIT y cuenta bancaria en Guatemala.

## Decisión

**Recurrente** es el proveedor de pagos de la versión 1 y cubre tanto la suscripción premium como el fee mensual de entrenadores. **Paddle** se integra después como segundo proveedor para clientes con tarjetas internacionales.

### Integración

- El cliente nunca procesa pagos: abre el checkout alojado de Recurrente.
- El **webhook** de Recurrente es el único escritor de la tabla `subscriptions` (con `service-role`, ver `DEC-029`); la función SQL `is_premium(uid)` deriva los `Entitlement` activos.
- Idempotencia por `event_id` del webhook; toda transición de estado queda en un ledger.

### Pagos a entrenadores (marketplace)

v1: liquidación **manual mensual** a partir de una tabla ledger (`payouts`) que registra ventas de planes y comisiones. Se automatiza cuando Recurrente confirme soporte de splits o transferencias programáticas.

### Pendientes que dependen del equipo (no bloquean el desarrollo)

- Entidad legal en Guatemala (NIT, cuenta bancaria) frente a Stripe Atlas.
- Precios en GTQ o USD.
- Fee de entrenador plano vs. porcentaje de ingresos.

## Consecuencias

### Positivas

- Cobro posible sin constituir empresa en el extranjero; liquidación en banco local.
- Sandbox y webhooks permiten probar el flujo completo antes de tener entidad legal.
- La tabla `subscriptions` gobernada por webhook evita que el cliente pueda auto-otorgarse premium.

### Negativas

- Comisión ≈ 4.5 % + IVA, superior a Stripe estándar.
- Dos proveedores (Recurrente + Paddle) implican dos webhooks y una capa de normalización en `api-client`/Edge Functions.
- Payouts manuales en v1: carga operativa mensual y riesgo de error humano hasta automatizar.
- Requiere entidad legal y NIT antes de cobrar el primer quetzal.

## Nota posterior (2026-09-22) — reinterpretada por `DEC-035`

Fitnet no saldrá a la venta: es un proyecto de seminario. **Esta ADR deja de ser una integración a construir y pasa a ser un estudio comparativo**, insumo del análisis de rentabilidad. Recurrente queda documentado como el proveedor que se elegiría, con su comisión aproximada de 4.5 % más IVA, para el cálculo de márgenes y del punto de equilibrio.

Lo que se construye en su lugar: un puerto `PaymentProvider` con una implementación `MockPaymentProvider`. El flujo de suscripción, los estados, el webhook que escribe `subscriptions`, la función `is_premium(uid)` y el ledger de liquidaciones se implementan completos y demostrables; solo el cobro es ficticio. Los tres pendientes de equipo que listaba esta ADR (entidad legal, moneda, forma de la cuota) dejan de bloquear desarrollo y pasan a ser variables del análisis financiero.

## Referencias

- `DEC-035` (proyecto académico sin facturación real).
- Recurrente: https://recurrente.com
- Paddle: https://www.paddle.com
- Países soportados por Stripe: https://stripe.com/global
- `docs/PRODUCT.md` (modelo freemium), `docs/DOMAIN.md` (`Subscription`, `Entitlement`).
- `DEC-026`, `DEC-029`.
