import type { TrainingMethod } from './routineGenerator.ts';

/**
 * Entrenamiento manual sin cámara (DEC-047, issue #34).
 *
 * Reductor puro: el estado es de un solo ejercicio y el tiempo NUNCA se lee adentro, llega
 * en cada acción (`now`, epoch en ms). Así es determinista y se prueba sin relojes. Los
 * relojes son marcas de fin (`timerEndsAt`), no contadores que se decrementan: un intervalo
 * atrasado o frenado en segundo plano no desvía la cuenta, porque la resta es contra la hora
 * real.
 *
 * Métodos de entrenamiento:
 * - rest-pause: tras la serie principal, mini-series con 15 s de descanso entre ellas;
 *   todo suma en una sola serie.
 * - dropset: tras la serie principal, descensos de carga sin descanso (bajar 20–30 %).
 * - superserie: sin descanso tras la serie; la app indica pasar al ejercicio pareado.
 *   Limitación declarada en DEC-047: no encadena los dos ejercicios en una pantalla.
 */

export interface ManualPlan {
  exerciseId: string;
  sets: number;
  /** Repeticiones objetivo; los ejercicios por tiempo usan `holdSeconds`. */
  reps?: number;
  holdSeconds?: number;
  restSeconds: number;
  method: TrainingMethod;
  loadKg?: number;
}

export type ManualPhase = 'ready' | 'working' | 'pause' | 'drop' | 'resting' | 'finished';

/** Una serie cerrada. `amount` son repeticiones, o segundos si `timed`. */
export interface DoneSet {
  index: number;
  amount: number;
  timed: boolean;
  /** Mini-series o descensos que se sumaron a la serie principal. */
  extras: number;
  at: number;
}

export interface ManualState {
  plan: ManualPlan;
  phase: ManualPhase;
  /** Serie en curso, desde 0. */
  setIndex: number;
  /** Repeticiones (o segundos) acumulados de la serie en curso. */
  amount: number;
  /** Mini-series o descensos hechos en la serie en curso. */
  extras: number;
  timerStartedAt: number | null;
  timerEndsAt: number | null;
  done: DoneSet[];
}

export type ManualAction =
  | { type: 'start'; now: number }
  | { type: 'rep'; delta: 1 | -1 }
  | { type: 'complete'; now: number }
  | { type: 'continue'; now: number }
  | { type: 'close'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'skipRest'; now: number }
  | { type: 'finish'; now: number };

/** Descanso fijo entre mini-series del rest-pause, en segundos. */
export const REST_PAUSE_SECONDS = 15;
/** Tope de mini-series o descensos por serie. */
export const MAX_EXTRAS = 3;
/** Tope de repeticiones por serie: evita un contador desbocado. */
export const MAX_AMOUNT = 999;

export function isTimedPlan(plan: ManualPlan): boolean {
  return plan.holdSeconds !== undefined;
}

/** Los ejercicios por tiempo no usan los métodos con tramos extra. */
function effectiveMethod(plan: ManualPlan): TrainingMethod {
  return isTimedPlan(plan) ? 'normal' : plan.method;
}

export function initManual(plan: ManualPlan): ManualState {
  return {
    plan: { ...plan, sets: Math.max(1, Math.round(plan.sets)) },
    phase: 'ready', setIndex: 0, amount: 0, extras: 0, timerStartedAt: null, timerEndsAt: null, done: [],
  };
}

/** Segundos o ms que faltan para que termine el reloj en curso; 0 si no hay o ya venció. */
export function remainingMs(s: ManualState, now: number): number {
  return s.timerEndsAt === null ? 0 : Math.max(0, s.timerEndsAt - now);
}

/** Cierra la serie en curso y pasa a descansar, a la siguiente o al final. */
function closeSet(s: ManualState, now: number): ManualState {
  const timed = isTimedPlan(s.plan);
  const done = [...s.done, { index: s.setIndex, amount: s.amount, timed, extras: s.extras, at: now }];
  if (s.setIndex + 1 >= s.plan.sets) {
    return { ...s, done, phase: 'finished', timerStartedAt: null, timerEndsAt: null };
  }
  const next = { ...s, done, setIndex: s.setIndex + 1, amount: 0, extras: 0 };
  if (effectiveMethod(s.plan) === 'superset' || s.plan.restSeconds <= 0) {
    return { ...next, phase: 'ready', timerStartedAt: null, timerEndsAt: null };
  }
  return { ...next, phase: 'resting', timerStartedAt: now, timerEndsAt: now + s.plan.restSeconds * 1000 };
}

export function manualReducer(s: ManualState, a: ManualAction): ManualState {
  switch (a.type) {
    case 'start': {
      if (s.phase !== 'ready') return s;
      const timed = isTimedPlan(s.plan);
      return {
        ...s, phase: 'working', amount: 0, extras: 0,
        timerStartedAt: timed ? a.now : null,
        timerEndsAt: timed ? a.now + (s.plan.holdSeconds as number) * 1000 : null,
      };
    }

    case 'rep': {
      if (s.phase !== 'working' || isTimedPlan(s.plan)) return s;
      return { ...s, amount: Math.min(MAX_AMOUNT, Math.max(0, s.amount + a.delta)) };
    }

    case 'complete': {
      if (s.phase !== 'working') return s;
      let cur = s;
      if (isTimedPlan(s.plan)) {
        // Segundos sostenidos de verdad, sin pasar del objetivo.
        const held = s.timerStartedAt === null ? 0 : Math.round((a.now - s.timerStartedAt) / 1000);
        cur = { ...s, amount: Math.min(s.plan.holdSeconds as number, Math.max(0, held)) };
      }
      const method = effectiveMethod(cur.plan);
      const canExtend = cur.amount > 0 && cur.extras < MAX_EXTRAS;
      if (method === 'rest_pause' && canExtend) {
        return { ...cur, phase: 'pause', timerStartedAt: a.now, timerEndsAt: a.now + REST_PAUSE_SECONDS * 1000 };
      }
      if (method === 'dropset' && canExtend) {
        return { ...cur, phase: 'drop', timerStartedAt: null, timerEndsAt: null };
      }
      return closeSet(cur, a.now);
    }

    case 'continue': {
      // Nueva mini-serie o nuevo descenso: las repeticiones se suman a la misma serie.
      if (s.phase !== 'pause' && s.phase !== 'drop') return s;
      return { ...s, phase: 'working', extras: s.extras + 1, timerStartedAt: null, timerEndsAt: null };
    }

    case 'close': {
      if (s.phase !== 'pause' && s.phase !== 'drop') return s;
      return closeSet(s, a.now);
    }

    case 'tick': {
      if (s.timerEndsAt === null || a.now < s.timerEndsAt) return s;
      if (s.phase === 'working' && isTimedPlan(s.plan)) return manualReducer(s, { type: 'complete', now: s.timerEndsAt });
      if (s.phase === 'resting') return { ...s, phase: 'ready', timerStartedAt: null, timerEndsAt: null };
      return s;
    }

    case 'skipRest': {
      if (s.phase !== 'resting') return s;
      return { ...s, phase: 'ready', timerStartedAt: null, timerEndsAt: null };
    }

    case 'finish': {
      if (s.phase === 'finished') return s;
      // Terminar antes: lo hecho en la serie en curso se guarda.
      const inProgress = s.phase === 'working' || s.phase === 'pause' || s.phase === 'drop';
      let amount = s.amount;
      if (s.phase === 'working' && isTimedPlan(s.plan) && s.timerStartedAt !== null) {
        amount = Math.min(s.plan.holdSeconds as number, Math.max(0, Math.round((a.now - s.timerStartedAt) / 1000)));
      }
      const done = inProgress && amount > 0
        ? [...s.done, { index: s.setIndex, amount, timed: isTimedPlan(s.plan), extras: s.extras, at: a.now }]
        : s.done;
      return { ...s, done, amount, phase: 'finished', timerStartedAt: null, timerEndsAt: null };
    }
  }
}

/** Series con trabajo real: las que se guardan en el historial. */
export function completedSets(s: ManualState): DoneSet[] {
  return s.done.filter(d => d.amount > 0);
}

export function totalAmount(s: ManualState): number {
  return completedSets(s).reduce((sum, d) => sum + d.amount, 0);
}

/** Indicación del método para la serie en curso; `null` con el método normal. */
export function methodHint(s: ManualState): string | null {
  switch (effectiveMethod(s.plan)) {
    case 'rest_pause': return `Rest-pause: tras la serie descansa ${REST_PAUSE_SECONDS} s y sigue hasta ${MAX_EXTRAS} mini-series.`;
    case 'dropset': return 'Dropset: baja la carga entre 20 y 30 % y sigue sin descanso.';
    case 'superset': return 'Superserie: pasa al ejercicio pareado sin descansar.';
    default: return null;
  }
}
