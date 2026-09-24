import { describe, expect, it } from 'vitest'
import { StandingCalibrator, isStandingStraight } from './standingCalibration'
import { alignToGravity } from './gravityAlign'
import { LandmarkSmoother } from './landmarkFilter'
import { LM, getTorsoInclination, type Landmark3D } from './vectors3d'
import { DEMOS } from '../exercises/demoPoses'
import { playDemo, rotateCamera, tiltPose } from '../testing/syntheticMotion'

/** Error de profundidad del modelo observado en la primera prueba real de fitnetv2 (DEC-053). */
const MODEL_TILT = 20
const torso = (w: Landmark3D[]) =>
  getTorsoInclination(w[LM.LEFT_SHOULDER], w[LM.RIGHT_SHOULDER], w[LM.LEFT_HIP], w[LM.RIGHT_HIP])
const standing = DEMOS.sentadilla.pose(0)

describe('isStandingStraight', () => {
  it('de pie con piernas estiradas cuenta como postura de calibración, también inclinada', () => {
    expect(isStandingStraight(standing)).toBe(true)
    expect(isStandingStraight(tiltPose(standing, MODEL_TILT, 0))).toBe(true)
  })

  it('el fondo de la sentadilla no cuenta', () => {
    expect(isStandingStraight(DEMOS.sentadilla.pose(0.8))).toBe(false)
  })

  it('exige visibilidad de piernas y tronco', () => {
    const hidden = standing.map((p, i) => (i === LM.LEFT_ANKLE ? { ...p, visibility: 0.2 } : p))
    expect(isStandingStraight(hidden)).toBe(false)
  })
})

describe('StandingCalibrator (DEC-053)', () => {
  /** Sentadilla completa con el error del modelo; devuelve la inclinación máxima del tronco de pie. */
  function runTiltedSquat(calibrate: boolean) {
    const smoother = new LandmarkSmoother()
    const cal = new StandingCalibrator()
    let maxStandingLean = 0
    for (const f of playDemo(DEMOS.sentadilla, { fps: 30, cycles: 5 })) {
      let w = smoother.smooth(tiltPose(f.world, MODEL_TILT, 0), f.t)
      if (calibrate) {
        cal.update(w, f.t)
        w = cal.apply(w)
      }
      if (f.p === 0 && f.t > 1000) maxStandingLean = Math.max(maxStandingLean, torso(w))
    }
    return { maxStandingLean, correction: cal.correctionDeg }
  }

  it('sin calibrar, el tronco de pie aparece inclinado el error del modelo', () => {
    expect(runTiltedSquat(false).maxStandingLean).toBeGreaterThan(15)
  })

  it('calibrado, el tronco de pie vuelve a la vertical y la corrección mide el error', () => {
    const { maxStandingLean, correction } = runTiltedSquat(true)
    expect(maxStandingLean).toBeLessThan(5)
    expect(correction).not.toBeNull()
    expect(Math.abs(correction! - MODEL_TILT)).toBeLessThan(3)
  })

  it('sin estar de pie no se calibra', () => {
    const cal = new StandingCalibrator()
    const bottom = tiltPose(DEMOS.sentadilla.pose(0.8), MODEL_TILT, 0)
    for (let t = 0; t < 3000; t += 33) cal.update(bottom, t)
    expect(cal.calibrated).toBe(false)
    expect(cal.apply(bottom)).toBe(bottom)
  })

  it('una desviación de 50° no se toma como error del modelo', () => {
    const cal = new StandingCalibrator()
    const far = tiltPose(standing, 50, 0)
    for (let t = 0; t < 3000; t += 33) cal.update(far, t)
    expect(cal.calibrated).toBe(false)
  })

  it('necesita 500 ms de pie antes de aplicar', () => {
    const cal = new StandingCalibrator()
    const w = tiltPose(standing, MODEL_TILT, 0)
    for (let t = 0; t <= 400; t += 33) cal.update(w, t)
    expect(cal.calibrated).toBe(false)
    for (let t = 433; t <= 700; t += 33) cal.update(w, t)
    expect(cal.calibrated).toBe(true)
  })

  it('celular inclinado 15° más el error del modelo: nivelar y calibrar deja el tronco vertical', () => {
    const cal = new StandingCalibrator()
    const phoneDown = rotateCamera({ x: 0, y: 1, z: 0 }, 15, 0)
    const raw = tiltPose(tiltPose(standing, MODEL_TILT, 0), 15, 0)
    let w: Landmark3D[] = raw
    for (let t = 0; t < 2000; t += 33) {
      w = alignToGravity(raw, phoneDown)
      cal.update(w, t)
    }
    // La demo de pie ya tiene 3° de inclinación de tronco: se compara contra esa referencia.
    expect(Math.abs(torso(cal.apply(w)) - torso(standing))).toBeLessThan(1)
  })

  it('setLearning(false) congela la calibración vigente (p. ej. durante el press)', () => {
    const cal = new StandingCalibrator()
    const w = tiltPose(standing, MODEL_TILT, 0)
    for (let t = 0; t < 1500; t += 33) cal.update(w, t)
    const before = cal.correctionDeg!

    cal.setLearning(false)
    const other = tiltPose(standing, 5, 0)
    for (let t = 1500; t < 6000; t += 33) cal.update(other, t)
    expect(cal.correctionDeg).toBeCloseTo(before, 9)

    cal.setLearning(true)
    for (let t = 6000; t < 12000; t += 33) cal.update(other, t)
    expect(cal.correctionDeg!).toBeLessThan(before - 10)
  })
})
