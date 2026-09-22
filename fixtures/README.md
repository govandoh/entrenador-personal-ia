# Fixtures de landmarks

Secuencias de landmarks de MediaPipe Pose que congelan el comportamiento de los trackers.
Los golden tests (`src/exercises/golden.test.ts`) las reproducen frame a frame, así que
cualquier refactor que cambie el conteo de reps, las transiciones de fase o los eventos de
pico rompe el build.

- Esquema y reglas de validación: [`landmarks/SCHEMA.md`](./landmarks/SCHEMA.md)
- Catálogo: [`landmarks/index.json`](./landmarks/index.json)
- Tipos: [`src/testing/fixtureTypes.ts`](../src/testing/fixtureTypes.ts)

## Fixtures sintéticos

Los diez fixtures actuales son **sintéticos**: se construyen geométricamente colocando los
tres landmarks de cada articulación de modo que `calculateAngle` devuelva exactamente el
ángulo objetivo de cada frame (verificado a ±0.5° dentro del propio generador). Los
landmarks no relevantes quedan en una pose de pie plausible con visibilidad 0.9.

```bash
pnpm fixtures:gen     # regenera fixtures/landmarks/*.json + index.json
pnpm fixtures:check   # falla si los archivos del repo no coinciden con el generador
```

La generación es **determinista**: el ruido usa una semilla fija (mulberry32, `20260919`) y
`recordedAt` es una fecha fija, así que regenerar sobre un árbol limpio no produce diff.
El generador conserva las entradas `source: 'phone'` del índice.

Código: [`scripts/gen-synthetic-fixtures.ts`](../scripts/gen-synthetic-fixtures.ts) (CLI) y
[`src/testing/syntheticFixtures.ts`](../src/testing/syntheticFixtures.ts) (geometría).

## Grabar un fixture real en el celular

1. Abrir la app con el flag de depuración: `https://<host>/?debug=record`
   (preview de Vercel, o `pnpm dev` que ya sirve HTTPS con certificado local).
2. Elegir el ejercicio con los chips y colocarse en la vista deseada.
3. Hacer 5–10 reps con la calidad buscada (buena, corta, ruidosa, con un error guiado).
   El botón rojo de arriba a la derecha muestra los frames acumulados.
4. Tocar **"Guardar grabación (N frames)"**: el navegador descarga el JSON y vacía el
   buffer, listo para la siguiente toma. Cambiar de ejercicio también descarta el buffer.
5. Pasar el archivo a la computadora y moverlo a `fixtures/landmarks/`.

Anotar modelo de celular, navegador, cámara (frontal/trasera), fps y altura de cámara.

### Corregir la meta antes de registrar

La app no puede saber desde qué ángulo se grabó, así que descarga `view: "front"` y
`quality: "good"` como marcador de posición y lo avisa en `meta.notes`. Hay que:

1. Corregir `meta.view` y `meta.quality`.
2. Renombrar el archivo al patrón `<ejercicio>-<vista>-<calidad>-<nn>.json`.
3. Borrar la nota de `meta.notes` y poner una descripción real.
4. Añadir la entrada a `landmarks/index.json` (`source: "phone"`, `frames`, `durationMs`,
   `expected.reps` = las reps que realmente se hicieron).
5. Añadir su test en `src/exercises/golden.test.ts` y revisar el snapshot a ojo: las
   transiciones deben cuadrar con lo que se hizo frente a la cámara. Si no cuadran, el
   fixture está mal grabado — no el tracker.

El flag no tiene coste apreciable fuera de `?debug=record`: sin el parámetro, el loop solo
evalúa un booleano por frame y el botón no se monta.

## Comportamiento observado a revisar

Lo que los golden tests **congelan hoy**. No son bugs que este PR deba arreglar: son
sensibilidades reales del código actual que quedan documentadas para los PRs de refactor
(7 en particular, que cambia los conteos de frames por umbrales de tiempo).

### 1. El evento de fondo/pico depende de los fps

`squat-side-good-01` (60 fps) y `squat-side-good-30fps-01` (30 fps) tienen exactamente la
misma trayectoria angular y ambos cuentan **5 reps**, pero el frame donde se dispara
`atBottom` no es equivalente:

| | 60 fps | 30 fps | en tiempo |
|---|---|---|---|
| primer `atBottom` | frame 90 | frame 43 | 1500 ms vs 1433 ms |
| primera rep | frame 115 | frame 58 | 1917 ms vs 1933 ms |

`RISING_THRESHOLD = 2°` se compara contra el frame anterior, así que a menos fps el ángulo
cambia más por frame y el fondo se confirma ~67 ms antes. Con la mitad de fps la diferencia
todavía no altera el conteo, pero el *feedback de voz* sí llega en otro momento del
movimiento. Lo mismo vale para `MIN_RISING_FRAMES` y `REP_COOLDOWN_FRAMES` en curl y press,
que están expresados en frames asumiendo 60 fps. **El PR 7 lo sustituye por umbrales en
milisegundos** y estos snapshots tendrán que actualizarse con una DEC enlazada.

### 2. Un spike de un frame adelanta la detección del fondo

`squat-side-noisy-01` cuenta las mismas 5 reps que `squat-side-good-01` (el ruido no genera
reps falsas, que es lo que el gate `bottomFired` de DEC-017 protege), pero los frames de
`atBottom` se adelantan hasta 12 frames: `78, 174, 275, 370, 470` frente a
`90, 186, 282, 378, 474`. El spike de +15° del frame 174 basta para cruzar
`RISING_THRESHOLD` y dar el fondo por confirmado antes de tiempo, lo que en la app se
traduce en decir "¡Excelente profundidad!" antes de que el usuario haya llegado abajo.
Un suavizado (One-Euro/EMA) antes del cálculo de ángulos lo resolvería; está previsto en el
`FeatureExtractor` del PR 7.

### 3. Un curl parcial deja al tracker atrapado en `flexed`

`curl-front-partial-01` hace 5 ciclos de 120° → 40° → 120° y cuenta **0 reps**, que es lo
esperado (`MIN_START_ANGLE = 130` descarta el recorrido). Pero el tracker no vuelve nunca a
`extended`, porque esa transición exige superar `EXTENDED_ANGLE = 160` y el fixture se queda
en 120°. Consecuencias congeladas en el snapshot:

- una sola transición de fase en todo el fixture (frame 62, `extended` → `flexed`);
- `atTop` se dispara una sola vez (frame 84) en cinco ciclos, porque `topFired` solo se
  resetea al volver a `extended`;
- 364 frames con feedback `warning` ("Sube un poco más") de forma continua.

En la práctica el usuario ve un mensaje pegado hasta que extiende el brazo del todo. No se
cambia ahora; queda para la revisión de la máquina de estados del curl.

### 4. `squat-side-shallow-01` nunca entra en fase `squatting`

Con el mínimo en 108° (por encima de `BOTTOM_ANGLE = 100`) el tracker permanece en
`standing` los 541 frames, sin transiciones y con feedback `idle` todo el tiempo: 0 reps,
correcto, pero el usuario tampoco recibe el aviso "Baja un poco más", que solo se emite en
fase `squatting`. Una sentadilla sistemáticamente corta no genera ninguna
retroalimentación.

### 5. Curl bilateral y curl lateral dan resultados idénticos

`curl-front-bilateral-01` y `curl-side-left-01` producen exactamente el mismo resumen
(5 reps, mismos frames de pico y de rep). Es el resultado correcto, y confirma que el
cooldown de DEC-022 absorbe el segundo brazo sin alterar el conteo; se deja anotado porque
hace que los dos fixtures no discriminen regresiones en la lógica de `activeArm`, que no
aparece en el resumen del replay.
