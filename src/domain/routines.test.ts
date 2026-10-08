import { describe, expect, it } from 'vitest'
import { getExercise } from './catalog.ts'
import {
  DIFFICULTY_PRESETS, ROUTINE_TEMPLATES, activate, emptyRoutine, instantiateTemplate, muscleGroupsOf,
  newEntry, parseRoutines, resolveStoredRoutines, type Routine,
} from './routines.ts'

function counter() {
  let n = 0
  return () => `id${++n}`
}

const NOW = 1_700_000_000_000

describe('plantillas (DEC-040)', () => {
  it('son tres y solo usan ejercicios del catálogo, con repeticiones o con tiempo', () => {
    expect(ROUTINE_TEMPLATES.map(t => t.id)).toEqual(['ppl', 'full-body', 'by-muscle'])
    for (const t of ROUTINE_TEMPLATES) for (const d of t.days) {
      expect(d.weekday).toBeGreaterThanOrEqual(0)
      expect(d.weekday).toBeLessThanOrEqual(6)
      for (const x of d.exercises) {
        expect(getExercise(x.exerciseId), x.exerciseId).toBeDefined()
        expect((x.reps === undefined) !== (x.holdSeconds === undefined)).toBe(true)
      }
    }
  })

  it('al instanciar: ids únicos, inactiva, nivel del catálogo y "normal" como método', () => {
    const r = instantiateTemplate(ROUTINE_TEMPLATES[0], counter(), NOW)
    const ids = [r.id, ...r.days.flatMap(d => [d.id, ...d.exercises.map(e => e.id)])]
    expect(new Set(ids).size).toBe(ids.length)
    expect(r.active).toBe(false)
    expect(r.createdAt).toBe(NOW)
    for (const e of r.days.flatMap(d => d.exercises)) {
      expect(e.difficulty).toBe(getExercise(e.exerciseId)?.baseDifficulty)
      expect(e.method).toBe('normal')
    }
  })
})

describe('entradas nuevas', () => {
  it('toman el volumen del nivel del ejercicio', () => {
    const e = newEntry('a', 'curl-biceps')
    expect(e).toMatchObject({ exerciseId: 'curl-biceps', difficulty: 'bajo', sets: DIFFICULTY_PRESETS.bajo.sets, reps: DIFFICULTY_PRESETS.bajo.reps })
  })

  it('los ejercicios por tiempo llevan segundos en vez de repeticiones', () => {
    const e = newEntry('a', 'plancha')
    expect(e?.holdSeconds).toBe(DIFFICULTY_PRESETS.bajo.holdSeconds)
    expect(e?.reps).toBeUndefined()
  })

  it('un ejercicio que no existe da null', () => {
    expect(newEntry('a', 'no-existe')).toBeNull()
  })

  it('muscleGroupsOf junta los grupos sin repetir', () => {
    const r = instantiateTemplate(ROUTINE_TEMPLATES[0], counter(), NOW)
    expect(muscleGroupsOf(r.days[0])).toEqual(['pecho', 'hombros', 'triceps'])
  })
})

describe('activate (solo una activa)', () => {
  const a = { ...emptyRoutine('a', NOW), active: true }
  const b = emptyRoutine('b', NOW)

  it('activa una y apaga la otra', () => {
    expect(activate([a, b], 'b').map(r => r.active)).toEqual([false, true])
  })

  it('null apaga todas', () => {
    expect(activate([a, b], null).every(r => !r.active)).toBe(true)
  })
})

describe('lectura defensiva (regresión: loadRoutines de fitnetv2)', () => {
  const good = (): Routine => instantiateTemplate(ROUTINE_TEMPLATES[1], counter(), NOW)

  it('sin nada guardado siembra las tres plantillas, todas inactivas', () => {
    for (const empty of [null, undefined]) {
      const r = resolveStoredRoutines(empty, counter(), NOW)
      expect(r.status).toBe('seeded')
      expect(r.routines).toHaveLength(3)
      expect(r.routines.every(x => !x.active)).toBe(true)
    }
  })

  it('lo guardado y válido se devuelve tal cual, sin plantillas', () => {
    const stored = JSON.parse(JSON.stringify([good()]))
    const r = resolveStoredRoutines(stored, counter(), NOW)
    expect(r).toEqual({ routines: stored, status: 'ok', rejected: 0 })
  })

  it('una lista vacía es una decisión de la persona: no se vuelve a sembrar', () => {
    expect(resolveStoredRoutines([], counter(), NOW)).toEqual({ routines: [], status: 'ok', rejected: 0 })
  })

  it('con datos malformados conserva lo válido y no siembra plantillas', () => {
    const stored = JSON.parse(JSON.stringify([good(), { id: 'x' }, 7]))
    const r = resolveStoredRoutines(stored, counter(), NOW)
    expect(r.status).toBe('partial')
    expect(r.rejected).toBe(2)
    expect(r.routines).toHaveLength(1)
    expect(r.routines[0].name).toBe('Cuerpo completo')
  })

  it('un valor que no es lista es "corrupt" y tampoco siembra', () => {
    for (const bad of [{}, 'texto', 12]) {
      expect(resolveStoredRoutines(bad, counter(), NOW)).toMatchObject({ routines: [], status: 'corrupt' })
    }
  })

  it('descarta solo la entrada mala (ejercicio desconocido) y cuenta el descarte', () => {
    const r = JSON.parse(JSON.stringify(good()))
    r.days[0].exercises[0].exerciseId = 'ya-no-existe'
    const out = parseRoutines([r])
    expect(out.rejected).toBe(1)
    expect(out.routines[0].days[0].exercises).toHaveLength(good().days[0].exercises.length - 1)
  })

  it('acota números fuera de rango en vez de perder la entrada', () => {
    const r = JSON.parse(JSON.stringify(good()))
    Object.assign(r.days[0].exercises[0], { sets: 99, restSeconds: -5, loadKg: 9999 })
    const e = parseRoutines([r]).routines[0].days[0].exercises[0]
    expect(e).toMatchObject({ sets: 10, restSeconds: 0, loadKg: 500 })
  })

  it('si vienen varias activas, queda activa solo la primera', () => {
    const a = { ...good(), id: 'a', active: true }
    const b = { ...good(), id: 'b', active: true }
    expect(parseRoutines(JSON.parse(JSON.stringify([a, b]))).routines.map(x => x.active)).toEqual([true, false])
  })
})
