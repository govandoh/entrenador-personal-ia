import { useMemo } from 'react';
import {
  accessibleWeeks, generateRoutine, weekPlan, type GeneratedRoutine, type PlannedDay,
} from '../../domain/routineGenerator';
import { currentProgramWeek, useAppState } from './appStore';

export interface ProgramView {
  routine: GeneratedRoutine;
  /** Semana en curso (0 = semana 1). */
  week: number;
  /** Semanas que se pueden abrir con el plan actual (1 libre, 8 premium; DEC-056). */
  unlockedWeeks: number;
  /** true si la semana en curso está bloqueada por no ser premium. */
  weekLocked: boolean;
  /** Días de la semana visible (la en curso, o la última abierta si está bloqueada). */
  days: PlannedDay[];
  /** Día que toca hoy o el siguiente de la semana. */
  next: PlannedDay | null;
  /** true si `next` es el día de hoy. */
  nextIsToday: boolean;
}

/** Programa derivado del cuestionario guardado; `null` si aún no se respondió. */
export function useProgram(now: Date): ProgramView | null {
  const { questionnaire, programStartedAt, entitlement } = useAppState();
  const today = now.getDay();
  const dateKey = now.toDateString();

  return useMemo(() => {
    if (!questionnaire) return null;
    const routine = generateRoutine(questionnaire);
    const week = Math.min(currentProgramWeek(programStartedAt, new Date(dateKey)), routine.weeks - 1);
    const unlockedWeeks = accessibleWeeks(routine, entitlement.premium);
    const weekLocked = week >= unlockedWeeks;
    const days = weekPlan(routine, Math.min(week, unlockedWeeks - 1));
    const ordered = [...days].sort((a, b) => ((a.weekday - today + 7) % 7) - ((b.weekday - today + 7) % 7));
    const next = ordered[0] ?? null;
    return { routine, week, unlockedWeeks, weekLocked, days, next, nextIsToday: next?.weekday === today };
  }, [questionnaire, programStartedAt, entitlement.premium, today, dateKey]);
}
