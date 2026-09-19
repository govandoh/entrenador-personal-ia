---
name: fixture
description: Guía paso a paso para grabar una secuencia de landmarks en el celular con `?debug=record`, nombrarla, validar el esquema JSON v1, registrarla en `fixtures/index.json` y crear su test golden. Úsala cuando haya que congelar un comportamiento antes de refactorizar, cubrir un ejercicio/vista nuevo o reproducir un bug reportado desde un dispositivo.
---

# /fixture — grabar y registrar un fixture de landmarks

Un fixture es la unidad de verdad compartida entre TS y Python: mismo archivo, mismo resultado.
Contiene **solo landmarks**, nunca imágenes ni video.

## 1. Grabar en el celular
1. Abrir la app (preview de Vercel o `pnpm dev` con HTTPS local) con el flag:
   `https://<host>/?debug=record`.
2. Elegir el ejercicio, colocarse en la vista deseada (lateral / frontal / 45°) y ejecutar
   5–10 reps con la calidad buscada (buena, corta, ruidosa, con error guiado).
3. Tocar "Detener grabación": el navegador descarga un `.json` con `{ meta, frames[] }`.
4. Pasar el archivo a la computadora (AirDrop, cable, Drive) y moverlo a `fixtures/landmarks/`.

Anotar: modelo de celular, navegador, cámara (frontal/trasera), fps aproximados, altura de cámara.

## 2. Nombrar
`fixtures/landmarks/<ejercicio>-<vista>-<calidad>-<nn>.json`
- ejercicio: `squat` | `curl` | `press` | (nuevos: en inglés, singular)
- vista: `lateral` | `frontal` | `diag45`
- calidad: `good` | `shallow` | `partial` | `noisy` | `fast` | `<error-code>` (ej. `knee-valgus`)
- nn: correlativo de dos dígitos por combinación (`01`, `02`…)

Ejemplo: `fixtures/landmarks/squat-lateral-good-01.json`.

## 3. Validar el esquema JSON v1
```
{
  "meta": {
    "schemaVersion": 1, "exercise": "squat", "view": "lateral", "quality": "good",
    "device": "Pixel 7 / Chrome 128", "camera": "environment", "recordedAt": "AAAA-MM-DD",
    "fpsApprox": 30, "expected": { "reps": 8 }, "consentId": "<id o 'internal'>"
  },
  "frames": [
    { "t": 0,  "image": [ {"x","y","z","visibility"} × 33 ], "world": [ {"x","y","z","visibility"} × 33 ] },
    ...
  ]
}
```
Comprobar con el script del repo (o a mano si aún no existe):
- `meta.schemaVersion === 1`; `frames.length ≥ 60`; `t` estrictamente creciente en ms.
- Cada frame tiene `image` y `world` con exactamente 33 puntos; valores numéricos finitos.
- Ninguna clave `video`, `imageData`, `blob` ni similares.
- Tamaño razonable (< 2 MB); si es mayor, recortar al tramo con las reps.

## 4. Registrar en el índice
Añadir entrada en `fixtures/index.json`:
```
{ "file": "landmarks/squat-lateral-good-01.json", "exercise": "squat", "view": "lateral",
  "quality": "good", "expectedReps": 8, "notes": "Pixel 7, 30 fps, cámara a 1 m" }
```

## 5. Crear el test golden
Junto al tracker correspondiente (`src/exercises/squat.test.ts` hoy;
`packages/analysis-core/src/trackers/squat.test.ts` en el objetivo):
```ts
it('reproduce squat-lateral-good-01', () => {
  const out = replayFixture('squat-lateral-good-01', new SquatTracker())
  expect(out.reps).toBe(8)
  expect(out).toMatchSnapshot() // { reps, transiciones, frames de pico }
})
```
Correr `pnpm test` para generar el snapshot y revisarlo a ojo: las transiciones deben tener
sentido con lo que se hizo frente a la cámara. Si no, el fixture está mal grabado, no el tracker.

## Salida esperada
- Archivo en `fixtures/landmarks/`, entrada en `fixtures/index.json`, test con snapshot.
- Commit sugerido: `test(fixtures): agregar <nombre> y golden de <Tracker>`.
- Recordatorio: cambiar un golden existente exige DEC enlazada (`/adr`).
