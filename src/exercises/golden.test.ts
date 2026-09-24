/**
 * Golden tests de los tres trackers (PR 1 del plan Fitnet).
 *
 * Congelan el comportamiento actual antes de cualquier refactor: cada fixture de
 * `fixtures/landmarks/` se reproduce frame a frame y se comprueban (a) aserciones
 * explícitas del resultado esperado y (b) un snapshot del resumen completo.
 *
 * Reglas de este archivo:
 * - Si una aserción falla, el tracker NO se toca: se ajusta la aserción al comportamiento
 *   real, se documenta la discrepancia en `fixtures/README.md` y se enlaza una DEC si el
 *   comportamiento debe cambiar en un PR posterior.
 * - Cambiar un snapshot existente exige una DEC enlazada en el PR (gate 3 del plan, 2.5).
 */

import { describe, expect, it } from 'vitest';
import { SquatTracker } from './squat.ts';
import { BicepCurlTracker } from './bicepCurl.ts';
import { ShoulderPressTracker } from './shoulderPress.ts';
import { replay } from '../testing/replay.ts';
import {
  FIXTURE_FILENAME_RE,
  FIXTURE_SCHEMA_VERSION,
  POSE_LANDMARK_COUNT,
  type FixtureIndex,
  type LandmarkFixture,
} from '../testing/fixtureTypes.ts';

// Carga estática vía Vite: evita depender de `node:fs` en el proyecto de la app.
const FIXTURE_MODULES = import.meta.glob('../../fixtures/landmarks/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const INDEX_PATH = '../../fixtures/landmarks/index.json';

/** Fixtures por nombre de archivo (sin `index.json`). */
const FIXTURES = new Map<string, LandmarkFixture>(
  Object.entries(FIXTURE_MODULES)
    .filter(([path]) => path !== INDEX_PATH)
    .map(([path, mod]) => [path.split('/').pop()!, mod as LandmarkFixture]),
);

const INDEX = FIXTURE_MODULES[INDEX_PATH] as FixtureIndex;

function load(name: string): LandmarkFixture {
  const fixture = FIXTURES.get(`${name}.json`);
  if (!fixture) throw new Error(`Fixture no encontrado: ${name}.json`);
  return fixture;
}

const squat = (name: string) => replay(load(name), new SquatTracker());
const curl  = (name: string) => replay(load(name), new BicepCurlTracker());
const press = (name: string) => replay(load(name), new ShoulderPressTracker());

// ─── Esquema e índice ────────────────────────────────────────────────────────

describe('fixtures: esquema v1 e índice', () => {
  it('el índice lista al menos los 10 fixtures sintéticos', () => {
    expect(INDEX.schemaVersion).toBe(FIXTURE_SCHEMA_VERSION);
    expect(INDEX.fixtures.length).toBeGreaterThanOrEqual(10);
  });

  it('cada entrada del índice apunta a un archivo existente con meta coherente', () => {
    for (const entry of INDEX.fixtures) {
      const fixture = FIXTURES.get(entry.file);
      expect(fixture, `falta el archivo ${entry.file}`).toBeDefined();
      expect(entry.file).toMatch(FIXTURE_FILENAME_RE);
      expect(fixture!.meta.exercise).toBe(entry.exercise);
      expect(fixture!.meta.view).toBe(entry.view);
      expect(fixture!.meta.quality).toBe(entry.quality);
      expect(fixture!.meta.source).toBe(entry.source);
      expect(fixture!.meta.fps).toBe(entry.fps);
      expect(fixture!.frames.length).toBe(entry.frames);
    }
  });

  it('todo archivo de fixtures está registrado en el índice', () => {
    const registered = new Set(INDEX.fixtures.map(e => e.file));
    for (const name of FIXTURES.keys()) {
      expect(registered.has(name), `${name} no está en index.json`).toBe(true);
    }
  });

  it.each([...FIXTURES.keys()].sort())('%s cumple el esquema v1', name => {
    const fixture = FIXTURES.get(name)!;

    expect(fixture.meta.schemaVersion).toBe(FIXTURE_SCHEMA_VERSION);
    expect(fixture.meta.fps).toBeGreaterThan(0);
    expect(Date.parse(fixture.meta.recordedAt)).not.toBeNaN();
    expect(fixture.frames.length).toBeGreaterThanOrEqual(60);

    let prevT = -Infinity;
    for (const frame of fixture.frames) {
      expect(Number.isFinite(frame.t)).toBe(true);
      expect(frame.t).toBeGreaterThan(prevT); // t estrictamente creciente
      prevT = frame.t;

      expect(frame.image).toHaveLength(POSE_LANDMARK_COUNT);
      if (frame.world) expect(frame.world).toHaveLength(POSE_LANDMARK_COUNT);

      for (const p of frame.image) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
        expect(p.visibility).toBeGreaterThanOrEqual(0);
        expect(p.visibility).toBeLessThanOrEqual(1);
      }
    }
  });

  it('ningún fixture contiene datos de imagen o video', () => {
    for (const [name, fixture] of FIXTURES) {
      const keys = new Set(Object.keys(fixture.frames[0]));
      for (const forbidden of ['video', 'imageData', 'blob', 'frameData']) {
        expect(keys.has(forbidden), `${name} contiene ${forbidden}`).toBe(false);
      }
    }
  });
});

// ─── Sentadilla ──────────────────────────────────────────────────────────────

describe('SquatTracker (golden)', () => {
  it('squat-side-good-01: cuenta las 5 reps', () => {
    const s = squat('squat-side-good-01');
    expect(s.reps).toBe(5);
    expect(s.peakFrames).toHaveLength(5);
    expect(s.feedbackLevels.good).toBeGreaterThan(0);
    expect(s).toMatchSnapshot();
  });

  it('squat-side-shallow-01: 0 reps porque nunca cruza BOTTOM_ANGLE=100', () => {
    const s = squat('squat-side-shallow-01');
    expect(s.reps).toBe(0);
    expect(s.peakFrames).toHaveLength(0);
    // Nunca entra en fase squatting: se queda entre standing y la zona muerta.
    expect(s.transitions.filter(t => t.to === 'squatting')).toHaveLength(0);
    expect(s).toMatchSnapshot();
  });

  it('squat-side-noisy-01: el ruido no crea reps falsas (misma cuenta que good)', () => {
    const good  = squat('squat-side-good-01');
    const noisy = squat('squat-side-noisy-01');
    expect(noisy.reps).toBe(good.reps);
    expect(noisy).toMatchSnapshot();
  });

  it('squat-side-good-30fps-01: misma trayectoria a 30 fps', () => {
    const s = squat('squat-side-good-30fps-01');
    expect(s.reps).toBe(5);
    expect(s).toMatchSnapshot();
  });
});

// ─── Curl de bíceps ──────────────────────────────────────────────────────────

describe('BicepCurlTracker (golden)', () => {
  it('curl-front-bilateral-01: 5 reps (el cooldown de DEC-022 absorbe el segundo brazo)', () => {
    const s = curl('curl-front-bilateral-01');
    expect(s.reps).toBe(5);
    expect(s).toMatchSnapshot();
  });

  it('curl-front-alternating-01: 6 reps (3 por brazo, desfase de 800 ms)', () => {
    const s = curl('curl-front-alternating-01');
    expect(s.reps).toBe(6);
    expect(s).toMatchSnapshot();
  });

  it('curl-side-left-01: 5 reps con solo el brazo izquierdo visible', () => {
    const s = curl('curl-side-left-01');
    expect(s.reps).toBe(5);
    expect(s).toMatchSnapshot();
  });

  it('curl-front-partial-01: 0 reps porque parte de 120° (< MIN_START_ANGLE=130)', () => {
    const s = curl('curl-front-partial-01');
    expect(s.reps).toBe(0);
    expect(s).toMatchSnapshot();
  });
});

// ─── Press de hombro ─────────────────────────────────────────────────────────

describe('ShoulderPressTracker (golden)', () => {
  it('press-front-good-01: 5 reps sin feedback de riesgo', () => {
    const s = press('press-front-good-01');
    expect(s.reps).toBe(5);
    expect(s.feedbackLevels.bad ?? 0).toBe(0);
    expect(s).toMatchSnapshot();
  });

  it('press-front-lowelbow-01: produce feedback "bad" al bajar de SAFE_LOW_ANGLE=80', () => {
    const s = press('press-front-lowelbow-01');
    expect(s.feedbackLevels.bad ?? 0).toBeGreaterThan(0);
    expect(s).toMatchSnapshot();
  });
});
