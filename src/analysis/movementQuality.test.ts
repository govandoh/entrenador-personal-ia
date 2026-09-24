import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THRESHOLDS, MovementAnalyzer, countReversals, type CycleShape, type QualityThresholds,
  type ValidationResult,
} from './movementQuality.ts'
import { FatigueDetector } from './fatigue.ts'
import { DEMOS } from '../exercises/demoPoses.ts'
import { LandmarkSmoother } from '../geometry/landmarkFilter.ts'
import { jitter, playDemo, seededGauss, type PlayOptions } from '../testing/syntheticMotion.ts'

/**
 * Configuración por ejercicio tomada de los trackers 3D de fitnetv2 (d456e95). En el paso
 * I-2 (DEC-054) pasa a ser la configuración inyectable de cada tracker.
 */
const EXERCISES: Record<string, { shape: CycleShape; thresholds: Partial<QualityThresholds>; effortPhase: number }> = {
  sentadilla: {
    shape: { effortIsMinimum: true, concentricFirst: false },
    thresholds: { minRomDegrees: 40, minDurationMs: 800, maxDurationMs: 15000 },
    effortPhase: 3,
  },
  'curl-biceps': {
    shape: { effortIsMinimum: true, concentricFirst: true },
    thresholds: { minRomDegrees: 50, minDurationMs: 700, maxDurationMs: 10000, minSmoothness: 0.3 },
    effortPhase: 1,
  },
  'press-hombro': {
    shape: { effortIsMinimum: false, concentricFirst: true },
    thresholds: { minRomDegrees: 45, minDurationMs: 700, maxDurationMs: 10000, minSmoothness: 0.3 },
    effortPhase: 1,
  },
}

/**
 * Reproduce la demo como lo hará el pipeline (ruido → One Euro → ángulo) y valida cada
 * ciclo: la frontera se marca al empezar el ciclo y se valida al terminarlo, que es lo que
 * hace la máquina de estados del tracker.
 */
function run(id: string, opts: PlayOptions & { noise?: number } = {}): ValidationResult[] {
  const def = DEMOS[id]
  const cfg = EXERCISES[id]
  const gauss = seededGauss()
  const smoother = new LandmarkSmoother()
  const analyzer = new MovementAnalyzer(cfg.thresholds)
  const results: ValidationResult[] = []
  let cycle = -1

  for (const f of playDemo(def, { effortPhase: cfg.effortPhase, ...opts })) {
    if (f.cycle !== cycle) {
      if (cycle >= 0) results.push(analyzer.validateRep(cfg.shape))
      analyzer.markCycleBoundary()
      cycle = f.cycle
    }
    const world = smoother.smooth(jitter(f.world, opts.noise ?? 0, gauss), f.t)
    analyzer.addSample(def.measure(world), f.t)
  }
  results.push(analyzer.validateRep(cfg.shape))
  return results
}

const valid = (rs: ValidationResult[]) => rs.filter(r => r.valid).length

describe.each(Object.keys(EXERCISES))('MovementAnalyzer con %s (DEC-037)', id => {
  it.each([15, 30, 60])('técnica correcta a %i fps: 5 de 5 válidas', fps => {
    expect(valid(run(id, { fps }))).toBe(5)
  })

  it.each([8, 15])('con temblor de %i mm sigue aceptando las 5', mm => {
    expect(valid(run(id, { fps: 30, noise: mm / 1000 }))).toBe(5)
  })

  it('ritmo rápido pero controlado (×0,4) cuenta', () => {
    expect(valid(run(id, { fps: 30, speed: 0.4 }))).toBe(5)
  })

  it('un tirón brusco (×0,12) se rechaza por rápido', () => {
    const rs = run(id, { fps: 30, speed: 0.12 })
    expect(valid(rs)).toBe(0)
    expect(rs.every(r => r.reason === 'too_fast')).toBe(true)
  })

  it('un recorrido del 30 % se rechaza por recorrido insuficiente', () => {
    const rs = run(id, { fps: 30, pMax: 0.3 })
    expect(valid(rs)).toBe(0)
    expect(rs.every(r => r.reason === 'insufficient_rom')).toBe(true)
  })

  it('una fase de esfuerzo cada vez más lenta eleva la fatiga', () => {
    const fatigue = new FatigueDetector()
    const rs = run(id, { fps: 30, cycles: 8, slowdown: 0.22 })
    let state = fatigue.getState()
    for (const r of rs) if (r.valid) state = fatigue.addRep(r.metrics)
    expect(fatigue.repCount).toBeGreaterThanOrEqual(6)
    expect(state.level).not.toBe('fresh')
    expect(state.velocityDropPercent).toBeGreaterThan(10)
  })

  it('a ritmo constante la fatiga se queda en fresh', () => {
    const fatigue = new FatigueDetector()
    let state = fatigue.getState()
    for (const r of run(id, { fps: 30, cycles: 8 })) if (r.valid) state = fatigue.addRep(r.metrics)
    expect(state.level).toBe('fresh')
  })
})

describe('MovementAnalyzer: métricas', () => {
  it('separa fase concéntrica y excéntrica según la forma del ciclo', () => {
    const [r] = run('sentadilla', { fps: 60, cycles: 1 })
    // Demo: bajada 1700 ms, fondo 400 ms, subida 1200 ms. En la sentadilla la concéntrica es la subida.
    expect(r.metrics.concentricMs).toBeGreaterThan(1100)
    expect(r.metrics.concentricMs).toBeLessThan(1700)
    expect(r.metrics.eccentricMs).toBeGreaterThan(1600)
    expect(r.metrics.romDegrees).toBeGreaterThan(80)
  })

  it('recorta la pausa en reposo antes de la repetición', () => {
    const a = new MovementAnalyzer()
    a.markCycleBoundary()
    for (let t = 0; t <= 5000; t += 20) a.addSample(170, t) // 5 s quieto
    for (let t = 5020; t <= 6000; t += 20) a.addSample(170 - ((t - 5000) / 1000) * 90, t)
    for (let t = 6020; t <= 7000; t += 20) a.addSample(80 + ((t - 6000) / 1000) * 90, t)
    const r = a.validateRep({ effortIsMinimum: true, concentricFirst: false })
    expect(r.valid).toBe(true)
    expect(r.metrics.durationMs).toBeLessThan(2200)
  })

  it('rechaza por lenta una repetición más larga que el máximo', () => {
    const a = new MovementAnalyzer({ maxDurationMs: 3000 })
    a.markCycleBoundary()
    for (let t = 0; t <= 4000; t += 20) a.addSample(170 - (t / 4000) * 90, t)
    for (let t = 4020; t <= 8000; t += 20) a.addSample(80 + ((t - 4000) / 4000) * 90, t)
    expect(a.validateRep({ effortIsMinimum: true, concentricFirst: false }).reason).toBe('too_slow')
  })

  it('currentVelocity usa una ventana en ms, independiente de los fps', () => {
    for (const fps of [15, 60]) {
      const a = new MovementAnalyzer()
      for (let t = 0; t <= 1000; t += 1000 / fps) a.addSample(90 + t * 0.1, t) // 100 °/s
      expect(a.currentVelocity()).toBeCloseTo(100, 6)
    }
  })

  it('conserva historial por tiempo, no por número de muestras', () => {
    const a = new MovementAnalyzer()
    a.markCycleBoundary()
    // 25 s a 120 fps: más de 1200 muestras, pero la repetición final cabe en el horizonte.
    for (let t = 0; t <= 20000; t += 1000 / 120) a.addSample(170, t)
    for (let t = 20000; t <= 21000; t += 1000 / 120) a.addSample(170 - ((t - 20000) / 1000) * 90, t)
    for (let t = 21000; t <= 22000; t += 1000 / 120) a.addSample(80 + ((t - 21000) / 1000) * 90, t)
    expect(a.validateRep({ effortIsMinimum: true, concentricFirst: false }).valid).toBe(true)
  })

  it('los umbrales por defecto son los documentados en DEC-037', () => {
    expect(DEFAULT_THRESHOLDS).toEqual({
      minRomDegrees: 35, minDurationMs: 600, minConcentricMs: 250, maxDurationMs: 12000, minSmoothness: 0.35,
    })
  })
})

describe('countReversals', () => {
  it('ignora el temblor por debajo del umbral', () => {
    const noisy = [170, 165, 168, 150, 154, 120, 124, 90, 95, 120, 116, 170]
    expect(countReversals(noisy, 12)).toBe(1)
  })

  it('cuenta un titubeo como dos inversiones extra', () => {
    expect(countReversals([170, 130, 150, 90, 170], 12)).toBe(3)
  })
})
