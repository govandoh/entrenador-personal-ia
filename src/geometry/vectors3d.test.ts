import { describe, expect, it } from 'vitest'
import {
  LM, angleBetween, areVisible, asymmetryRatio, calculateAngle3D, getBodyOrientation,
  getTorsoInclination, type Vec3,
} from './vectors3d.ts'
import { DEMOS } from '../exercises/demoPoses.ts'
import { tiltPose } from '../testing/syntheticMotion.ts'

const o: Vec3 = { x: 0, y: 0, z: 0 }

describe('calculateAngle3D', () => {
  it('devuelve 90° para segmentos ortogonales en cualquier plano', () => {
    expect(calculateAngle3D({ x: 1, y: 0, z: 0 }, o, { x: 0, y: 1, z: 0 })).toBeCloseTo(90, 9)
    expect(calculateAngle3D({ x: 0, y: 0, z: 1 }, o, { x: 0, y: 1, z: 0 })).toBeCloseTo(90, 9)
  })

  it('no produce NaN con puntos colineales (clamp del coseno)', () => {
    const a = calculateAngle3D({ x: 0.1, y: 0.2, z: 0.3 }, o, { x: -0.1, y: -0.2, z: -0.3 })
    expect(a).toBeCloseTo(180, 6)
    expect(calculateAngle3D({ x: 1e-9, y: 0, z: 0 }, o, { x: 3, y: 0, z: 0 })).toBeCloseTo(0, 6)
  })

  it('devuelve 0 si un segmento tiene longitud cero', () => {
    expect(calculateAngle3D(o, o, { x: 1, y: 0, z: 0 })).toBe(0)
  })

  it('es invariante a la rotación de la cámara (a diferencia del ángulo 2D)', () => {
    const pose = DEMOS.sentadilla.pose(0.8)
    const tilted = tiltPose(pose, 25, 10)
    const knee = (w: Vec3[]) => calculateAngle3D(w[LM.LEFT_HIP], w[LM.LEFT_KNEE], w[LM.LEFT_ANKLE])
    expect(knee(tilted)).toBeCloseTo(knee(pose), 9)
  })
})

describe('getBodyOrientation', () => {
  const at = (yawDeg: number) => {
    const r = (yawDeg * Math.PI) / 180
    return getBodyOrientation(
      { x: 0.18 * Math.cos(r), y: 0, z: 0.18 * Math.sin(r) },
      { x: -0.18 * Math.cos(r), y: 0, z: -0.18 * Math.sin(r) },
    )
  }

  it('clasifica frente, diagonal y perfil por el yaw de los hombros', () => {
    expect(at(0).orientation).toBe('frontal')
    expect(at(45).orientation).toBe('diagonal')
    expect(at(80).orientation).toBe('lateral')
    expect(at(45).yawDegrees).toBeCloseTo(45, 6)
  })

  it('indica hacia dónde mira de perfil', () => {
    expect(at(85).facing).not.toBe('camera')
    expect(at(0).facing).toBe('camera')
  })
})

describe('getTorsoInclination', () => {
  const torso = (w: Vec3[]) =>
    getTorsoInclination(w[LM.LEFT_SHOULDER], w[LM.RIGHT_SHOULDER], w[LM.LEFT_HIP], w[LM.RIGHT_HIP])

  it('marca el tronco erguido de pie y la inclinación en el fondo de la sentadilla', () => {
    expect(torso(DEMOS.sentadilla.pose(0))).toBeLessThan(5)
    expect(torso(DEMOS.sentadilla.pose(1))).toBeGreaterThan(30)
  })

  it('depende de la vertical: una cámara inclinada 20° desplaza la medida ~20°', () => {
    const standing = DEMOS.sentadilla.pose(0)
    expect(torso(tiltPose(standing, 20, 0)) - torso(standing)).toBeGreaterThan(15)
  })
})

describe('utilidades', () => {
  it('asymmetryRatio es relativa al promedio y 0 con valores iguales', () => {
    expect(asymmetryRatio(100, 100)).toBe(0)
    expect(asymmetryRatio(110, 90)).toBeCloseTo(0.2, 9)
    expect(asymmetryRatio(0, 0)).toBe(0)
  })

  it('areVisible exige el umbral en todos los índices', () => {
    const lms = [{ visibility: 0.9 }, { visibility: 0.4 }, {}]
    expect(areVisible(lms, [0])).toBe(true)
    expect(areVisible(lms, [0, 1])).toBe(false)
    expect(areVisible(lms, [2])).toBe(false)
  })

  it('angleBetween mide vectores libres', () => {
    expect(angleBetween({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -2 })).toBeCloseTo(90, 9)
  })
})
