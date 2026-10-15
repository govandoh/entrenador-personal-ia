import { EXERCISE_CATALOG, canPerform, type CatalogExercise, type EquipmentTag, type MuscleGroup } from './catalog.ts';

/**
 * Filtro común de la biblioteca de ejercicios y del selector del editor de rutinas
 * (issue #34): una sola definición de qué significa "Con asistente", "Sin equipo" o una
 * búsqueda, para que las dos pantallas no se desvíen. Módulo puro.
 */

export type ExerciseFilterId = 'all' | 'assist' | 'bodyweight';

export interface ExerciseQuery {
  filter: ExerciseFilterId;
  muscle: MuscleGroup | null;
  text: string;
  /** Si se da, solo salen los ejercicios que se pueden hacer con ese equipo. */
  equipment?: ReadonlySet<EquipmentTag>;
}

/** Quita acentos y mayúsculas para que "biceps" encuentre "Bíceps". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function isBodyweight(e: CatalogExercise): boolean {
  return e.equipment.some(option => option.length === 1 && option[0] === 'bodyweight');
}

export function matchesExercise(e: CatalogExercise, q: ExerciseQuery): boolean {
  if (q.filter === 'assist' && !e.assistant) return false;
  if (q.filter === 'bodyweight' && !isBodyweight(e)) return false;
  if (q.muscle && e.muscleGroup !== q.muscle && !e.secondary.includes(q.muscle)) return false;
  if (q.equipment && !canPerform(e, q.equipment)) return false;
  const text = q.text.trim();
  return text === '' || fold(e.name).includes(fold(text));
}

/** Ejercicios que cumplen la consulta; los que tienen asistente van primero, sin alterar el resto del orden. */
export function filterExercises(q: ExerciseQuery, catalog: readonly CatalogExercise[] = EXERCISE_CATALOG): CatalogExercise[] {
  return catalog.filter(e => matchesExercise(e, q))
    .map((e, i) => ({ e, i }))
    .sort((a, b) => Number(Boolean(b.e.assistant)) - Number(Boolean(a.e.assistant)) || a.i - b.i)
    .map(x => x.e);
}
