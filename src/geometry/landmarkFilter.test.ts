import { describe, expect, it } from 'vitest'
import { LandmarkSmoother, OneEuroFilter } from './landmarkFilter'
import { DEMOS } from '../exercises/demoPoses'
import { jitter, seededGauss } from '../testing/syntheticMotion'
import { LM } from './vectors3d'

function std(values: number[]): number {
  const m = values.reduce((a, v) => a + v, 0) / values.length
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / values.length)
}

describe('LandmarkSmoother (One Euro, DEC-046)', () => {
  it('reduce el temblor de 15 mm con la persona quieta', () => {
    const gauss = seededGauss()
    const smoother = new LandmarkSmoother()
    const pose = DEMOS.sentadilla.pose(0)
    const raw: number[] = []
    const smooth: number[] = []
    for (let f = 0; f < 120; f++) {
      const noisy = jitter(pose, 0.015, gauss)
      const out = smoother.smooth(noisy, f * 33.3)
      if (f >= 20) {
        raw.push(noisy[LM.LEFT_WRIST].x)
        smooth.push(out[LM.LEFT_WRIST].x)
      }
    }
    expect(std(smooth)).toBeLessThan(std(raw) * 0.5)
  })

  it('sigue un movimiento rápido sin retraso excesivo', () => {
    const f = new OneEuroFilter()
    const dt = 1 / 30
    let out = 0
    // Rampa de 1 m/s durante 0,5 s.
    for (let i = 0; i <= 15; i++) out = f.filter(i * dt, dt)
    expect(0.5 - out).toBeLessThan(0.1)
  })

  it('no suaviza la visibilidad y conserva los demás campos', () => {
    const smoother = new LandmarkSmoother()
    smoother.smooth([{ x: 0, y: 0, z: 0, visibility: 0.9 }], 0)
    const out = smoother.smooth([{ x: 1, y: 0, z: 0, visibility: 0.1 }], 33)
    expect(out[0].visibility).toBe(0.1)
    expect(out[0].x).toBeLessThan(1)
  })

  it('se reinicia tras una pausa de más de 500 ms o un tiempo que retrocede', () => {
    const smoother = new LandmarkSmoother()
    smoother.smooth([{ x: 0, y: 0, z: 0 }], 0)
    smoother.smooth([{ x: 0, y: 0, z: 0 }], 33)
    expect(smoother.smooth([{ x: 1, y: 1, z: 1 }], 700)[0].x).toBe(1)
    expect(smoother.smooth([{ x: 2, y: 2, z: 2 }], 100)[0].x).toBe(2)
  })
})
