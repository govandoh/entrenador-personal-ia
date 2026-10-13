import { describe, expect, it } from 'vitest';
import {
  MAX_EXTRAS, REST_PAUSE_SECONDS, completedSets, initManual, manualReducer, methodHint, remainingMs,
  totalAmount, type ManualAction, type ManualPlan, type ManualState,
} from './manualWorkout.ts';

const T0 = 1_000_000;
const base: ManualPlan = { exerciseId: 'press-banca', sets: 2, reps: 10, restSeconds: 60, method: 'normal' };

function run(plan: ManualPlan, actions: ManualAction[]): ManualState {
  return actions.reduce(manualReducer, initManual(plan));
}
const reps = (n: number): ManualAction[] => Array.from({ length: n }, () => ({ type: 'rep', delta: 1 }));

describe('serie normal', () => {
  it('cuenta repeticiones, no baja de 0 y descansa con reloj de fin', () => {
    let s = run(base, [{ type: 'start', now: T0 }, { type: 'rep', delta: -1 }, ...reps(10)]);
    expect(s.amount).toBe(10);
    s = manualReducer(s, { type: 'complete', now: T0 + 30_000 });
    expect(s.phase).toBe('resting');
    expect(s.setIndex).toBe(1);
    expect(s.done).toHaveLength(1);
    expect(remainingMs(s, T0 + 30_000 + 20_000)).toBe(40_000);
  });

  it('el descanso termina por tick contra la hora real, también si el intervalo se atrasó', () => {
    let s = run(base, [{ type: 'start', now: T0 }, ...reps(5), { type: 'complete', now: T0 + 1000 }]);
    s = manualReducer(s, { type: 'tick', now: T0 + 1000 + 59_999 });
    expect(s.phase).toBe('resting');
    s = manualReducer(s, { type: 'tick', now: T0 + 1000 + 600_000 });
    expect(s.phase).toBe('ready');
  });

  it('saltar el descanso pasa a lista; la última serie termina el ejercicio', () => {
    let s = run(base, [{ type: 'start', now: T0 }, ...reps(8), { type: 'complete', now: T0 + 1 }, { type: 'skipRest', now: T0 + 2 }]);
    expect(s.phase).toBe('ready');
    s = [{ type: 'start', now: T0 + 3 } as ManualAction, ...reps(6), { type: 'complete', now: T0 + 4 } as ManualAction].reduce(manualReducer, s);
    expect(s.phase).toBe('finished');
    expect(totalAmount(s)).toBe(14);
  });

  it('ignora acciones fuera de fase', () => {
    const s = initManual(base);
    expect(manualReducer(s, { type: 'rep', delta: 1 })).toBe(s);
    expect(manualReducer(s, { type: 'complete', now: T0 })).toBe(s);
    expect(manualReducer(s, { type: 'continue', now: T0 })).toBe(s);
    expect(manualReducer(s, { type: 'skipRest', now: T0 })).toBe(s);
  });

  it('con descanso 0 pasa directo a lista', () => {
    const s = run({ ...base, restSeconds: 0 }, [{ type: 'start', now: T0 }, ...reps(3), { type: 'complete', now: T0 + 1 }]);
    expect(s.phase).toBe('ready');
    expect(s.timerEndsAt).toBeNull();
  });
});

describe('ejercicio por tiempo', () => {
  const plank: ManualPlan = { exerciseId: 'plancha', sets: 1, holdSeconds: 30, restSeconds: 45, method: 'normal' };

  it('termina solo al vencer el reloj y registra los segundos del objetivo', () => {
    let s = run(plank, [{ type: 'start', now: T0 }]);
    expect(remainingMs(s, T0 + 10_000)).toBe(20_000);
    s = manualReducer(s, { type: 'tick', now: T0 + 29_999 });
    expect(s.phase).toBe('working');
    s = manualReducer(s, { type: 'tick', now: T0 + 31_000 });
    expect(s.phase).toBe('finished');
    expect(s.done[0]).toMatchObject({ amount: 30, timed: true });
  });

  it('cerrar antes registra los segundos sostenidos; las repeticiones no aplican', () => {
    let s = run(plank, [{ type: 'start', now: T0 }, { type: 'rep', delta: 1 }]);
    expect(s.amount).toBe(0);
    s = manualReducer(s, { type: 'complete', now: T0 + 12_400 });
    expect(s.done[0].amount).toBe(12);
  });

  it('ignora el método con tramos extra', () => {
    const s = run({ ...plank, method: 'rest_pause' }, [{ type: 'start', now: T0 }, { type: 'complete', now: T0 + 10_000 }]);
    expect(s.phase).toBe('finished');
  });
});

describe('métodos de entrenamiento', () => {
  it('rest-pause: 15 s de pausa y las mini-series suman en la misma serie', () => {
    const plan: ManualPlan = { ...base, sets: 1, method: 'rest_pause' };
    let s = run(plan, [{ type: 'start', now: T0 }, ...reps(10), { type: 'complete', now: T0 + 1000 }]);
    expect(s.phase).toBe('pause');
    expect(remainingMs(s, T0 + 1000)).toBe(REST_PAUSE_SECONDS * 1000);
    s = [{ type: 'continue', now: T0 + 16_000 } as ManualAction, ...reps(3), { type: 'complete', now: T0 + 20_000 } as ManualAction,
      { type: 'close', now: T0 + 21_000 } as ManualAction].reduce(manualReducer, s);
    expect(s.phase).toBe('finished');
    expect(s.done).toHaveLength(1);
    expect(s.done[0]).toMatchObject({ amount: 13, extras: 1 });
  });

  it('dropset: sin descanso entre descensos y con tope de descensos', () => {
    const plan: ManualPlan = { ...base, sets: 1, method: 'dropset' };
    let s = run(plan, [{ type: 'start', now: T0 }, ...reps(8), { type: 'complete', now: T0 + 1 }]);
    expect(s.phase).toBe('drop');
    expect(s.timerEndsAt).toBeNull();
    for (let i = 0; i < MAX_EXTRAS; i++) {
      s = [{ type: 'continue', now: T0 } as ManualAction, ...reps(2), { type: 'complete', now: T0 } as ManualAction].reduce(manualReducer, s);
    }
    // Con el tope alcanzado la serie se cierra sola.
    expect(s.phase).toBe('finished');
    expect(s.done[0]).toMatchObject({ amount: 8 + 2 * MAX_EXTRAS, extras: MAX_EXTRAS });
  });

  it('superserie: sin descanso, pasa directo a la siguiente serie', () => {
    const plan: ManualPlan = { ...base, method: 'superset' };
    const s = run(plan, [{ type: 'start', now: T0 }, ...reps(10), { type: 'complete', now: T0 + 1 }]);
    expect(s.phase).toBe('ready');
    expect(s.setIndex).toBe(1);
  });

  it('una serie en cero no abre tramo extra', () => {
    const s = run({ ...base, method: 'rest_pause', sets: 1 }, [{ type: 'start', now: T0 }, { type: 'complete', now: T0 + 1 }]);
    expect(s.phase).toBe('finished');
    expect(completedSets(s)).toHaveLength(0);
  });

  it('muestra la indicación del método', () => {
    expect(methodHint(initManual(base))).toBeNull();
    expect(methodHint(initManual({ ...base, method: 'dropset' }))).toContain('20 y 30');
    expect(methodHint(initManual({ ...base, method: 'superset' }))).toContain('pareado');
  });
});

describe('terminar antes', () => {
  it('guarda lo hecho en la serie en curso', () => {
    const s = run(base, [{ type: 'start', now: T0 }, ...reps(7), { type: 'finish', now: T0 + 5 }]);
    expect(s.phase).toBe('finished');
    expect(completedSets(s)).toEqual([{ index: 0, amount: 7, timed: false, extras: 0, at: T0 + 5 }]);
  });

  it('sin trabajo hecho no guarda nada y es idempotente', () => {
    let s = run(base, [{ type: 'finish', now: T0 }]);
    expect(completedSets(s)).toHaveLength(0);
    s = manualReducer(s, { type: 'finish', now: T0 + 1 });
    expect(s.done).toHaveLength(0);
  });

  it('en tiempo, guarda los segundos transcurridos', () => {
    const s = run({ exerciseId: 'plancha', sets: 2, holdSeconds: 60, restSeconds: 30, method: 'normal' },
      [{ type: 'start', now: T0 }, { type: 'finish', now: T0 + 25_000 }]);
    expect(completedSets(s)[0]).toMatchObject({ amount: 25, timed: true });
  });
});
