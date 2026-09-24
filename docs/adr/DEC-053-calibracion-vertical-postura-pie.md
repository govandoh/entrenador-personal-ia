# DEC-053 · Calibración de la vertical con la postura de pie

- **Estado:** Aceptada en fitnetv2; rige en este repositorio a medida que se integra su código (`DEC-054`)
- **Integración:** paso I-1 (`src/geometry/standingCalibration.ts`)
- **Fecha:** 2026-09-23
- **Decisores:** equipo de fitnetv2 (mismo grupo del proyecto)
- **Etiquetas:** analysis-core
- **Origen:** `ecaldcc/07-FitNet`, `DECISIONS.md`, DEC-043 en la numeración de fitnetv2

> Importada desde fitnetv2 sin cambios de contenido. Las referencias a decisiones dentro del texto se renumeraron (DEC-026..043 de v2 → DEC-036..053 aquí; DEC-001..025 coinciden). Las rutas de archivo son las de fitnetv2; dónde vive cada pieza en este repositorio y qué cambió al integrarla se indica en "Notas de integración".

**Contexto:** En la segunda prueba en celular, con DEC-050 activo y el panel mostrando "Nivelado", el visor 3D seguía mostrando el cuerpo entero inclinado unos 20°. En la imagen de la cámara el usuario estaba derecho, de frente, y el celular parecía vertical. Visto de costado en el visor, el cuerpo era una línea recta inclinada de pies a cabeza.  
**Causa:** No es una inclinación del celular, que el acelerómetro ya corrige, sino un error de profundidad del modelo. Con una sola cámara, la profundidad es lo que peor estima MediaPipe: a una persona de frente suele ubicarle los pies más cerca o más lejos de la cámara que la cabeza, y el esqueleto entero queda rotado como un bloque. El acelerómetro no puede ver ese error. Afecta las mismas medidas que DEC-050: el banco de pruebas muestra avisos falsos de "Pecho arriba" en la sentadilla con 20° de error del modelo.  
**Alternativas consideradas:**  
(a) Subir los umbrales de inclinación de tronco y de arqueo — esconde el error sin corregirlo, y deja de detectar las malas posturas reales.  
(b) Pedirle al usuario una calibración explícita al empezar — funciona, pero agrega un paso cada vez que se abre la cámara.  
(c) Calibración automática con la postura de pie.  
**Decisión:** Opción (c), en `src/pose/standingCalibration.ts`. De pie y con las piernas estiradas, el eje de tobillos a hombros es vertical en la realidad. Cuando la persona está así, se mide cuánto se desvía ese eje en lo que estima el modelo, se suaviza, y se descuenta de todos los cuadros siguientes. Pasa sola al comienzo de cada serie de sentadillas y entre repeticiones.  
**Condiciones para aprender:** hombros, caderas, rodillas y tobillos visibles con 0.6 o más; rodillas por encima de 160°; ángulo hombro-cadera-rodilla por encima de 155°; y desviación menor a 35°. En el fondo de una sentadilla, o con la espalda arqueada, no se actualiza. Así la inclinación del tronco se sigue midiendo, contra la postura de pie de la misma persona frente a la misma cámara.  
**Orden en el procesamiento:** filtro de temblor, acelerómetro, calibración, trackers. La calibración aprende sobre el esqueleto ya nivelado por el sensor, así que captura solo el error del modelo y sigue valiendo si después se mueve el celular. Se reinicia al cambiar de cámara.  
**Diagnóstico en pantalla:** El panel 3D muestra "Calibrado" y cuántos grados corrige del modelo y del celular. Sirve para saber que está activa, y para distinguir las dos fuentes si una prueba vuelve a mostrar el cuerpo inclinado. Sin calibración, indica cómo lograrla: pararse derecho, de cuerpo entero.  
**Limitación:** Necesita los tobillos a la vista. En curl y press con encuadre de medio cuerpo solo se aplica el acelerómetro.  
**Error relacionado, corregido en el mismo cambio:** La captura de la prueba mostraba "Baja un poco más" con el usuario casi de pie. En la sentadilla, la fase "abajo" dura hasta que la rodilla supera 160°, y durante toda la subida, entre 90° y 160°, se pedía bajar más. Venía del código original. Ahora, después del fondo, el mensaje evalúa la profundidad que se alcanzó. La voz, que decía lo mismo justo al empezar a subir, ahora dice "La próxima, baja un poco más".  
**Verificado:** 10 pruebas nuevas en el banco, 60 de 60 en total. La calibración mide los 20° de error del modelo con menos de 3° de desvío y se mantiene estable durante cinco repeticiones. Elimina los avisos falsos de espalda sin perder repeticiones y no aprende de posturas que no son de pie. Con celular y modelo inclinados a la vez, deja el tronco a menos de 1° de la verdad. Durante la subida ya no se pide bajar más. **No verificado todavía:** con movimientos reales en el celular.

## Notas de integración

Se añadió `setLearning(enabled)`. Una hiperextensión de hasta ~25° pasa el test de cadera estirada, así que durante el press la calibración absorbería un arqueo moderado en ~1 s; el pipeline debe congelar el aprendizaje mientras dura el ejercicio (I-2).
