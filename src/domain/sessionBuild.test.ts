import { describe, expect, it } from 'vitest';
import { EXERCISE_CATALOG } from './catalog.ts';
import { initManual, manualReducer, type ManualAction } from './manualWorkout.ts';
import { buildSetRecord, defaultPlan, findEntry, manualRecords, planFromEntry, startHref, startPath } from './sessionBuild.ts';
import { instantiateTemplate, ROUTINE_TEMPLATES } from './routines.ts';
import { isSetRecord } from './sessionHistory.ts';

const NOW = new Date(2026, 9, 12, 20, 0, 0);
let n = 0;
const id = () => `id-${++n}`;

describe('camino de entrenamiento', () => {
  it('los ejercicios con asistente van a la cámara y el resto al modo manual', () => {
    const assisted = EXERCISE_CATALOG.find(e => e.assistant)!;
    const manual = EXERCISE_CATALOG.find(e => !e.assistant)!;
    expect(startPath(assisted.id)).toEqual({ kind: 'camera', assistant: assisted.assistant });
    expect(startHref(assisted.id)).toBe(`/entrenar?ex=${assisted.assistant}`);
    expect(startPath(manual.id)).toEqual({ kind: 'manual', exerciseId: manual.id });
    expect(startHref(manual.id)).toBe(`/manual?ex=${manual.id}`);
  });

  it('ningún ejercicio del catálogo queda sin camino', () => {
    for (const e of EXERCISE_CATALOG) expect(startHref(e.id)).not.toBeNull();
  });

  it('un id desconocido no tiene camino', () => {
    expect(startPath('no-existe')).toBeNull();
    expect(startHref('no-existe')).toBeNull();
    expect(defaultPlan('no-existe')).toBeNull();
  });
});

describe('registro de la serie', () => {
  it('arma un registro válido para el historial', () => {
    const r = buildSetRecord({ id: 'a', now: NOW, exerciseId: 'press-banca', validReps: 10, timed: false });
    expect(isSetRecord(r)).toBe(true);
    expect(r).toMatchObject({ validReps: 10, goodReps: 10, rejectedReps: 0, timed: false, fatigue: null });
  });

  it('sin trabajo no hay registro', () => {
    expect(buildSetRecord({ id: 'a', now: NOW, exerciseId: 'x', validReps: 0, timed: false })).toBeNull();
  });

  it('las repeticiones buenas nunca superan a las válidas', () => {
    const r = buildSetRecord({ id: 'a', now: NOW, exerciseId: 'x', validReps: 5, goodReps: 9, timed: false });
    expect(r?.goodReps).toBe(5);
  });

  it('el modo manual produce una serie por cada serie cerrada', () => {
    const plan = { exerciseId: 'press-banca', sets: 2, reps: 10, restSeconds: 0, method: 'normal' } as const;
    const acts: ManualAction[] = [
      { type: 'start', now: 1 }, { type: 'rep', delta: 1 }, { type: 'rep', delta: 1 }, { type: 'complete', now: 2 },
      { type: 'start', now: 3 }, { type: 'complete', now: 4 },
    ];
    const state = acts.reduce(manualReducer, initManual(plan));
    const recs = manualRecords(state, id);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ exerciseId: 'press-banca', validReps: 2, timed: false });
    expect(isSetRecord(recs[0])).toBe(true);
  });
});

describe('plan manual', () => {
  it('sale de una entrada de rutina, con repeticiones o con tiempo', () => {
    const r = instantiateTemplate(ROUTINE_TEMPLATES[1], id, 0);
    const entries = r.days.flatMap(d => d.exercises);
    const reps = entries.find(e => e.reps !== undefined)!;
    const hold = entries.find(e => e.holdSeconds !== undefined)!;
    expect(planFromEntry(reps)).toMatchObject({ exerciseId: reps.exerciseId, reps: reps.reps });
    expect(planFromEntry(hold)).toMatchObject({ holdSeconds: hold.holdSeconds });
    expect(planFromEntry(hold).reps).toBeUndefined();
    expect(findEntry([r], reps.id)).toBe(reps);
    expect(findEntry([r], 'nada')).toBeNull();
  });

  it('el plan por defecto respeta si el ejercicio es por tiempo', () => {
    const timed = EXERCISE_CATALOG.find(e => e.tracking === 'time')!;
    const counted = EXERCISE_CATALOG.find(e => e.tracking !== 'time')!;
    expect(defaultPlan(timed.id)?.holdSeconds).toBe(30);
    expect(defaultPlan(counted.id)?.reps).toBe(10);
  });
});
