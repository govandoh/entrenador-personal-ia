import { getExercise, type Difficulty, type MuscleGroup } from './catalog.ts';
import type { TrainingMethod } from './routineGenerator.ts';

/**
 * Rutinas editables, plantillas y lectura defensiva (DEC-040, DEC-052, DEC-056; issue #34).
 *
 * Módulo puro: no toca `localStorage`, el reloj ni el azar. Los ids y la hora llegan como
 * parámetros (`makeId`, `now`), así que todo es determinista y se prueba sin mocks.
 * Las fechas son epoch en milisegundos (DEC-040), sin ambigüedad de zona horaria.
 * La persistencia (leer y escribir `localStorage`) vive en `src/ui/state` y usa este módulo.
 */

/** Una entrada de ejercicio dentro de un día de la rutina. */
export interface RoutineExercise {
  /** Id local de la entrada (no el del catálogo): permite repetir un ejercicio en un día. */
  id: string;
  exerciseId: string;
  difficulty: Difficulty;
  sets: number;
  /** Repeticiones objetivo; los ejercicios por tiempo usan `holdSeconds`. */
  reps?: number;
  holdSeconds?: number;
  restSeconds: number;
  method: TrainingMethod;
  /** Entradas con el mismo número se alternan en superserie (mismo nombre que el generador). */
  supersetGroup?: number;
  /** Carga usada, para medir progresión (DEC-056). */
  loadKg?: number;
}

export interface RoutineDay {
  id: string;
  /** 0 = domingo … 6 = sábado (convención de fitnetv2). */
  weekday: number;
  name: string;
  exercises: RoutineExercise[];
}

export interface Routine {
  id: string;
  name: string;
  /** Solo una rutina puede estar activa: es la que manda en el calendario de Hoy. */
  active: boolean;
  createdAt: number;
  updatedAt: number;
  days: RoutineDay[];
}

export const MAX_ROUTINE_NAME = 40;

/** [mínimo, máximo] de cada campo editable; la UI y la lectura del almacenamiento los respetan. */
export const LIMITS = {
  sets: [1, 10], reps: [1, 100], holdSeconds: [5, 600], restSeconds: [0, 600], loadKg: [0, 500],
} as const;

export function clamp(n: number, [min, max]: readonly [number, number]): number {
  return Math.min(max, Math.max(min, n));
}

/** Volumen inicial al elegir un nivel; la persona lo ajusta después (DEC-040). */
export const DIFFICULTY_PRESETS: Record<Difficulty, { sets: number; reps: number; holdSeconds: number; restSeconds: number }> = {
  bajo: { sets: 2, reps: 12, holdSeconds: 20, restSeconds: 60 },
  medio: { sets: 3, reps: 10, holdSeconds: 40, restSeconds: 90 },
  alto: { sets: 4, reps: 8, holdSeconds: 60, restSeconds: 120 },
};

function isTimed(exerciseId: string): boolean {
  return getExercise(exerciseId)?.tracking === 'time';
}

/** Aplica el volumen del nivel a una entrada, conservando su método y su carga. */
export function applyPreset(e: RoutineExercise, difficulty: Difficulty): RoutineExercise {
  const p = DIFFICULTY_PRESETS[difficulty];
  const next: RoutineExercise = {
    id: e.id, exerciseId: e.exerciseId, difficulty, sets: p.sets, restSeconds: p.restSeconds, method: e.method,
  };
  if (isTimed(e.exerciseId)) next.holdSeconds = p.holdSeconds; else next.reps = p.reps;
  if (e.supersetGroup !== undefined) next.supersetGroup = e.supersetGroup;
  if (e.loadKg !== undefined) next.loadKg = e.loadKg;
  return next;
}

/** Entrada nueva con el nivel del catálogo; `null` si el ejercicio no existe. */
export function newEntry(id: string, exerciseId: string): RoutineExercise | null {
  const ex = getExercise(exerciseId);
  if (!ex) return null;
  return applyPreset({ id, exerciseId, difficulty: ex.baseDifficulty, sets: 0, restSeconds: 0, method: 'normal' }, ex.baseDifficulty);
}

export function emptyRoutine(id: string, now: number): Routine {
  return { id, name: '', active: false, createdAt: now, updatedAt: now, days: [] };
}

/** Grupos musculares que cubre un día, sin repetir y en orden de aparición. */
export function muscleGroupsOf(day: RoutineDay): MuscleGroup[] {
  const groups: MuscleGroup[] = [];
  for (const e of day.exercises) {
    const g = getExercise(e.exerciseId)?.muscleGroup;
    if (g && !groups.includes(g)) groups.push(g);
  }
  return groups;
}

/** Deja activa solo la rutina `id` (o ninguna con `null`). */
export function activate(routines: readonly Routine[], id: string | null): Routine[] {
  return routines.map(r => (r.active === (r.id === id) ? r : { ...r, active: r.id === id }));
}

// ─────────────────────────── Plantillas ───────────────────────────

interface TemplateEntry { exerciseId: string; sets: number; reps?: number; holdSeconds?: number; restSeconds: number }
interface TemplateDay { weekday: number; name: string; exercises: TemplateEntry[] }
export interface RoutineTemplate { id: string; name: string; description: string; days: TemplateDay[] }

const R = (exerciseId: string, sets: number, reps: number, restSeconds: number): TemplateEntry => ({ exerciseId, sets, reps, restSeconds });
const T = (exerciseId: string, sets: number, holdSeconds: number, restSeconds: number): TemplateEntry => ({ exerciseId, sets, holdSeconds, restSeconds });

/** Las tres plantillas de fitnetv2 (DEC-040). Los volúmenes son un punto de partida editable. */
export const ROUTINE_TEMPLATES: readonly RoutineTemplate[] = [
  {
    id: 'ppl', name: 'Empuje, tracción y pierna', description: '3 días: pecho y hombros, espalda y bíceps, piernas.',
    days: [
      { weekday: 1, name: 'Empuje', exercises: [R('press-banca', 4, 8, 90), R('press-hombro', 3, 10, 90), R('press-inclinado', 3, 10, 90), R('elevaciones-laterales', 3, 12, 60), R('extension-polea', 3, 12, 60)] },
      { weekday: 3, name: 'Tracción', exercises: [R('dominadas', 4, 8, 90), R('remo-barra', 3, 10, 90), R('jalon-pecho', 3, 10, 90), R('face-pull', 3, 12, 60), R('curl-biceps', 3, 12, 60)] },
      { weekday: 5, name: 'Pierna', exercises: [R('sentadilla', 4, 8, 120), R('peso-muerto-rumano', 3, 10, 90), R('prensa', 3, 12, 90), R('curl-femoral', 3, 12, 60), R('elevacion-talones-pie', 4, 15, 45)] },
    ],
  },
  {
    id: 'full-body', name: 'Cuerpo completo', description: '3 días con todo el cuerpo en cada sesión.',
    days: [
      { weekday: 1, name: 'Cuerpo completo A', exercises: [R('sentadilla', 3, 10, 90), R('press-banca', 3, 10, 90), R('remo-mancuerna', 3, 10, 90), T('plancha', 3, 30, 45)] },
      { weekday: 3, name: 'Cuerpo completo B', exercises: [R('peso-muerto-rumano', 3, 10, 90), R('press-hombro', 3, 10, 90), R('jalon-pecho', 3, 10, 90), R('curl-biceps', 3, 12, 60), R('abdominales', 3, 15, 45)] },
      { weekday: 5, name: 'Cuerpo completo C', exercises: [R('zancadas', 3, 10, 90), R('flexiones', 3, 12, 60), R('remo-polea', 3, 12, 60), R('hip-thrust', 3, 10, 90), R('elevacion-piernas', 3, 12, 45)] },
    ],
  },
  {
    id: 'by-muscle', name: 'División por músculo', description: '5 días, uno por grupo muscular principal.',
    days: [
      { weekday: 1, name: 'Pecho', exercises: [R('press-banca', 4, 8, 90), R('press-inclinado', 3, 10, 90), R('aperturas', 3, 12, 60), R('flexiones', 2, 15, 60)] },
      { weekday: 2, name: 'Espalda', exercises: [R('dominadas', 4, 8, 90), R('remo-barra', 3, 10, 90), R('remo-polea', 3, 12, 60), R('pullover', 3, 12, 60)] },
      { weekday: 3, name: 'Hombros', exercises: [R('press-hombro', 4, 10, 90), R('elevaciones-laterales', 3, 12, 60), R('pajaros', 3, 12, 60), R('encogimientos', 3, 12, 60)] },
      { weekday: 4, name: 'Brazos', exercises: [R('curl-biceps', 3, 12, 60), R('curl-martillo', 3, 12, 60), R('press-frances', 3, 10, 60), R('extension-polea', 3, 12, 60)] },
      { weekday: 5, name: 'Pierna', exercises: [R('sentadilla', 4, 8, 120), R('prensa', 3, 12, 90), R('curl-femoral', 3, 12, 60), R('hip-thrust', 3, 10, 90), R('elevacion-talones-pie', 4, 15, 45)] },
    ],
  },
];

/** Crea una rutina inactiva a partir de una plantilla; el nivel de cada entrada sale del catálogo. */
export function instantiateTemplate(t: RoutineTemplate, makeId: () => string, now: number): Routine {
  return {
    id: makeId(), name: t.name, active: false, createdAt: now, updatedAt: now,
    days: t.days.map(d => ({
      id: makeId(), weekday: d.weekday, name: d.name,
      exercises: d.exercises.map(x => {
        const e: RoutineExercise = {
          id: makeId(), exerciseId: x.exerciseId, difficulty: getExercise(x.exerciseId)?.baseDifficulty ?? 'medio',
          sets: x.sets, restSeconds: x.restSeconds, method: 'normal',
        };
        if (x.reps !== undefined) e.reps = x.reps;
        if (x.holdSeconds !== undefined) e.holdSeconds = x.holdSeconds;
        return e;
      }),
    })),
  };
}

// ─────────────────────────── Lectura defensiva ───────────────────────────

const DIFFICULTIES: readonly string[] = ['bajo', 'medio', 'alto'];
const METHODS: readonly string[] = ['normal', 'rest_pause', 'dropset', 'superset'];

interface Stats { rejected: number }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Número finito dentro de los límites (los valores fuera de rango se acotan, no se pierden). */
function num(v: unknown, limits: readonly [number, number]): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(v, limits) : undefined;
}

function parseList<T>(raw: unknown, parse: (v: unknown) => T | null, stats: Stats): T[] {
  if (!Array.isArray(raw)) { stats.rejected++; return []; }
  const out: T[] = [];
  for (const item of raw) {
    const parsed = parse(item);
    if (parsed) out.push(parsed); else stats.rejected++;
  }
  return out;
}

function parseEntry(v: unknown): RoutineExercise | null {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.exerciseId !== 'string' || !getExercise(v.exerciseId)) return null;
  if (!DIFFICULTIES.includes(v.difficulty as string) || !METHODS.includes(v.method as string)) return null;
  const sets = num(v.sets, LIMITS.sets);
  const restSeconds = num(v.restSeconds, LIMITS.restSeconds);
  const reps = num(v.reps, LIMITS.reps);
  const holdSeconds = num(v.holdSeconds, LIMITS.holdSeconds);
  if (sets === undefined || restSeconds === undefined || (reps === undefined && holdSeconds === undefined)) return null;
  const e: RoutineExercise = {
    id: v.id, exerciseId: v.exerciseId, difficulty: v.difficulty as Difficulty, sets, restSeconds, method: v.method as TrainingMethod,
  };
  if (reps !== undefined) e.reps = reps;
  if (holdSeconds !== undefined) e.holdSeconds = holdSeconds;
  const group = num(v.supersetGroup, [1, 99]);
  if (group !== undefined) e.supersetGroup = Math.round(group);
  const loadKg = num(v.loadKg, LIMITS.loadKg);
  if (loadKg !== undefined) e.loadKg = loadKg;
  return e;
}

function parseDay(v: unknown, stats: Stats): RoutineDay | null {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.name !== 'string') return null;
  const weekday = num(v.weekday, [0, 6]);
  if (weekday === undefined) return null;
  return { id: v.id, weekday: Math.round(weekday), name: v.name, exercises: parseList(v.exercises, parseEntry, stats) };
}

function parseRoutine(v: unknown, stats: Stats): Routine | null {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.name !== 'string' || typeof v.active !== 'boolean') return null;
  if (typeof v.createdAt !== 'number' || typeof v.updatedAt !== 'number') return null;
  return {
    id: v.id, name: v.name, active: v.active, createdAt: v.createdAt, updatedAt: v.updatedAt,
    days: parseList(v.days, d => parseDay(d, stats), stats),
  };
}

/** Valida una lista leída del almacenamiento: conserva lo válido y cuenta lo descartado. */
export function parseRoutines(raw: readonly unknown[]): { routines: Routine[]; rejected: number } {
  const stats: Stats = { rejected: 0 };
  const parsed = parseList(raw, r => parseRoutine(r, stats), stats);
  // Si el almacenamiento trae varias activas, manda la primera.
  let seenActive = false;
  const routines = parsed.map(r => {
    if (!r.active) return r;
    if (seenActive) return { ...r, active: false };
    seenActive = true;
    return r;
  });
  return { routines, rejected: stats.rejected };
}

/**
 * - `seeded`: nunca se había guardado nada; se siembran las plantillas (DEC-040).
 * - `ok`: todo lo guardado era válido (incluida una lista vacía: la persona las borró).
 * - `partial`: había datos malformados; se conserva lo válido y NO se siembra nada.
 * - `corrupt`: lo guardado no era una lista; no se siembra nada.
 */
export type LoadStatus = 'seeded' | 'ok' | 'partial' | 'corrupt';
export interface LoadResult { routines: Routine[]; status: LoadStatus; rejected: number }

/**
 * Decide qué rutinas mostrar al arrancar. Corrige el defecto de fitnetv2 (`loadRoutines`
 * reemplazaba lo guardado por las plantillas cuando la validación fallaba): las plantillas se
 * siembran solo si no hay NADA guardado. Quien llama no debe escribir al leer, y con
 * `partial` o `corrupt` debe respaldar el valor crudo antes de la primera escritura.
 */
export function resolveStoredRoutines(stored: unknown, makeId: () => string, now: number): LoadResult {
  if (stored === null || stored === undefined) {
    return { routines: ROUTINE_TEMPLATES.map(t => instantiateTemplate(t, makeId, now)), status: 'seeded', rejected: 0 };
  }
  if (!Array.isArray(stored)) return { routines: [], status: 'corrupt', rejected: 1 };
  const { routines, rejected } = parseRoutines(stored);
  return { routines, status: rejected > 0 ? 'partial' : 'ok', rejected };
}
