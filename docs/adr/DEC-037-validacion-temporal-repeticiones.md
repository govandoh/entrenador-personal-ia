# DEC-037 · Validación temporal de repeticiones

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-1 (`src/analysis/movementQuality.ts`)
- **Fecha:** 2026-09-19
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** analysis-core
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-027 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** El criterio de conteo era puramente posicional: si el ángulo cruzaba dos umbrales en secuencia, la repetición contaba. Ese criterio no distingue una sentadilla real de un tirón brusco, de un movimiento de ajuste o de un salto de landmarks de MediaPipe. Por eso "cualquier movimiento" sumaba repeticiones, que era la queja principal del usuario junto con la imprecisión de DEC-036.  
**Decisión:** Agregar `src/analysis/movementQuality.ts` con la clase `MovementAnalyzer`, que acumula muestras de ángulo con marca de tiempo y evalúa cada ciclo antes de aceptarlo. Una repetición legítima debe cumplir cuatro condiciones a la vez: recorrido angular mínimo, duración mínima, duración máxima y continuidad del recorrido. Un artefacto no cumple las cuatro.  
**Umbrales por ejercicio:** Cada tracker ajusta los valores a la cadencia natural de su movimiento. La sentadilla exige 40° de recorrido y 800 ms; el curl 50° y 700 ms; el press 45° y 700 ms.  
**Criterio de calibración:** Los umbrales se eligieron deliberadamente permisivos. Es preferible dejar pasar alguna repetición dudosa a rechazar repeticiones legítimas de alguien que entrena lento o con pausa, porque el segundo error destruye la confianza en la aplicación mientras que el primero solo la degrada.  
**Medición de suavidad:** Se cuentan las inversiones de signo de la velocidad angular, no la magnitud del jerk. Una repetición real tiene dos fases y por lo tanto un solo cambio de dirección significativo; un movimiento errático produce muchos. Contar inversiones es más robusto frente al ruido de MediaPipe porque no se deja arrastrar por un único cuadro atípico con derivada enorme. Se aplica un piso de ruido para que el temblor del modelo no cuente como inversión.  
**Retroalimentación al usuario:** Cuando una repetición se descarta, el motivo se informa por texto y por voz. Sin ese aviso el usuario concluye que la aplicación falló, en vez de entender que el movimiento no fue válido.
**Actualización 2026-09-22:** La medición de suavidad descrita arriba rechazaba todas las repeticiones con el temblor normal de MediaPipe. Se reemplazó por conteo de cambios de dirección con histéresis, y se agregó una duración mínima de la fase de esfuerzo. Ver DEC-045.

## Notas de integración

El historial (`MAX_SAMPLES = 1200` muestras) y `currentVelocity` (5 muestras) pasaron a milisegundos (20 000 ms y 100 ms) para no depender de los fps, según la convención de umbrales temporales en ms. Los mensajes al usuario salieron a `src/analysis/messages.ts`.
