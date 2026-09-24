/**
 * Grabación de fixtures de landmarks desde la app (`?debug=record`).
 *
 * Toda la lógica del modo grabación vive aquí para que `CameraView` solo tenga que
 * acumular frames y pintar un botón. Fuera del flag nada de esto se ejecuta.
 *
 * El archivo descargado cumple el esquema v1 (ver `fixtures/landmarks/SCHEMA.md`).
 *
 * Protocolo de grabación por guion (DEC-055): la toma se declara en la URL antes de grabar,
 * `?debug=record&cond=knee_valgus&view=side&subject=s01`. `cond` es `correct` o un código de
 * `docs/METRICS.md` §5.2 y pasa a ser la calidad del archivo; `view` y `subject` van a los
 * metadatos. Sin esos parámetros, `view` y `quality` salen con valores por defecto y hay
 * que corregirlos a mano antes de registrar el fixture (ver `fixtures/README.md`).
 */

import {
  FIXTURE_SCHEMA_VERSION,
  FORM_ERROR_QUALITIES,
  fixtureFileName,
  type FixtureCapture,
  type FixtureExercise,
  type FixtureQuality,
  type FixtureView,
  type FixtureFrame,
  type FixtureLandmark,
  type LandmarkFixture,
} from './fixtureTypes.ts';

/** ¿La URL pide el modo grabación? Se evalúa una sola vez al cargar el módulo. */
export const RECORD_MODE: boolean = (() => {
  try {
    return new URLSearchParams(window.location.search).get('debug') === 'record';
  } catch {
    return false;
  }
})();

/** Toma declarada en la URL (protocolo por guion). */
export interface RecordScript {
  /** `correct` o código de METRICS §5.2 en snake_case, tal como se escribió en la URL. */
  condition: string | null;
  view: FixtureView | null;
  subjectId: string | null;
}

const VIEWS: readonly FixtureView[] = ['side', 'front', '45'];

/** Lee `cond`, `view` y `subject` de una query string. Valores desconocidos se ignoran. */
export function parseRecordScript(search: string): RecordScript {
  const q = new URLSearchParams(search);
  const cond = q.get('cond')?.trim().toLowerCase() || null;
  const view = q.get('view') as FixtureView | null;
  const subject = q.get('subject')?.trim() || null;
  return {
    condition: cond,
    view: view && VIEWS.includes(view) ? view : null,
    // Solo identificadores anónimos cortos: nunca nombres (docs/DATA-GOVERNANCE.md).
    subjectId: subject && /^[a-z0-9-]{1,16}$/i.test(subject) ? subject : null,
  };
}

/** Calidad del archivo según la condición: `good` para `correct`, el código en kebab-case si es un error conocido. */
export function qualityForCondition(condition: string | null): FixtureQuality | null {
  if (!condition) return null;
  if (condition === 'correct' || condition === 'good') return 'good';
  const kebab = condition.replace(/_/g, '-');
  return (FORM_ERROR_QUALITIES as readonly string[]).includes(kebab) ? (kebab as FixtureQuality) : null;
}

export const RECORD_SCRIPT: RecordScript = (() => {
  try {
    return parseRecordScript(window.location.search);
  } catch {
    return { condition: null, view: null, subjectId: null };
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
  down: { x: number; y: number; z: number } | null = null,
): RecordedFrame {
  return {
    t,
    image: snapshot(image),
    ...(world ? { world: snapshot(world) } : {}),
    ...(down ? { down: [round(down.x), round(down.y), round(down.z)] as [number, number, number] } : {}),
  };
}

/** Datos de la toma que no salen de los frames. */
export interface RecordingContext {
  script: RecordScript;
  engine: '2d' | '3d';
  calibrationDeg?: number | null;
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
export function buildFixture(
  exercise: FixtureExercise,
  frames: readonly RecordedFrame[],
  ctx: RecordingContext = { script: { condition: null, view: null, subjectId: null }, engine: '2d' },
): LandmarkFixture {
  const t0 = frames.length > 0 ? frames[0].t : 0;
  const { script } = ctx;
  const quality = qualityForCondition(script.condition);
  const scripted = quality !== null && script.view !== null;
  const capture: FixtureCapture = {
    engine: ctx.engine,
    ...(script.condition ? { condition: script.condition } : {}),
    ...(script.subjectId ? { subjectId: script.subjectId } : {}),
    ...(ctx.calibrationDeg !== undefined ? { calibrationDeg: ctx.calibrationDeg } : {}),
  };
  return {
    meta: {
      schemaVersion: FIXTURE_SCHEMA_VERSION,
      exercise,
      // Sin guion en la URL la app no sabe la vista ni la calidad: corregir a mano.
      view:       script.view ?? 'front',
      quality:    quality ?? 'good',
      source:     'phone',
      device:     navigator.userAgent,
      fps:        estimateFps(frames),
      recordedAt: new Date().toISOString(),
      notes:      scripted
        ? 'Grabado con el protocolo por guion (?debug=record&cond=…&view=…).'
        : 'Grabado con ?debug=record. Revisar view/quality y renombrar el archivo antes de registrarlo en index.json.',
      capture,
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
export function downloadFixture(
  exercise: FixtureExercise,
  frames: readonly RecordedFrame[],
  ctx?: RecordingContext,
): void {
  const fixture = buildFixture(exercise, frames, ctx);
  const blob    = new Blob([serializeFixture(fixture)], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href     = url;
  a.download = fixtureFileName(fixture.meta, 1);
  a.click();
  URL.revokeObjectURL(url);
}
