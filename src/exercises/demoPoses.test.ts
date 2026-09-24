import { describe, expect, it } from 'vitest'
import { DEMOS, getDemo, sampleDemo } from './demoPoses'
import { GOOD_DEPTH_ANGLE } from './squat'
import { GOOD_FORM_ANGLE } from './bicepCurl'
import { GOOD_LOCKOUT_ANGLE } from './shoulderPress'

describe('demoPoses', () => {
  it('genera los 33 landmarks con visibilidad completa', () => {
    for (const def of Object.values(DEMOS)) {
      const w = def.pose(0.5)
      expect(w).toHaveLength(33)
      expect(w.every(p => p.visibility === 1 && Number.isFinite(p.x + p.y + p.z))).toBe(true)
    }
  })

  it('la técnica que se enseña cumple los umbrales que exige la app', () => {
    expect(DEMOS.sentadilla.measure(DEMOS.sentadilla.pose(1))).toBeLessThan(GOOD_DEPTH_ANGLE)
    expect(DEMOS['curl-biceps'].measure(DEMOS['curl-biceps'].pose(1))).toBeLessThan(GOOD_FORM_ANGLE)
    expect(DEMOS['press-hombro'].measure(DEMOS['press-hombro'].pose(1))).toBeGreaterThan(GOOD_LOCKOUT_ANGLE)
  })

  it('la posición inicial queda fuera de la zona de esfuerzo', () => {
    expect(DEMOS.sentadilla.measure(DEMOS.sentadilla.pose(0))).toBeGreaterThan(160)
    expect(DEMOS['curl-biceps'].measure(DEMOS['curl-biceps'].pose(0))).toBeGreaterThan(160)
    expect(DEMOS['press-hombro'].measure(DEMOS['press-hombro'].pose(0))).toBeLessThan(100)
  })

  it('sampleDemo recorre las fases en bucle', () => {
    const def = DEMOS.sentadilla
    const total = def.phases.reduce((acc, ph) => acc + ph.durationMs, 0)
    expect(sampleDemo(def, 0).p).toBe(0)
    expect(sampleDemo(def, 600 + 1700 + 200).p).toBe(1)
    expect(sampleDemo(def, total).p).toBe(sampleDemo(def, 0).p)
  })

  it('getDemo devuelve undefined para ejercicios sin demo', () => {
    expect(getDemo('sentadilla')).toBe(DEMOS.sentadilla)
    expect(getDemo('prensa')).toBeUndefined()
  })
})
