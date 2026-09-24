/**
 * Esquema v1 de fixtures de landmarks (ver fixtures/landmarks/SCHEMA.md).
 *
 * Un fixture es una secuencia de frames de MediaPipe Pose (33 landmarks) grabada en
 * celular (`source: 'phone'`) o construida geométricamente (`source: 'synthetic'`).
 * Los golden tests reproducen estas secuencias contra los trackers para congelar su
 * comportamiento antes de refactorizar (plan Fitnet, PR 1).
 *
 * Este tipo no importa nada de `@mediapipe/tasks-vision`: `FixtureLandmark` es
 * estructuralmente compatible con `NormalizedLandmark` y `Landmark` (misma forma
 * `{ x, y, z, visibility }`), así que un `FixtureFrame.image` se puede pasar tal cual
 * a `tracker.update(...)`.
 */

export const FIXTURE_SCHEMA_VERSION = 1 as const;

/** Número de landmarks que emite MediaPipe Pose por persona. */
export const POSE_LANDMARK_COUNT = 33;

export type FixtureExercise = 'squat' | 'curl' | 'press';
export type FixtureView     = 'side' | 'front' | '45';
export type FixtureSource   = 'synthetic' | 'phone';

/**
 * Calidad/escenario del fixture. Se usa en el nombre de archivo, así que debe ser
 * kebab-case `[a-z0-9-]+`. Valores conocidos:
 * - `good`         técnica correcta, rango completo
 * - `shallow`      sentadilla corta (no cruza el umbral de fondo)
 * - `noisy`        como `good` con jitter y spikes de landmarks
 * - `good-30fps`   como `good` pero muestreado a 30 fps
 * - `bilateral`    ambos brazos a la vez
 * - `alternating`  brazos alternos
 * - `left`/`right` un solo brazo visible (vista lateral)
 * - `partial`      rango de movimiento parcial (no arranca extendido)
 * - `lowelbow`     press que baja por debajo del ángulo seguro
 */
export type FixtureQuality =
  | FormErrorQuality
  | 'good'
  | 'shallow'
  | 'noisy'
  | 'good-30fps'
  | 'bilateral'
  | 'alternating'
  | 'left'
  | 'right'
  | 'partial'
  | 'lowelbow';

/**
 * Condiciones de error del protocolo de grabación por guion (DEC-055), en kebab-case: son
 * los códigos de `docs/METRICS.md` §5.2 (`knee_valgus` → `knee-valgus`).
 */
export const FORM_ERROR_QUALITIES = [
  'knee-valgus', 'trunk-lean', 'partial-rom', 'asymmetry', 'unsafe-low-elbow',
  'excess-speed', 'elbow-drift', 'lumbar-arch', 'shallow-depth',
] as const;
export type FormErrorQuality = typeof FORM_ERROR_QUALITIES[number];

export interface FixtureLandmark {
  /** Coordenada horizontal normalizada al ancho de la imagen (0–1; puede salirse un poco). */
  x: number;
  /** Coordenada vertical normalizada al alto de la imagen (0–1; crece hacia abajo). */
  y: number;
  /** Profundidad relativa a la cadera (misma escala que x en `image`; metros en `world`). */
  z: number;
  /** Confianza de que el landmark es visible, 0–1. */
  visibility: number;
}

export interface FixtureFrame {
  /** Milisegundos desde el primer frame de la grabación (estrictamente creciente). */
  t: number;
  /** `result.landmarks[0]` de MediaPipe: 33 landmarks normalizados a la imagen. */
  image: FixtureLandmark[];
  /** `result.worldLandmarks[0]` de MediaPipe: 33 landmarks en metros, origen en la cadera. */
  world?: FixtureLandmark[];
  /**
   * "Abajo" medido por el acelerómetro en ejes de `world` (vector unitario), si había
   * lectura. Permite nivelar el dataset igual que la app (DEC-050, DEC-055).
   */
  down?: [number, number, number];
}

/** Metadatos de una grabación hecha con el protocolo por guion (`?debug=record&cond=…`). */
export interface FixtureCapture {
  /** Motor activo al grabar (DEC-057). */
  engine: '2d' | '3d';
  /** Condición declarada antes de la toma: `correct` o un código de METRICS §5.2. */
  condition?: string;
  /** Identificador anónimo del sujeto (p. ej. `s01`), para la evaluación LOSO. */
  subjectId?: string;
  /** Corrección de la calibración de pie al terminar la toma, en grados (solo motor 3D). */
  calibrationDeg?: number | null;
}

export interface FixtureMeta {
  schemaVersion: typeof FIXTURE_SCHEMA_VERSION;
  exercise:      FixtureExercise;
  view:          FixtureView;
  quality:       FixtureQuality;
  source:        FixtureSource;
  /** `navigator.userAgent` del celular (solo `source: 'phone'`). */
  device?:       string;
  /** Frames por segundo nominales (sintético) o estimados (celular). */
  fps:           number;
  /** ISO-8601 del momento de grabación/generación. */
  recordedAt:    string;
  notes?:        string;
  /** Solo en grabaciones por guion. */
  capture?:      FixtureCapture;
}

export interface LandmarkFixture {
  meta:   FixtureMeta;
  frames: FixtureFrame[];
}

/** Entrada de `fixtures/landmarks/index.json`. */
export interface FixtureIndexEntry {
  /** Nombre de archivo relativo a `fixtures/landmarks/`, patrón `<ejercicio>-<vista>-<calidad>-<nn>.json`. */
  file:       string;
  exercise:   FixtureExercise;
  view:       FixtureView;
  quality:    FixtureQuality;
  source:     FixtureSource;
  fps:        number;
  frames:     number;
  durationMs: number;
  /** Comportamiento esperado por diseño del fixture (no necesariamente el observado; ver README). */
  expected?:  { reps: number; [k: string]: number | string | boolean };
  notes?:     string;
}

export interface FixtureIndex {
  schemaVersion: typeof FIXTURE_SCHEMA_VERSION;
  fixtures:      FixtureIndexEntry[];
}

/** Patrón de nombre de archivo: `<ejercicio>-<vista>-<calidad>-<nn>.json`. */
export const FIXTURE_FILENAME_RE = /^(squat|curl|press)-(side|front|45)-([a-z0-9-]+)-(\d{2})\.json$/;

export function fixtureFileName(meta: Pick<FixtureMeta, 'exercise' | 'view' | 'quality'>, nn: number): string {
  return `${meta.exercise}-${meta.view}-${meta.quality}-${String(nn).padStart(2, '0')}.json`;
}
