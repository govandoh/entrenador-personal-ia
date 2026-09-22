# Esquema de fixtures de landmarks — v1

Un **fixture** es una secuencia de landmarks de MediaPipe Pose guardada como JSON. Es la
unidad de verdad compartida entre los tests de TypeScript y (más adelante) el pipeline de
Python: mismo archivo, mismo resultado.

Contiene **solo landmarks**. Nunca imágenes, frames de video ni audio.

El tipo TypeScript vive en [`src/testing/fixtureTypes.ts`](../../src/testing/fixtureTypes.ts)
y es la fuente de verdad; este documento lo explica.

## Nombre de archivo

```
fixtures/landmarks/<ejercicio>-<vista>-<calidad>-<nn>.json
```

| Parte | Valores |
|---|---|
| `ejercicio` | `squat` \| `curl` \| `press` (nuevos: en inglés, singular) |
| `vista` | `side` \| `front` \| `45` |
| `calidad` | `good`, `shallow`, `noisy`, `good-30fps`, `bilateral`, `alternating`, `left`, `right`, `partial`, `lowelbow`, o un código de error (`knee-valgus`) |
| `nn` | correlativo de dos dígitos por combinación: `01`, `02`… |

Ejemplo: `squat-side-good-01.json`.

El patrón lo valida `FIXTURE_FILENAME_RE` y lo construye `fixtureFileName()`.

## Estructura

```jsonc
{
  "meta": {
    "schemaVersion": 1,
    "exercise":   "squat",        // 'squat' | 'curl' | 'press'
    "view":       "side",         // 'side' | 'front' | '45'
    "quality":    "good",         // ver tabla de arriba
    "source":     "synthetic",    // 'synthetic' | 'phone'
    "device":     "Mozilla/5.0…", // navigator.userAgent — solo source: 'phone'
    "fps":        60,             // nominales (sintético) o estimados (celular)
    "recordedAt": "2026-09-19T00:00:00.000Z",  // ISO-8601
    "notes":      "Rodilla 172°→82°→172°, 5 reps…"
  },
  "frames": [
    {
      "t": 0,                     // ms desde el PRIMER frame, estrictamente creciente
      "image": [ /* 33 × { x, y, z, visibility } */ ],
      "world": [ /* 33 × { x, y, z, visibility } — opcional */ ]
    }
  ]
}
```

### `image` — obligatorio

`result.landmarks[0]` de MediaPipe: 33 puntos normalizados al tamaño de la imagen.
`x` e `y` van de 0 a 1 (`y` crece hacia abajo), `z` es profundidad relativa a la cadera en
la misma escala que `x`, `visibility` es la confianza 0–1. Es lo que consumen los trackers.

### `world` — opcional

`result.worldLandmarks[0]`: los mismos 33 puntos en **metros**, con origen en el centro de
la cadera. Los trackers actuales no los usan; se graban porque el análisis 3D (velocidad,
fatiga) los necesitará. Los fixtures sintéticos **no** los incluyen: se construyen en el
espacio normalizado y un `world` inventado no aportaría nada.

### Orden de los 33 landmarks

El de MediaPipe Pose (`0` nariz … `32` índice del pie derecho). Los índices usados por los
trackers están en `src/testing/syntheticFixtures.ts` (`LM`).

## Índice

[`index.json`](./index.json) lista todos los fixtures con sus metadatos y el resultado
esperado por diseño:

```jsonc
{
  "schemaVersion": 1,
  "fixtures": [
    {
      "file": "squat-side-good-01.json",
      "exercise": "squat", "view": "side", "quality": "good", "source": "synthetic",
      "fps": 60, "frames": 541, "durationMs": 9000,
      "expected": { "reps": 5 },
      "notes": "…"
    }
  ]
}
```

`expected` describe lo que el fixture **pretende** provocar, no necesariamente lo que hace
el código actual. Cuando difieren, manda el snapshot golden y la discrepancia se anota en
[`../README.md`](../README.md).

## Reglas de validación

Las comprueba `src/exercises/golden.test.ts`:

- `meta.schemaVersion === 1` y `meta.fps > 0`; `recordedAt` parseable.
- `frames.length >= 60`.
- `t` finito y **estrictamente creciente**.
- `image` (y `world` si está) con exactamente **33** puntos; `x`/`y`/`z` finitos y
  `visibility` en `[0, 1]`.
- Ninguna clave `video`, `imageData`, `blob` ni `frameData`.
- Todo archivo de `fixtures/landmarks/` está en `index.json` y su `meta` coincide con la
  entrada del índice.

Tamaño orientativo: < 2 MB por archivo. Si una grabación real se pasa, recortarla al tramo
con las reps.

## Divergencias con la skill `/fixture`

La skill `.claude/skills/fixture/SKILL.md` se escribió en paralelo a este PR y describe
algunos campos distintos. Esta implementación sigue el esquema aprobado en el plan
(Parte 2.3, PR 1). Equivalencias:

| Skill `/fixture` | Esquema v1 implementado |
|---|---|
| `view: lateral \| frontal \| diag45` | `view: side \| front \| 45` |
| `fpsApprox` | `fps` |
| `recordedAt: AAAA-MM-DD` | `recordedAt`: ISO-8601 completo |
| `meta.expected` | `expected` en la entrada de `index.json` |
| `meta.camera`, `meta.consentId` | no existen todavía (llegan con el modo captura, PR 8) |
| índice en `fixtures/index.json` | índice en `fixtures/landmarks/index.json` |
| `world` obligatorio | `world` opcional (ausente en fixtures sintéticos) |

Hay que unificar ambos documentos antes del PR 8; queda anotado en el PR.
