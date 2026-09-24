import { describe, expect, it } from 'vitest'
import { FRESH_FATIGUE, FatigueDetector } from './fatigue.ts'
import type { RepMetrics } from './movementQuality.ts'
import { FATIGUE_MESSAGES } from './messages.ts'

function rep(concentricVelocity: number, romDegrees = 90): RepMetrics {
  return {
    romDegrees, durationMs: 2000, concentricMs: 800, eccentricMs: 1200,
    concentricVelocity, peakVelocity: concentricVelocity * 1.5, smoothness: 1, completedAtMs: 0,
  }
}

describe('FatigueDetector (DEC-038)', () => {
  it('no evalúa hasta tener la línea base de 3 repeticiones', () => {
    const d = new FatigueDetector()
    expect(d.addRep(rep(100))).toEqual(FRESH_FATIGUE)
    expect(d.addRep(rep(50))).toEqual(FRESH_FATIGUE)
  })

  it('clasifica por caída de velocidad respecto a la línea base', () => {
    const levels = [95, 85, 75, 60].map(v => {
      const d = new FatigueDetector()
      for (let i = 0; i < 3; i++) d.addRep(rep(100))
      for (let i = 0; i < 3; i++) d.addRep(rep(v))
      return d.getState().level
    })
    // 5 % → fresh (score 10); 15 % → moderate; 25 % → high; 40 % → critical.
    expect(levels).toEqual(['fresh', 'moderate', 'high', 'critical'])
  })

  it('la pérdida de recorrido también suma al puntaje', () => {
    const d = new FatigueDetector()
    for (let i = 0; i < 3; i++) d.addRep(rep(100, 90))
    for (let i = 0; i < 3; i++) d.addRep(rep(100, 70))
    const s = d.getState()
    expect(s.velocityDropPercent).toBe(0)
    expect(s.romLossPercent).toBe(22)
    expect(s.level).not.toBe('fresh')
  })

  it('sugiere descansar solo en nivel crítico', () => {
    const d = new FatigueDetector()
    for (let i = 0; i < 3; i++) d.addRep(rep(100))
    for (let i = 0; i < 3; i++) d.addRep(rep(60))
    expect(d.getState().shouldRest).toBe(true)
  })

  it('reset vuelve al estado inicial', () => {
    const d = new FatigueDetector()
    for (let i = 0; i < 6; i++) d.addRep(rep(100 - i * 10))
    d.reset()
    expect(d.repCount).toBe(0)
    expect(d.getState()).toEqual(FRESH_FATIGUE)
  })

  it('cada nivel tiene su mensaje en español', () => {
    for (const level of ['fresh', 'moderate', 'high', 'critical'] as const) {
      expect(FATIGUE_MESSAGES[level].length).toBeGreaterThan(0)
    }
  })
})
