import { describe, expect, it } from 'vitest';
import { EXERCISE_CATALOG, type EquipmentTag } from './catalog.ts';
import { filterExercises, fold, isBodyweight } from './exerciseFilter.ts';

const ALL = { filter: 'all', muscle: null, text: '' } as const;

describe('filtro de ejercicios', () => {
  it('sin criterios devuelve todo el catálogo, con los asistidos primero', () => {
    const list = filterExercises(ALL);
    expect(list).toHaveLength(EXERCISE_CATALOG.length);
    const firstUnassisted = list.findIndex(e => !e.assistant);
    expect(list.slice(firstUnassisted).every(e => !e.assistant)).toBe(true);
  });

  it('la búsqueda ignora acentos y mayúsculas', () => {
    expect(fold('Bíceps')).toBe('biceps');
    const names = filterExercises({ ...ALL, text: '  CURL ' }).map(e => e.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every(n => fold(n).includes('curl'))).toBe(true);
  });

  it('"con asistente" deja solo los que tienen análisis por cámara', () => {
    const list = filterExercises({ ...ALL, filter: 'assist' });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every(e => e.assistant)).toBe(true);
  });

  it('"sin equipo" deja solo los de peso corporal', () => {
    const list = filterExercises({ ...ALL, filter: 'bodyweight' });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every(isBodyweight)).toBe(true);
  });

  it('el grupo muscular incluye a los secundarios', () => {
    const list = filterExercises({ ...ALL, muscle: 'triceps' });
    expect(list.some(e => e.muscleGroup !== 'triceps' && e.secondary.includes('triceps'))).toBe(true);
  });

  it('con equipo disponible solo salen los que se pueden hacer', () => {
    const only: ReadonlySet<EquipmentTag> = new Set<EquipmentTag>(['bodyweight']);
    const list = filterExercises({ ...ALL, equipment: only });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every(isBodyweight)).toBe(true);
    expect(filterExercises({ ...ALL, equipment: new Set() })).toHaveLength(0);
  });

  it('los criterios se combinan', () => {
    const list = filterExercises({ filter: 'assist', muscle: 'cuadriceps', text: 'sentadilla' });
    expect(list.every(e => e.assistant && fold(e.name).includes('sentadilla'))).toBe(true);
  });
});
