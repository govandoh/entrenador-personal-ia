# DEC-035 · Fitnet es un proyecto académico de seminario: sin facturación real, pagos simulados y pesos preentrenados permitidos en el prototipo

- **Estado:** Aceptada
- **Fecha:** 2026-09-22
- **Decisores:** el equipo (aclaración del alcance por parte del responsable del proyecto)
- **Etiquetas:** alcance, legal, ml, backend, producto

## Contexto y problema

`DEC-026` reformuló el alcance de Fitnet como producto y, en consecuencia, varias decisiones posteriores asumieron **explotación comercial real**: `DEC-030` eligió proveedor de pagos y dejó como bloqueante la constitución de una entidad legal en Guatemala; `DEC-029` anotó que Vercel Hobby prohíbe el uso comercial y obligaría a migrar de hosting; `DEC-034` descartó los checkpoints preentrenados de reconocimiento de acción esquelética porque sus datos de origen se ceden solo para uso no comercial.

La aclaración del alcance es que **ninguna versión de Fitnet saldrá a la venta**. Es un proyecto de seminario universitario. El modelo de negocio existe como **objeto de estudio**: el trabajo debe incluir análisis de mercado, costos, rentabilidad y proyección, evaluado con el rigor de un proyecto formal. Pero no habrá clientes, ni cobros, ni entidad que facture.

Esto no reduce el alcance funcional: la plataforma debe implementar suscripciones, planes premium y cuota de entrenadores de forma completa y demostrable. Lo que cambia es que el dinero no se mueve.

## Opciones consideradas

1. **Mantener el supuesto comercial y construir contra proveedores reales.** Descartada: exige entidad legal, NIT y cuenta bancaria para algo que nunca cobrará, y bloquea trabajo por un trámite sin propósito.
2. **Eliminar del alcance las funciones de pago.** Descartada: los puntos 7 y 8 del alcance formal son parte del proyecto, y sin ellos el análisis de rentabilidad no tendría soporte técnico que analizar.
3. **Implementar el flujo completo contra un proveedor simulado, y tratar el modelo de negocio como análisis** (elegida).

## Decisión

### 1. Los pagos se implementan completos contra un proveedor simulado

El flujo funciona de extremo a extremo y es demostrable, pero ningún cobro es real.

- Se define un puerto `PaymentProvider` en `packages/domain` con las operaciones que cualquier pasarela necesita: crear sesión de checkout, consultar suscripción, cancelar, y emitir eventos de webhook.
- La implementación de referencia es `MockPaymentProvider`: genera sesiones de checkout ficticias, permite forzar los estados (`active`, `past_due`, `canceled`) desde una pantalla de demostración, y emite eventos con la misma forma que emitiría una pasarela real.
- **Todo lo demás se construye como en producción:** la tabla `subscriptions` la escribe únicamente el manejador de webhooks con clave de servicio, la función SQL `is_premium(uid)` gobierna las políticas de acceso, y el ledger de pagos a entrenadores registra las liquidaciones. Así el trabajo de backend es real y evaluable, y sustituir el proveedor simulado por uno real sería cambiar una implementación del puerto.
- La interfaz debe marcar de forma inequívoca que el pago es simulado, para que nadie introduzca datos de tarjeta reales.

`DEC-030` no se revierte: el estudio comparativo de proveedores sigue siendo válido y pasa a ser **insumo del análisis de rentabilidad**, no una integración a construir. Recurrente queda documentado como el proveedor que se elegiría, con su comisión, para el cálculo de márgenes.

### 2. Cero costos, sin matices

`DEC-026` decía "cero costo mientras no haya ingresos". Como nunca habrá ingresos, la regla vuelve a ser **cero costo**. Todo se construye sobre planes gratuitos: Supabase Free, Vercel Hobby, Kaggle, GitHub Actions, Hugging Face. Cualquier gasto real requiere una decisión propia y aprobación explícita.

Consecuencia directa: **desaparece la obligación de migrar de Vercel Hobby**, que solo existía por la prohibición de uso comercial de ese plan. Tampoco hace falta entidad legal, NIT ni cuenta bancaria.

### 3. Los pesos preentrenados de licencia académica quedan permitidos en el prototipo

El bloqueo de `DEC-034` era el uso comercial. Sin él, los checkpoints preentrenados sobre NTU RGB+D (ST-GCN++, CTR-GCN, HD-GCN, ProtoGCN) pueden usarse: la cesión de ese conjunto de datos contempla exactamente el uso académico y de investigación, que es este caso.

Condiciones de uso:

- El repositorio **no redistribuye** pesos ni datos derivados; se descargan desde su origen en tiempo de entrenamiento y quedan fuera del control de versiones.
- Todo modelo entrenado a partir de esos pesos se marca en `models/manifest.json` con `provenance: "academic-pretrained"` y `commercialUse: false`.
- El registro de cada entrenamiento anota el checkpoint de partida y su licencia.
- La restricción sigue viva para cualquier hipotético producto comercial, y ese costo se cuantifica en el análisis (punto 4).

`DEC-034` se ajusta en consecuencia: la vía de tres fases se conserva, pero la tercera pasa de "entrenar una red de grafos desde cero con miles de repeticiones" a "afinar un backbone preentrenado con cientos", lo que la vuelve alcanzable dentro del seminario. La primera fase se mantiene como piso comparativo y como respaldo en ejecución.

### 4. El análisis de rentabilidad es un entregable del proyecto

Vive **fuera del repositorio**, con el formato que pida el seminario. Debe cubrir costos e infraestructura, precios y punto de equilibrio, proyección a tres años y análisis de mercado y competencia, más los cálculos adicionales que aporte el responsable del proyecto.

El repositorio le provee los insumos técnicos verificables: escalones de precio de cada proveedor y umbrales de migración, costo por usuario activo del asistente de IA según volumen de llamadas, comisión del proveedor de pagos que se habría elegido, y **el costo de comercialización derivado del punto 3**, es decir, lo que costaría reemplazar los pesos académicos por un modelo entrenado desde cero con dataset propio.

## Consecuencias

### Positivas

- Se desbloquea trabajo que dependía de un trámite legal sin propósito en este contexto.
- El núcleo de IA gana un atajo sustancial: afinar un backbone preentrenado exige un orden de magnitud menos de datos que entrenar desde cero, lo que hace demostrable la evaluación de técnica aprendida dentro del plazo del seminario.
- El proyecto no incurre en ningún costo económico.
- La arquitectura de pagos con puerto e implementación intercambiable es buena ingeniería con o sin cobro real, y demuestra la competencia sin mover dinero.

### Negativas

- Hay una brecha deliberada entre el prototipo y el producto proyectado: lo que se demuestra usa pesos que una versión comercial no podría usar. Se gestiona documentándola como costo y riesgo en el análisis, no ocultándola.
- El flujo de pagos no se valida contra una pasarela real, así que quedan sin probar los modos de fallo propios de una integración externa.
- Un lector desprevenido del repositorio podría tomar el proveedor simulado por uno real; de ahí la exigencia de marcarlo en la interfaz y en la documentación.

## Referencias

- `DEC-026` (alcance y reglas duras), `DEC-029` (backend y hosting), `DEC-030` (estudio de proveedores de pago), `DEC-034` (vía de implementación del análisis por IA).
- `docs/PRODUCT.md`, `docs/ML-PIPELINE.md`, `docs/DATA-GOVERNANCE.md`.
- NTU RGB+D, términos de uso académico: https://rose1.ntu.edu.sg/dataset/actionRecognition/
