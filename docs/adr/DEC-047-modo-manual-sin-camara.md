# DEC-047 · Modo manual para los ejercicios sin cámara

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-4
- **Fecha:** 2026-09-22
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** ui, dominio
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-037 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** De los 60 ejercicios del catálogo, 57 se podían agregar a una rutina pero no ejecutar: no existía contador manual ni temporizador. En la pantalla de inicio figuraban con una etiqueta "Manual" que no llevaba a ninguna parte.  
**Decisión:** Pantalla de entrenamiento manual en `/manual`, con contador de repeticiones de botones grandes, temporizador circular para los ejercicios por tiempo, cronómetro de descanso, y registro en el historial para que cuente en el perfil y los logros. Una sola función, `startPath`, decide si un ejercicio va a la cámara o al modo manual, para que ningún botón pueda mandar un ejercicio al lugar equivocado.  
**Lógica en un reductor puro:** `src/routines/manualWorkout.ts`. El tiempo nunca se lee adentro: llega en cada acción. Eso lo hace determinista y comprobable sin relojes reales.  
**Métodos de entrenamiento:**  
- Rest-pause: tras la serie principal, mini-series con 15 s de descanso entre ellas; todo suma en una sola serie.  
- Dropset: tras la serie principal, descensos de carga sin descanso, con la indicación de bajar entre 20 y 30 %.  
- Superserie: sin descanso tras la serie, con la indicación de pasar al ejercicio pareado.  
**Limitación declarada de la superserie:** La app indica alternar, pero no encadena los dos ejercicios en una misma pantalla, y el editor todavía no permite elegir con qué ejercicio se empareja. El campo `supersetWith` existe en el modelo pero no tiene interfaz.  
**Pantalla encendida:** Se pide `navigator.wakeLock` durante el entrenamiento y se vuelve a pedir al regresar a primer plano. Sin esto, el celular se bloquea en medio de un descanso de 90 segundos. Si el navegador no lo soporta, la app funciona igual.  
**Relojes:** Basados en marcas de tiempo de fin, no en contadores que se decrementan. Un intervalo puede atrasarse o frenarse en segundo plano; la resta contra la hora real no.  
**Terminar antes:** Lo hecho en la serie en curso se guarda. Salir con trabajo hecho lleva al resumen en vez de perderlo.

## Notas de integración

El reductor `manualWorkout.ts` es puro y se integra con tests Vitest.
