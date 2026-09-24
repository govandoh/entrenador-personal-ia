import { describe, expect, it } from 'vitest'
import {
  GravityEstimator, MAX_CORRECTION_DEG, alignToGravity, alignToGravityChecked, gravityTiltDeg,
  screenDownToWorld,
} from './gravityAlign.ts'
import { LM, getTorsoInclination, type Landmark3D } from './vectors3d.ts'
import { DEMOS } from '../exercises/demoPoses.ts'
import { rotateCamera, tiltPose } from '../testing/syntheticMotion.ts'

const DEG = Math.PI / 180
const torso = (w: Landmark3D[]) =>
  getTorsoInclination(w[LM.LEFT_SHOULDER], w[LM.RIGHT_SHOULDER], w[LM.LEFT_HIP], w[LM.RIGHT_HIP])

describe('alignToGravity (DEC-050)', () => {
  const original = DEMOS.sentadilla.pose(0.8)
  const truth = torso(original)

  it.each([[25, 0], [-20, 0], [15, 12], [30, -8]])(
    'celular inclinado %i° y girado %i°: el esqueleto vuelve a la vertical',
    (pitch, roll) => {
      const tilted = tiltPose(original, pitch, roll)
      const down = rotateCamera({ x: 0, y: 1, z: 0 }, pitch, roll)
      const fixed = alignToGravity(tilted, down)

      expect(Math.abs(torso(tilted) - truth)).toBeGreaterThan(5)
      expect(Math.abs(torso(fixed) - truth)).toBeLessThan(0.5)
      // La gravedad fija la vertical pero no el giro alrededor de ella: lo que debe
      // coincidir es la altura de cada punto y su distancia horizontal a la cadera.
      const maxPointError = Math.max(...fixed.map((p, i) => Math.max(
        Math.abs(p.y - original[i].y),
        Math.abs(Math.hypot(p.x, p.z) - Math.hypot(original[i].x, original[i].z)),
      )))
      expect(maxPointError).toBeLessThan(1e-6)
    },
  )

  it('conserva la visibilidad y el resto de campos', () => {
    const fixed = alignToGravity([{ x: 0, y: 1, z: 0, visibility: 0.3 }], { x: 0.2, y: 1, z: 0 })
    expect(fixed[0].visibility).toBe(0.3)
  })

  it(`no corrige más de ${MAX_CORRECTION_DEG}° e informa que no se aplicó`, () => {
    const down = rotateCamera({ x: 0, y: 1, z: 0 }, 70, 0)
    const res = alignToGravityChecked(original, down)
    expect(res.applied).toBe(false)
    expect(res.world).toBe(original)
    expect(res.tiltDeg).toBeCloseTo(70, 6)
    expect(gravityTiltDeg(down)).toBeCloseTo(70, 6)
  })

  it('con el celular derecho no toca nada', () => {
    const res = alignToGravityChecked(original, { x: 0, y: 9.8, z: 0 })
    expect(res.applied).toBe(true)
    expect(res.tiltDeg).toBe(0)
    expect(res.world).toBe(original)
  })
})

describe('screenDownToWorld', () => {
  it.each([0, 20, -15])('cámara trasera con %i° de inclinación: ejes coherentes', pitch => {
    // Parte de arriba inclinada hacia atrás: la gravedad gana componente hacia dentro de la pantalla.
    const screenDown = { x: 0, y: -Math.cos(pitch * DEG), z: -Math.sin(pitch * DEG) }
    const rear = screenDownToWorld(screenDown, 'environment')
    const expected = rotateCamera({ x: 0, y: 1, z: 0 }, pitch, 0)
    expect(Math.hypot(rear.x - expected.x, rear.y - expected.y, rear.z - expected.z)).toBeLessThan(1e-9)
  })

  it('la cámara frontal invierte x y z respecto de la trasera', () => {
    const d = { x: 0.1, y: -0.9, z: -0.2 }
    const rear = screenDownToWorld(d, 'environment')
    const front = screenDownToWorld(d, 'user')
    expect(front).toEqual({ x: -rear.x, y: rear.y, z: -rear.z })
  })
})

describe('GravityEstimator', () => {
  it.each([['Android', 9.81], ['iPhone', -9.81]])(
    'lectura de %s con el celular en vertical da "abajo" correcto',
    (_name, gy) => {
      const est = new GravityEstimator()
      expect(est.addSample({ x: 0, y: gy as number, z: 0 }, 0, 0)).toBe(true)
      expect(est.worldDown('environment')?.y).toBeCloseTo(1, 9)
    },
  )

  it('celular acostado sobre la mesa: la lectura se descarta', () => {
    const est = new GravityEstimator()
    expect(est.addSample({ x: 0, y: 0.5, z: 9.8 }, 0, 0)).toBe(false)
    expect(est.worldDown('environment')).toBeNull()
  })

  it('sacudida brusca: la lectura se descarta', () => {
    const est = new GravityEstimator()
    expect(est.addSample({ x: 0, y: 25, z: 0 }, 0, 0)).toBe(false)
    expect(est.hasReading).toBe(false)
  })

  it('suaviza con el tiempo que recibe, no con el reloj del sistema', () => {
    const est = new GravityEstimator()
    const tilt = { x: 0, y: 9.81 * Math.cos(20 * DEG), z: 9.81 * Math.sin(20 * DEG) }
    est.addSample({ x: 0, y: 9.81, z: 0 }, 0, 0)
    est.addSample(tilt, 0, 10)
    const early = gravityTiltDeg(est.worldDown('environment')!)
    for (let t = 20; t <= 3000; t += 20) est.addSample(tilt, 0, t)
    const late = gravityTiltDeg(est.worldDown('environment')!)
    expect(early).toBeLessThan(2)
    expect(late).toBeCloseTo(20, 0)
  })

  it('compensa la rotación de la pantalla', () => {
    const est = new GravityEstimator()
    // Pantalla girada 90°: el sensor ve la gravedad sobre su eje x.
    est.addSample({ x: 9.81, y: 0, z: 0 }, 90, 0)
    expect(est.worldDown('environment')?.y).toBeCloseTo(1, 9)
  })
})
