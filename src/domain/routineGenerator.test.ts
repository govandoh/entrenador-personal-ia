import { describe, expect, it } from 'vitest'
import {
  PROGRAM_WEEKS, accessibleWeeks, availableEquipment, generateRoutine, suggestProgram, weekPlan,
  type ExperienceLevel, type Questionnaire, type TrainingGoal, type TrainingLocation,
} from './routineGenerator.ts'
import { EXERCISE_CATALOG, canPerform, getExercise, withAssistant, type EquipmentTag } from './catalog.ts'

const GOALS: TrainingGoal[] = ['muscle_gain', 'weight_loss', 'strength_gain']
const LEVELS: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced']
const LOCATIONS: TrainingLocation[] = ['gym_full', 'home_none', 'home_limited']
const DAYS = [2, 3, 4, 5, 6]
const MINUTES = [30, 45, 60, 90]
const DUMBBELLS: EquipmentTag[] = ['dumbbell', 'band']

function* allQuestionnaires(): Generator<Questionnaire> {
  for (const goal of GOALS) for (const level of LEVELS) for (const location of LOCATIONS)
    for (const daysPerWeek of DAYS) for (const sessionMinutes of MINUTES)
      yield { goal, level, location, daysPerWeek, sessionMinutes, equipment: location === 'home_limited' ? DUMBBELLS : undefined }
}

describe('catálogo (DEC-056)', () => {
  it('tiene los 60 ejercicios de fitnetv2 con ids únicos y al menos una opción de equipo', () => {
    expect(EXERCISE_CATALOG).toHaveLength(60)
    expect(new Set(EXERCISE_CATALOG.map(e => e.id)).size).toBe(60)
    expect(EXERCISE_CATALOG.every(e => e.equipment.length > 0 && e.equipment.every(o => o.length > 0))).toBe(true)
  })

  it('siete ejercicios tienen asistente por cámara', () => {
    expect(withAssistant().map(e => e.assistant).sort()).toEqual(
      ['bridge', 'curl', 'lunge', 'plank', 'press', 'pushup', 'squat'])
  })

  it('en casa sin equipo hay ejercicios para piernas, empuje, cadera y core', () => {
    const home = availableEquipment({ location: 'home_none' })
    const patterns = new Set(EXERCISE_CATALOG.filter(e => canPerform(e, home)).map(e => e.pattern))
    for (const p of ['knee_dominant', 'horizontal_push', 'hip_hinge', 'core'] as const) expect(patterns.has(p)).toBe(true)
  })
})

describe('suggestProgram', () => {
  it('principiante: cuerpo completo; intermedio 4 días: torso/pierna; avanzado 6 días: PPL', () => {
    expect(suggestProgram('beginner', 5)).toBe('full_body')
    expect(suggestProgram('intermediate', 4)).toBe('upper_lower')
    expect(suggestProgram('intermediate', 5)).toBe('ppl')
    expect(suggestProgram('advanced', 6)).toBe('ppl')
    expect(suggestProgram('advanced', 2)).toBe('full_body')
  })
})

describe('generateRoutine: propiedades en las 540 combinaciones del cuestionario', () => {
  const all = [...allQuestionnaires()].map(q => ({ q, r: generateRoutine(q) }))

  it('nunca propone un ejercicio sin el equipo necesario', () => {
    for (const { q, r } of all) {
      const eq = availableEquipment(q)
      for (const day of r.days) for (const e of day.exercises) {
        expect(canPerform(getExercise(e.exerciseId)!, eq), `${q.location} ${e.exerciseId}`).toBe(true)
      }
    }
  })

  it('tantos días como se pidieron, sin ejercicios repetidos dentro de un día', () => {
    for (const { q, r } of all) {
      expect(r.days).toHaveLength(q.daysPerWeek)
      for (const day of r.days) {
        const ids = day.exercises.map(e => e.exerciseId)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  it('cada día tiene al menos 3 ejercicios y no más de los que caben en la sesión', () => {
    for (const { q, r } of all) for (const day of r.days) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(3)
      expect(day.exercises.length).toBeLessThanOrEqual(q.sessionMinutes <= 30 ? 4 : 8)
    }
  })

  it('un principiante nunca recibe métodos avanzados ni ejercicios de dificultad alta', () => {
    for (const { q, r } of all.filter(x => x.q.level === 'beginner')) for (const day of r.days) for (const e of day.exercises) {
      expect(e.method).toBe('normal')
      expect(getExercise(e.exerciseId)!.baseDifficulty, `${q.goal} ${e.exerciseId}`).not.toBe('alto')
    }
  })

  it('si la división no es viable con el equipo, arma cuerpo completo e informa el ajuste', () => {
    for (const { r } of all) {
      if (r.adjustedFrom) {
        expect(r.programType).toBe('full_body')
        expect(r.adjustedFrom).not.toBe('full_body')
      }
    }
    const ppl = generateRoutine({ goal: 'muscle_gain', level: 'advanced', location: 'home_none', daysPerWeek: 6, sessionMinutes: 60 })
    expect(ppl.adjustedFrom).toBe('ppl')
    expect(ppl.programType).toBe('full_body')
    // En el gimnasio la misma petición sí es viable.
    expect(generateRoutine({ goal: 'muscle_gain', level: 'advanced', location: 'gym_full', daysPerWeek: 6, sessionMinutes: 60 }).adjustedFrom).toBeUndefined()
  })

  it('es determinista', () => {
    const q = all[123].q
    expect(generateRoutine(q)).toEqual(generateRoutine(q))
  })
})

describe('generateRoutine: casos', () => {
  it('casa sin equipo, principiante: cuerpo completo con asistente en casi todo', () => {
    const r = generateRoutine({ goal: 'muscle_gain', level: 'beginner', location: 'home_none', daysPerWeek: 3, sessionMinutes: 45 })
    expect(r.programType).toBe('full_body')
    const ids = r.days[0].exercises.map(e => e.exerciseId)
    expect(ids).toContain('sentadilla')
    expect(ids).toContain('flexiones')
    const assisted = r.days[0].exercises.filter(e => e.withAssistant).length
    expect(assisted).toBeGreaterThanOrEqual(3)
  })

  it('prefiere el ejercicio con asistente a igualdad de patrón (gimnasio: sentadilla antes que prensa)', () => {
    const r = generateRoutine({ goal: 'muscle_gain', level: 'intermediate', location: 'gym_full', daysPerWeek: 4, sessionMinutes: 60 })
    const lower = r.days.find(d => d.label === 'Pierna')!
    expect(lower.exercises[0].exerciseId).toBe('sentadilla')
  })

  it('fuerza: pocas repeticiones y descansos largos en los compuestos', () => {
    const r = generateRoutine({ goal: 'strength_gain', level: 'advanced', location: 'gym_full', daysPerWeek: 4, sessionMinutes: 75 })
    const compound = r.days[0].exercises[0]
    expect(compound.reps).toBeLessThanOrEqual(6)
    expect(compound.restSeconds).toBeGreaterThanOrEqual(120)
    expect(compound.sets).toBe(5)
  })

  it('pérdida de peso: 12–15 reps, descansos cortos y superseries desde intermedio', () => {
    const r = generateRoutine({ goal: 'weight_loss', level: 'intermediate', location: 'gym_full', daysPerWeek: 3, sessionMinutes: 60 })
    const reps = r.days.flatMap(d => d.exercises).filter(e => e.reps !== undefined)
    expect(reps.every(e => e.reps! >= 12 && e.restSeconds <= 45)).toBe(true)
    expect(reps.some(e => e.method === 'superset' && e.supersetGroup !== undefined)).toBe(true)
  })

  it('hipertrofia avanzada: dropset en el último aislamiento del día', () => {
    const r = generateRoutine({ goal: 'muscle_gain', level: 'advanced', location: 'gym_full', daysPerWeek: 6, sessionMinutes: 75 })
    expect(r.programType).toBe('ppl')
    expect(r.days.map(d => d.label)).toEqual(['Empuje', 'Tracción', 'Pierna', 'Empuje (2)', 'Tracción (2)', 'Pierna (2)'])
    expect(r.days[0].exercises.some(e => e.method === 'dropset')).toBe(true)
  })

  it('sin barra de dominadas, la tracción vertical se sustituye por un remo', () => {
    const r = generateRoutine({ goal: 'muscle_gain', level: 'intermediate', location: 'home_limited', equipment: ['dumbbell'], daysPerWeek: 4, sessionMinutes: 60 })
    const upper = r.days.find(d => d.label === 'Torso')!
    expect(upper.exercises.some(e => e.exerciseId === 'dominadas')).toBe(false)
    expect(upper.exercises.some(e => getExercise(e.exerciseId)!.pattern === 'horizontal_pull')).toBe(true)
  })

  it('la plancha se prescribe por tiempo, no por repeticiones', () => {
    const r = generateRoutine({ goal: 'muscle_gain', level: 'beginner', location: 'home_none', daysPerWeek: 3, sessionMinutes: 60 })
    const plank = r.days.flatMap(d => d.exercises).find(e => e.exerciseId === 'plancha')
    expect(plank?.holdSeconds).toBe(20)
    expect(plank?.reps).toBeUndefined()
  })
})

describe('progresión y acceso (freemium, DEC-056)', () => {
  const r = generateRoutine({ goal: 'muscle_gain', level: 'beginner', location: 'home_none', daysPerWeek: 3, sessionMinutes: 45 })

  it('la semana 1 es la rutina tal cual; luego suben las repeticiones hasta el tope', () => {
    const w1 = weekPlan(r, 0)[0].exercises[0]
    const w3 = weekPlan(r, 2)[0].exercises[0]
    expect(w1.reps).toBe(r.days[0].exercises[0].reps)
    expect(w3.reps).toBe(w1.reps! + 1)
    expect(weekPlan(r, 7)[0].exercises[0].reps).toBeLessThanOrEqual(12)
  })

  it('una semana de descarga cada cuatro (una serie menos)', () => {
    const base = r.days[0].exercises[0].sets
    expect(weekPlan(r, 3)[0].exercises[0].sets).toBe(Math.max(1, base - 1))
  })

  it('libre: solo la semana 1; premium: el programa completo', () => {
    expect(accessibleWeeks(r, false)).toBe(1)
    expect(accessibleWeeks(r, true)).toBe(PROGRAM_WEEKS)
  })
})
