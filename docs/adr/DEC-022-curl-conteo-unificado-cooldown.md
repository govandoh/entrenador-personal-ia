# DEC-022 · Curl de bíceps: conteo unificado con cooldown (sin conteo por brazo)

- **Estado:** Aceptada
- **Fecha:** 2026-05-15
- **Decisores:** Equipo MVP IA26
- **Etiquetas:** analysis-core, curl

## Contexto y problema

El diseño original de `BicepCurlTracker` mantenía un contador de reps independiente en cada `ArmTracker` (`left.reps + right.reps`). En vista frontal con curls bilaterales (ambos brazos simultáneos), cada brazo completaba su ciclo y ambos contadores incrementaban, resultando en el doble de reps reales. Sin un modelo de IA que clasifique automáticamente si el ejercicio es unilateral o bilateral, no es posible distinguir el caso sin introducir heurísticas adicionales frágiles.

## Opciones consideradas

1. **Pedir al usuario que seleccione el modo (unilateral / bilateral)** — agrega fricción en la UI y requiere que el usuario entienda la distinción.
2. **Detectar el modo automáticamente por correlación temporal entre ambos brazos** — requiere buffer de historial de ángulos y lógica de correlación, complejidad desproporcionada al alcance.
3. **Conteo unificado en `BicepCurlTracker` con OR logic + cooldown de frames** (elegida) — simple, determinista, cubre los dos casos sin intervención del usuario.

## Decisión

Opción (c). `ArmTracker` ya no mantiene contador propio; emite `repCompleted: boolean` cuando su ciclo cumple todos los gates. `BicepCurlTracker` tiene el único contador `reps` y lo incrementa cuando `leftRes.repCompleted || rightRes.repCompleted` con `repCooldown === 0`. Tras contar, activa un cooldown de **15 frames (~250 ms a 60 fps)**. El cooldown absorbe la señal del segundo brazo en curls bilaterales (llega en 0-50 ms) sin bloquear curls alternos donde el segundo brazo dispara típicamente >500 ms después.

### Comportamiento resultante

- Curl bilateral (barra o mancuernas simultáneas): 1 rep por ciclo.
- Curl alterno (mancuernas, un brazo después del otro): 1 rep por brazo → 2 reps por ciclo completo.
- Vista lateral (un solo brazo visible): 1 rep por ciclo, igual que antes.

## Consecuencias

### Positivas

- Elimina el conteo duplicado en curls bilaterales sin intervención del usuario.
- Solución simple y determinista; no requiere buffer de historial ni lógica de correlación.
- Sigue contando correctamente curls alternos (1 rep por brazo) y vista lateral (1 rep por ciclo).
- El patrón queda documentado y es reutilizable en otros ejercicios bilaterales (aplicado en `DEC-023`).

### Negativas

- Trade-off aceptado: en curls alternos muy rápidos (<250 ms entre brazos), el cooldown podría suprimir el segundo brazo. A 60 fps y con la cadencia normal de un curl (>500 ms por brazo), este caso no debería ocurrir en condiciones reales de entrenamiento.
- El cooldown está expresado en frames (`REP_COOLDOWN_FRAMES = 15`) y asume 60 fps; en dispositivos a 30 fps equivale a ~500 ms. Pendiente de migrar a tiempo real (ver `DEC-027` y `ARCHITECTURE.md`).

## Referencias

- `DEC-015` (diseño original del curl con suma de contadores por `ArmTracker`).
- `DEC-017` (gates que debe cumplir el ciclo antes de emitir `repCompleted`).
- `DEC-023` (mismo patrón aplicado al press de hombro).
- `DEC-027` (migración pendiente del cooldown a tiempo real).
- `ARCHITECTURE.md`
- `src/exercises/bicepCurl.ts`
