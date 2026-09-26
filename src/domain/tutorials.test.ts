import { describe, expect, it } from 'vitest'
import { EXERCISE_CATALOG } from './catalog.ts'
import { TUTORIALS, getTutorial } from './tutorials.ts'

describe('fichas de técnica (DEC-043)', () => {
  it('cada ejercicio del catálogo tiene pasos, errores comunes y respiración', () => {
    for (const e of EXERCISE_CATALOG) {
      const t = getTutorial(e.id)
      expect(t, e.id).toBeDefined()
      expect(t!.steps.length, e.id).toBeGreaterThanOrEqual(3)
      expect(t!.mistakes.length, e.id).toBeGreaterThanOrEqual(2)
      expect(t!.breathing.length, e.id).toBeGreaterThan(10)
    }
    expect(Object.keys(TUTORIALS)).toHaveLength(EXERCISE_CATALOG.length)
  })

  it('los ejercicios con asistente dicen dónde colocar el celular', () => {
    for (const e of EXERCISE_CATALOG.filter(x => x.assistant)) {
      expect(getTutorial(e.id)?.cameraSetup, e.id).toMatch(/celular/)
    }
  })

  it('sin emojis ni voseo en el texto (DEC-049, DEC-051)', () => {
    const text = JSON.stringify(TUTORIALS)
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}☀-➿]/u)
    expect(text).not.toMatch(/\b(tenés|podés|hacé|empezá|posicioná|mantené|bajá|subí)\b/)
  })
})
