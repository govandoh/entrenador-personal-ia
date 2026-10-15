import { describe, expect, it } from 'vitest'
import {
  addDay, addExercise, commitDraft, hasChanges, moveExercise, removeDay, removeExercise, renameDay,
  setDifficulty, setName, setWeekday, updateExercise, validateDraft,
} from './editorOps.ts'
import { DIFFICULTY_PRESETS, MAX_ROUTINE_NAME, emptyRoutine, type Routine } from './routines.ts'

const NOW = 1_700_000_000_000

function deepFreeze<T>(o: T): T {
  if (typeof o === 'object' && o !== null) {
    Object.freeze(o)
    for (const v of Object.values(o)) deepFreeze(v)
  }
  return o
}

/** Rutina con un día y dos ejercicios (a: curl, b: sentadilla). */
function draft(): Routine {
  let r = emptyRoutine('r1', NOW)
  r = addDay(r, 'd1', 1)
  r = addExercise(r, 'd1', 'a', 'curl-biceps')
  r = addExercise(r, 'd1', 'b', 'sentadilla')
  return r
}

const ids = (r: Routine) => r.days[0].exercises.map(e => e.id)

describe('editorOps', () => {
  it('nunca modifica el borrador recibido', () => {
    const d = deepFreeze(draft())
    expect(() => {
      setName(d, 'x'); addDay(d, 'd2', 3); renameDay(d, 'd1', 'y'); setWeekday(d, 'd1', 4)
      addExercise(d, 'd1', 'c', 'plancha'); removeExercise(d, 'd1', 'a'); moveExercise(d, 'd1', 'a', 1)
      updateExercise(d, 'd1', 'a', { sets: 5, loadKg: 10, method: 'dropset' }); setDifficulty(d, 'd1', 'a', 'alto'); removeDay(d, 'd1')
    }).not.toThrow()
  })

  it('addDay pone nombre por defecto y acota el día de la semana', () => {
    const d = addDay(draft(), 'd2', 99)
    expect(d.days[1]).toMatchObject({ id: 'd2', name: 'Día 2', weekday: 6, exercises: [] })
  })

  it('addExercise usa el volumen del nivel; un id inexistente no cambia nada', () => {
    const d = draft()
    expect(d.days[0].exercises[1]).toMatchObject({ exerciseId: 'sentadilla', difficulty: 'medio', sets: DIFFICULTY_PRESETS.medio.sets })
    expect(addExercise(d, 'd1', 'z', 'no-existe')).toBe(d)
  })

  it('moveExercise intercambia posiciones y respeta los extremos', () => {
    const d = draft()
    expect(ids(moveExercise(d, 'd1', 'a', 1))).toEqual(['b', 'a'])
    expect(ids(moveExercise(d, 'd1', 'b', -1))).toEqual(['b', 'a'])
    expect(ids(moveExercise(d, 'd1', 'a', -1))).toEqual(['a', 'b'])
    expect(ids(moveExercise(d, 'd1', 'b', 1))).toEqual(['a', 'b'])
  })

  it('removeExercise y removeDay quitan solo lo pedido', () => {
    expect(ids(removeExercise(draft(), 'd1', 'a'))).toEqual(['b'])
    expect(removeDay(draft(), 'd1').days).toEqual([])
  })

  it('updateExercise acota los números y redondea', () => {
    const e = updateExercise(draft(), 'd1', 'a', { sets: 50, reps: 0, restSeconds: 30.4 }).days[0].exercises[0]
    expect(e).toMatchObject({ sets: 10, reps: 1, restSeconds: 30 })
  })

  it('updateExercise ignora valores que no son números', () => {
    const before = draft().days[0].exercises[0]
    const e = updateExercise(draft(), 'd1', 'a', { sets: Number.NaN, reps: Number.POSITIVE_INFINITY }).days[0].exercises[0]
    expect(e).toEqual(before)
  })

  it('loadKg se guarda en pasos de 0,5 kg y null lo borra', () => {
    const withLoad = updateExercise(draft(), 'd1', 'a', { loadKg: 12.3 })
    expect(withLoad.days[0].exercises[0].loadKg).toBe(12.5)
    expect(updateExercise(withLoad, 'd1', 'a', { loadKg: null }).days[0].exercises[0].loadKg).toBeUndefined()
  })

  it('salir de superserie borra el grupo', () => {
    const d = draft()
    d.days[0].exercises[0] = { ...d.days[0].exercises[0], method: 'superset', supersetGroup: 1 }
    expect(updateExercise(d, 'd1', 'a', { method: 'normal' }).days[0].exercises[0].supersetGroup).toBeUndefined()
  })

  it('setDifficulty aplica el volumen del nivel y conserva la carga', () => {
    const d = updateExercise(draft(), 'd1', 'a', { loadKg: 8 })
    const e = setDifficulty(d, 'd1', 'a', 'alto').days[0].exercises[0]
    expect(e).toMatchObject({ difficulty: 'alto', sets: DIFFICULTY_PRESETS.alto.sets, reps: DIFFICULTY_PRESETS.alto.reps, loadKg: 8 })
  })

  it('el nombre se recorta al máximo y es obligatorio para guardar', () => {
    expect(setName(emptyRoutine('r', NOW), 'x'.repeat(100)).name).toHaveLength(MAX_ROUTINE_NAME)
    expect(validateDraft(setName(draft(), '   '))).toMatch(/nombre/)
    expect(validateDraft(setName(draft(), 'Mi rutina'))).toBeNull()
  })

  it('hasChanges distingue un borrador intacto de uno modificado', () => {
    const saved = draft()
    expect(hasChanges(saved, saved)).toBe(false)
    expect(hasChanges(saved, renameDay(saved, 'd1', 'Pierna'))).toBe(true)
  })

  it('commitDraft recorta el nombre y marca la modificación', () => {
    const out = commitDraft(setName(draft(), '  Mi rutina  '), NOW + 5)
    expect(out).toMatchObject({ name: 'Mi rutina', updatedAt: NOW + 5, createdAt: NOW })
  })
})
