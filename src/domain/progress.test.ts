import { describe, expect, it } from 'vitest';
import {
  bestStreak, clampTarget, computeAchievements, computeStats, goalProgress, isGoal, type Goal,
} from './progress.ts';
import type { SetRecord } from './sessionHistory.ts';

// Lunes 12 de octubre de 2026, 23:30 hora local: cerca de medianoche a propósito. Con
// `toISOString` (UTC) en Guatemala este instante caería en el día siguiente.
const NOW = new Date(2026, 9, 12, 23, 30, 0);

let n = 0;
function rec(daysAgo: number, over: Partial<SetRecord> = {}): SetRecord {
  const d = new Date(2026, 9, 12 - daysAgo, 23, 30, 0);
  return {
    id: `r${++n}`, completedAt: d.toISOString(), exerciseId: 'sentadilla', validReps: 10, rejectedReps: 0,
    goodReps: 10, timed: false, fatigue: null, ...over,
  };
}

describe('estadísticas derivadas', () => {
  it('sin historial todo es cero y la técnica no tiene dato', () => {
    const s = computeStats([], NOW);
    expect(s).toMatchObject({ sets: 0, reps: 0, activeDays: 0, streak: 0, bestStreak: 0, daysThisWeek: 0, techniquePct: null });
  });

  it('suma series, repeticiones y segundos sostenidos por separado', () => {
    const s = computeStats([rec(0), rec(0, { validReps: 5, goodReps: 4 }), rec(0, { exerciseId: 'plancha', timed: true, validReps: 40, goodReps: 40 })], NOW);
    expect(s.sets).toBe(3);
    expect(s.reps).toBe(15);
    expect(s.heldSeconds).toBe(40);
    expect(s.techniquePct).toBe(93);
    expect(s.distinctExercises).toBe(2);
  });

  it('un ejercicio que ya no está en el catálogo no cuenta como variedad', () => {
    expect(computeStats([rec(0, { exerciseId: 'inventado' })], NOW).distinctExercises).toBe(0);
  });

  it('la racha sigue viva si hoy aún no se entrena pero ayer sí', () => {
    const morning = new Date(2026, 9, 12, 6, 0, 0);
    expect(computeStats([rec(1), rec(2)], morning).streak).toBe(2);
    expect(computeStats([rec(2), rec(3)], morning).streak).toBe(0);
  });

  it('una serie a las 23:30 cuenta en su día local, no en el de UTC', () => {
    const s = computeStats([rec(0)], NOW);
    expect(s.streak).toBe(1);
    expect(s.daysThisWeek).toBe(1);
  });

  it('cuenta los días de la semana en curso, de lunes a domingo', () => {
    // NOW es lunes: solo hoy cae en la semana; el domingo anterior no.
    expect(computeStats([rec(0), rec(1)], NOW).daysThisWeek).toBe(1);
    expect(computeStats([rec(0), rec(1)], new Date(2026, 9, 14)).daysThisWeek).toBe(1);
  });
});

describe('mejor racha', () => {
  it('encuentra la racha más larga aunque no sea la actual', () => {
    expect(bestStreak([rec(20), rec(19), rec(18), rec(17), rec(0)])).toBe(4);
    expect(bestStreak([])).toBe(0);
    expect(bestStreak([rec(5), rec(5), rec(5)])).toBe(1);
  });

  it('cruza el cambio de mes y de horario de verano sin romperse', () => {
    const days = [new Date(2026, 2, 7), new Date(2026, 2, 8), new Date(2026, 2, 9), new Date(2026, 2, 10)];
    const r = days.map(d => ({ ...rec(0), completedAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString() }));
    expect(bestStreak(r)).toBe(4);
    const across = [new Date(2026, 0, 30), new Date(2026, 0, 31), new Date(2026, 1, 1)]
      .map(d => ({ ...rec(0), completedAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString() }));
    expect(bestStreak(across)).toBe(3);
  });
});

describe('objetivos', () => {
  const goal = (kind: Goal['kind'], target: number): Goal => ({ id: 'g', kind, target, createdAt: 0 });

  it('contrasta cada tipo contra su estadística', () => {
    const s = computeStats([rec(0), rec(1), rec(2)], NOW);
    expect(goalProgress(goal('streak_days', 5), s)).toEqual({ current: 3, target: 5, pct: 60, done: false });
    expect(goalProgress(goal('total_reps', 30), s)).toMatchObject({ current: 30, pct: 100, done: true });
    expect(goalProgress(goal('total_sets', 10), s).current).toBe(3);
    expect(goalProgress(goal('weekly_days', 3), s).current).toBe(1);
  });

  it('el porcentaje no pasa de 100 y la meta nunca es cero', () => {
    const s = computeStats([rec(0), rec(0), rec(0)], NOW);
    expect(goalProgress(goal('total_sets', 1), s).pct).toBe(100);
    expect(goalProgress(goal('total_sets', 0), s).target).toBe(1);
  });

  it('valida los objetivos leídos del almacenamiento', () => {
    expect(isGoal(goal('weekly_days', 3))).toBe(true);
    expect(isGoal(goal('weekly_days', 9))).toBe(false);
    expect(isGoal({ ...goal('total_reps', 100), kind: 'otro' })).toBe(false);
    expect(isGoal({ id: 'g', kind: 'total_reps', target: 'x', createdAt: 0 })).toBe(false);
    expect(isGoal(null)).toBe(false);
    expect(clampTarget('weekly_days', 99)).toBe(7);
    expect(clampTarget('streak_days', NaN)).toBe(2);
  });
});

describe('logros', () => {
  it('son ocho y sin historial ninguno está desbloqueado', () => {
    const a = computeAchievements(computeStats([], NOW));
    expect(a).toHaveLength(8);
    expect(a.every(x => !x.unlocked && x.pct === 0)).toBe(true);
  });

  it('muestran progreso parcial antes de desbloquearse', () => {
    const records = Array.from({ length: 5 }, () => rec(0));
    const a = Object.fromEntries(computeAchievements(computeStats(records, NOW)).map(x => [x.id, x]));
    expect(a['first-set'].unlocked).toBe(true);
    expect(a['sets-25']).toMatchObject({ current: 5, pct: 20, unlocked: false });
    expect(a['reps-100']).toMatchObject({ current: 50, pct: 50 });
  });

  it('la racha se desbloquea con la mejor racha histórica, no solo con la actual', () => {
    const records = [rec(30), rec(29), rec(28), rec(0)];
    const a = Object.fromEntries(computeAchievements(computeStats(records, NOW)).map(x => [x.id, x]));
    expect(a['streak-3'].unlocked).toBe(true);
    expect(a['streak-7'].unlocked).toBe(false);
  });

  it('la técnica limpia exige un mínimo de repeticiones', () => {
    const few = computeAchievements(computeStats([rec(0)], NOW)).find(x => x.id === 'technique-90')!;
    expect(few.unlocked).toBe(false);
    const many = computeAchievements(computeStats(Array.from({ length: 6 }, () => rec(0)), NOW)).find(x => x.id === 'technique-90')!;
    expect(many.unlocked).toBe(true);
  });

  it('la variedad cuenta ejercicios distintos del catálogo', () => {
    const ids = ['sentadilla', 'press-banca', 'dominadas', 'plancha', 'curl-biceps'];
    const records = ids.map((exerciseId, i) => rec(i, { exerciseId }));
    const v = computeAchievements(computeStats(records, NOW)).find(x => x.id === 'variety-5')!;
    expect(v.unlocked).toBe(true);
  });
});
