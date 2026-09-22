/**
 * Grabación de fixtures de landmarks desde la app (`?debug=record`).
 *
 * Toda la lógica del modo grabación vive aquí para que `CameraView` solo tenga que
 * acumular frames y pintar un botón. Fuera del flag nada de esto se ejecuta.
 *
 * El archivo descargado cumple el esquema v1 (ver `fixtures/landmarks/SCHEMA.md`) salvo
 * por `meta.view` y `meta.quality`, que la app no puede saber: se descargan con un valor
 * por defecto y hay que corregirlos a mano antes de registrar el fixture
 * (ver `fixtures/README.md`).
 */

import {
  FIXTURE_SCHEMA_VERSION,
  fixtureFileName,
  type FixtureExercise,
  type FixtureFrame,
  type FixtureLandmark,
  type LandmarkFixture,
} from './fixtureTypes';

/** ¿La URL pide el modo grabación? Se evalúa una sola vez al cargar el módulo. */
export const RECORD_MODE: boolean = (() => {
  try {
    return new URLSearchParams(window.location.search).get('debug') === 'record';
  } catch {
    return false;
  }
})();

/** Forma mínima común a `NormalizedLandmark` y `Landmark` de MediaPipe. */
interface LandmarkLike {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

const DECIMALS = 4;

function round(n: number): number {
  const f = 10 ** DECIMALS;
  return Math.round(n * f) / f;
}

/**
 * Copia los landmarks a objetos planos redondeados: evita quedarse con referencias que
 * MediaPipe pueda reutilizar entre frames y reduce mucho el tamaño del JSON.
 */
function snapshot(landmarks: readonly LandmarkLike[]): FixtureLandmark[] {
  return landmarks.map(p => ({
    x: round(p.x),
    y: round(p.y),
    z: round(p.z),
    visibility: round(p.visibility ?? 0),
  }));
}

/** Frame acumulado en memoria: `t` es `performance.now()` crudo. */
export interface RecordedFrame extends FixtureFrame {
  t: number;
}

export function captureFrame(
  t: number,
  image: readonly LandmarkLike[],
  world: readonly LandmarkLike[] | null,
): RecordedFrame {
  return {
    t,
    image: snapshot(image),
    ...(world ? { world: snapshot(world) } : {}),
  };
}

/** fps medio de la grabación (0 si no hay suficientes frames). */
export function estimateFps(frames: readonly RecordedFrame[]): number {
  if (frames.length < 2) return 0;
  const elapsedMs = frames[frames.length - 1].t - frames[0].t;
  if (elapsedMs <= 0) return 0;
  return Math.round(((frames.length - 1) / (elapsedMs / 1000)) * 10) / 10;
}

/**
 * Construye el fixture v1: normaliza `t` a milisegundos desde el primer frame
 * (el esquema pide `t` relativo y estrictamente creciente).
 */
export function buildFixture(exercise: FixtureExercise, frames: readonly RecordedFrame[]): LandmarkFixture {
  const t0 = frames.length > 0 ? frames[0].t : 0;
  return {
    meta: {
      schemaVersion: FIXTURE_SCHEMA_VERSION,
      exercise,
      // La app no sabe desde qué ángulo ni con qué calidad se grabó: corregir a mano.
      view:       'front',
      quality:    'good',
      source:     'phone',
      device:     navigator.userAgent,
      fps:        estimateFps(frames),
      recordedAt: new Date().toISOString(),
      notes:      'Grabado con ?debug=record. Revisar view/quality y renombrar el archivo antes de registrarlo en index.json.',
    },
    frames: frames.map(f => ({ ...f, t: Math.round((f.t - t0) * 1000) / 1000 })),
  };
}

/** Serializa con un frame por línea (mismo formato que el generador sintético). */
export function serializeFixture(fixture: LandmarkFixture): string {
  const frames = fixture.frames.map(fr => JSON.stringify(fr)).join(',\n');
  return `{\n"meta": ${JSON.stringify(fixture.meta, null, 2)},\n"frames": [\n${frames}\n]\n}\n`;
}

/** Dispara la descarga del fixture en el navegador. */
export function downloadFixture(exercise: FixtureExercise, frames: readonly RecordedFrame[]): void {
  const fixture = buildFixture(exercise, frames);
  const blob    = new Blob([serializeFixture(fixture)], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href     = url;
  a.download = fixtureFileName(fixture.meta, 1);
  a.click();
  URL.revokeObjectURL(url);
}
