---
name: fixture
description: Guía paso a paso para grabar una secuencia de landmarks en el celular con `?debug=record`, nombrarla, validar el esquema JSON v1, registrarla en `fixtures/landmarks/index.json` y crear su test golden. Úsala cuando haya que congelar un comportamiento antes de refactorizar, cubrir un ejercicio/vista nuevo o reproducir un bug reportado desde un dispositivo.
---

# /fixture — grabar y registrar un fixture de landmarks

Un fixture es la unidad de verdad compartida entre TS y Python: mismo archivo, mismo resultado.
Contiene **solo landmarks**, nunca imágenes ni video.

La fuente de verdad del esquema es `src/testing/fixtureTypes.ts`, explicada en
`fixtures/landmarks/SCHEMA.md`. Si esta guía y ese archivo no coinciden, manda el archivo.

## 1. Grabar en el celular
1. Abrir la app (preview de Vercel o `pnpm dev` con HTTPS local) con el flag:
   `https://<host>/?debug=record`.
2. Elegir el ejercicio con los chips, colocarse en la vista deseada (`side` / `front` / `45`)
   y ejecutar 5–10 reps con la calidad buscada (buena, corta, ruidosa, con error guiado).
3. Tocar **"Guardar grabación (N frames)"**: el navegador descarga el `.json` y vacía el
   buffer, listo para la siguiente toma. Cambiar de ejercicio también descarta el buffer.
4. Pasar el archivo a la computadora (AirDrop, cable, Drive) y moverlo a `fixtures/landmarks/`.

Anotar: modelo de celular, navegador, cámara (frontal/trasera), fps aproximados, altura de cámara.

## 2. Corregir la meta y nombrar
La app no sabe desde qué ángulo se grabó: descarga `view: "front"` y `quality: "good"` como
marcador de posición y lo avisa en `meta.notes`. Corregir `meta.view`, `meta.quality` y
`meta.notes` antes de registrar.

`fixtures/landmarks/<ejercicio>-<vista>-<calidad>-<nn>.json`
- ejercicio: `squat` | `curl` | `press` | (nuevos: en inglés, singular)
- vista: `side` | `front` | `45`
- calidad: `good` | `shallow` | `partial` | `noisy` | `bilateral` | `alternating` | `left` |
  `right` | `lowelbow` | `<error-code>` (ej. `knee-valgus`)
- nn: correlativo de dos dígitos por combinación (`01`, `02`…)

Ejemplo: `fixtures/landmarks/squat-side-good-01.json`. El patrón lo valida
`FIXTURE_FILENAME_RE` y lo construye `fixtureFileName()` en `src/testing/fixtureTypes.ts`.

## 3. Validar el esquema JSON v1
```jsonc
{
  "meta": {
    "schemaVersion": 1,
    "exercise": "squat",          // 'squat' | 'curl' | 'press'
    "view": "side",               // 'side' | 'front' | '45'
    "quality": "good",
    "source": "phone",            // 'synthetic' | 'phone'
    "device": "Mozilla/5.0…",     // navigator.userAgent — solo source: 'phone'
    "fps": 30,                    // estimados al grabar
    "recordedAt": "2026-10-01T15:04:05.000Z",
    "notes": "Pixel 7, cámara a 1 m, 8 reps"
  },
  "frames": [
    { "t": 0, "image": [ /* 33 × {x,y,z,visibility} */ ], "world": [ /* 33 × {…} */ ] }
  ]
}
```
Comprobar:
- `meta.schemaVersion === 1`; `frames.length ≥ 60`; `t` estrictamente creciente en ms.
- Cada frame tiene `image` con exactamente 33 puntos y valores numéricos finitos
  (`world` es opcional pero deseable: lo necesita el análisis 3D).
- Ninguna clave `video`, `imageData`, `blob` ni similares.
- Tamaño razonable (< 2 MB); si es mayor, recortar al tramo con las reps.

El dataset de entrenamiento usa un esquema **v2** que extiende este con `labels[]`,
`consentId`, `subjectId` y `rpe` (`docs/ML-PIPELINE.md` §2). Un fixture v1 es un v2 sin
etiquetas: no mezclar ambos en el mismo archivo.

## 4. Registrar en el índice
Añadir entrada en `fixtures/landmarks/index.json` respetando el formato de las existentes
(`file`, `exercise`, `view`, `quality`, `source`, `frames`, `durationMs`, `expected.reps`,
`notes`). Correr `pnpm fixtures:check` para confirmar que el índice y los archivos cuadran.

## 5. Crear el test golden
En `src/exercises/golden.test.ts` (objetivo: `packages/analysis-core/src/trackers/`):
```ts
it('reproduce squat-side-good-01', () => {
  const out = replayFixture('squat-side-good-01', new SquatTracker())
  expect(out.reps).toBe(8)
  expect(out).toMatchSnapshot() // { reps, transiciones, frames de pico }
})
```
Correr `pnpm test` para generar el snapshot y revisarlo a ojo: las transiciones deben tener
sentido con lo que se hizo frente a la cámara. Si no, el fixture está mal grabado, no el tracker.

## Salida esperada
- Archivo en `fixtures/landmarks/`, entrada en `fixtures/landmarks/index.json`, test con snapshot.
- `pnpm check` en verde.
- Commit sugerido: `test(fixtures): agregar <nombre> y golden de <Tracker>`.
- Recordatorio: cambiar un golden existente exige DEC enlazada (`/adr`).
