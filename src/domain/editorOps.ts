import {
  LIMITS, MAX_ROUTINE_NAME, applyPreset, clamp, newEntry,
  type Routine, type RoutineDay, type RoutineExercise,
} from './routines.ts';
import type { Difficulty } from './catalog.ts';
import type { TrainingMethod } from './routineGenerator.ts';

/**
 * Operaciones sobre el borrador del editor de rutinas (DEC-052, issue #34).
 *
 * Son funciones puras e inmutables: reciben el borrador y devuelven uno nuevo, sin tocar el
 * original. El componente del editor solo las llama y guarda el resultado en su estado; así
 * la lógica se prueba sin React y el borrador nunca se persiste hasta confirmar. Los ids
 * nuevos llegan por parámetro para que el resultado sea determinista.
 */

function mapDay(d: Routine, dayId: string, fn: (day: RoutineDay) => RoutineDay): Routine {
  return { ...d, days: d.days.map(day => (day.id === dayId ? fn(day) : day)) };
}

function mapEntry(d: Routine, dayId: string, entryId: string, fn: (e: RoutineExercise) => RoutineExercise): Routine {
  return mapDay(d, dayId, day => ({ ...day, exercises: day.exercises.map(e => (e.id === entryId ? fn(e) : e)) }));
}

export function setName(d: Routine, name: string): Routine {
  return { ...d, name: name.slice(0, MAX_ROUTINE_NAME) };
}

export function addDay(d: Routine, dayId: string, weekday: number): Routine {
  const day: RoutineDay = { id: dayId, weekday: Math.round(clamp(weekday, [0, 6])), name: `Día ${d.days.length + 1}`, exercises: [] };
  return { ...d, days: [...d.days, day] };
}

export function removeDay(d: Routine, dayId: string): Routine {
  return { ...d, days: d.days.filter(day => day.id !== dayId) };
}

export function renameDay(d: Routine, dayId: string, name: string): Routine {
  return mapDay(d, dayId, day => ({ ...day, name: name.slice(0, MAX_ROUTINE_NAME) }));
}

export function setWeekday(d: Routine, dayId: string, weekday: number): Routine {
  return mapDay(d, dayId, day => ({ ...day, weekday: Math.round(clamp(weekday, [0, 6])) }));
}

/** Agrega un ejercicio del catálogo con el volumen de su nivel; ignora ids que no existen. */
export function addExercise(d: Routine, dayId: string, entryId: string, exerciseId: string): Routine {
  const entry = newEntry(entryId, exerciseId);
  if (!entry) return d;
  return mapDay(d, dayId, day => ({ ...day, exercises: [...day.exercises, entry] }));
}

export function removeExercise(d: Routine, dayId: string, entryId: string): Routine {
  return mapDay(d, dayId, day => ({ ...day, exercises: day.exercises.filter(e => e.id !== entryId) }));
}

/** Sube (-1) o baja (+1) una posición; en los extremos no hace nada. */
export function moveExercise(d: Routine, dayId: string, entryId: string, delta: -1 | 1): Routine {
  return mapDay(d, dayId, day => {
    const i = day.exercises.findIndex(e => e.id === entryId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= day.exercises.length) return day;
    const exercises = day.exercises.slice();
    [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
    return { ...day, exercises };
  });
}

/** Cambios posibles de una entrada. `loadKg: null` borra la carga. */
export interface ExercisePatch {
  sets?: number;
  reps?: number;
  holdSeconds?: number;
  restSeconds?: number;
  method?: TrainingMethod;
  loadKg?: number | null;
}

/** Aplica el cambio acotando cada número a sus límites; ignora valores que no sean números. */
export function updateExercise(d: Routine, dayId: string, entryId: string, patch: ExercisePatch): Routine {
  return mapEntry(d, dayId, entryId, e => {
    const next = { ...e };
    for (const key of ['sets', 'reps', 'holdSeconds', 'restSeconds'] as const) {
      const v = patch[key];
      if (v !== undefined && Number.isFinite(v)) next[key] = Math.round(clamp(v, LIMITS[key]));
    }
    if (patch.method !== undefined) {
      next.method = patch.method;
      if (patch.method !== 'superset') delete next.supersetGroup;
    }
    if (patch.loadKg === null) delete next.loadKg;
    else if (patch.loadKg !== undefined && Number.isFinite(patch.loadKg)) next.loadKg = Math.round(clamp(patch.loadKg, LIMITS.loadKg) * 2) / 2;
    return next;
  });
}

/** Cambia el nivel de una entrada y le aplica el volumen de ese nivel. */
export function setDifficulty(d: Routine, dayId: string, entryId: string, difficulty: Difficulty): Routine {
  return mapEntry(d, dayId, entryId, e => applyPreset(e, difficulty));
}

/** Mensaje de error para mostrar junto al nombre, o `null` si el borrador se puede guardar. */
export function validateDraft(d: Routine): string | null {
  return d.name.trim() === '' ? 'Ponle un nombre a la rutina.' : null;
}

/** true si el borrador difiere de lo guardado: decide si "Salir" pregunta o si dice "Listo". */
export function hasChanges(saved: Routine, draft: Routine): boolean {
  return JSON.stringify(saved) !== JSON.stringify(draft);
}

/** Versión lista para persistir: nombre sin espacios sobrantes y fecha de modificación. */
export function commitDraft(d: Routine, now: number): Routine {
  return { ...d, name: d.name.trim(), updatedAt: now };
}
