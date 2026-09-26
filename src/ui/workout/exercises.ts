import { EXERCISE_CATALOG, type AssistantId } from '../../domain/catalog';
import { ENGINE_3D } from '../engineFlag';

/** Ejercicios con asistente por cámara, en el orden de los chips. */
export const ASSISTED: readonly AssistantId[] = ['squat', 'curl', 'press', 'pushup', 'lunge', 'bridge', 'plank'];

export const ASSISTED_NAMES: Record<AssistantId, string> = {
  squat: 'Sentadilla',
  curl: 'Curl de bíceps',
  press: 'Press de hombro',
  pushup: 'Flexiones',
  lunge: 'Zancadas',
  bridge: 'Puente de glúteo',
  plank: 'Plancha',
};

/** Ejercicio del catálogo (`catalog.ts`) que registra el historial para cada asistente. */
export function catalogIdFor(ex: AssistantId): string {
  return EXERCISE_CATALOG.find(e => e.assistant === ex)?.id ?? ex;
}

/**
 * Motor por ejercicio (DEC-059). Sentadilla, curl y press siguen en el motor 2D de
 * producción, congelado por los golden, hasta la DEC del issue #33; con `?engine=3d` pasan
 * al 3D. La ola 1 no tiene versión 2D y usa siempre el motor 3D.
 */
export function usesEngine3D(ex: AssistantId): boolean {
  return ENGINE_3D || (ex !== 'squat' && ex !== 'curl' && ex !== 'press');
}

export function isAssistantId(v: string | null): v is AssistantId {
  return v !== null && (ASSISTED as readonly string[]).includes(v);
}
