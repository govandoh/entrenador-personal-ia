import { describe, expect, it } from 'vitest'
import { calculateAngle, type Point2D } from './angles.ts'

/** Forma estructural de NormalizedLandmark de MediaPipe (x, y, z, visibility). */
interface LandmarkLike extends Point2D {
  z: number
  visibility: number
}

describe('calculateAngle', () => {
  it('devuelve 90° para un ángulo recto', () => {
    const A: Point2D = { x: 0, y: 1 }
    const B: Point2D = { x: 0, y: 0 }
    const C: Point2D = { x: 1, y: 0 }
    expect(calculateAngle(A, B, C)).toBeCloseTo(90, 6)
  })

  it('devuelve 180° para puntos colineales con B en el medio', () => {
    const A: Point2D = { x: -1, y: 0 }
    const B: Point2D = { x: 0, y: 0 }
    const C: Point2D = { x: 1, y: 0 }
    expect(calculateAngle(A, B, C)).toBeCloseTo(180, 6)
  })

  it('devuelve 0° cuando A y C están en la misma dirección desde B', () => {
    const A: Point2D = { x: 2, y: 2 }
    const B: Point2D = { x: 0, y: 0 }
    const C: Point2D = { x: 1, y: 1 }
    expect(calculateAngle(A, B, C)).toBeCloseTo(0, 6)
  })

  it('devuelve 45° para un ángulo agudo conocido', () => {
    const A: Point2D = { x: 1, y: 0 }
    const B: Point2D = { x: 0, y: 0 }
    const C: Point2D = { x: 1, y: 1 }
    expect(calculateAngle(A, B, C)).toBeCloseTo(45, 6)
  })

  it('devuelve 60° para un triángulo equilátero', () => {
    const A: Point2D = { x: 1, y: 0 }
    const B: Point2D = { x: 0, y: 0 }
    const C: Point2D = { x: 0.5, y: Math.sqrt(3) / 2 }
    expect(calculateAngle(A, B, C)).toBeCloseTo(60, 6)
  })

  it('es simétrico: (A, B, C) y (C, B, A) dan el mismo resultado', () => {
    const A: Point2D = { x: 0.3, y: 0.9 }
    const B: Point2D = { x: 0.5, y: 0.5 }
    const C: Point2D = { x: 0.8, y: 0.6 }
    expect(calculateAngle(A, B, C)).toBeCloseTo(calculateAngle(C, B, A), 10)
  })

  it('nunca excede 180° aunque el giro cruce el eje de atan2', () => {
    // A y C en cuadrantes opuestos respecto a B, con un ángulo reflejo en sentido horario.
    const A: Point2D = { x: -1, y: -0.1 }
    const B: Point2D = { x: 0, y: 0 }
    const C: Point2D = { x: -1, y: 0.1 }
    const angle = calculateAngle(A, B, C)
    expect(angle).toBeGreaterThanOrEqual(0)
    expect(angle).toBeLessThanOrEqual(180)
    expect(angle).toBeCloseTo(2 * (Math.atan(0.1) * 180) / Math.PI, 6)
  })

  it('acepta objetos con campos extra tipo NormalizedLandmark (compatibilidad estructural)', () => {
    const hip: LandmarkLike = { x: 0.5, y: 0.4, z: -0.2, visibility: 0.98 }
    const knee: LandmarkLike = { x: 0.5, y: 0.6, z: -0.1, visibility: 0.95 }
    const ankle: LandmarkLike = { x: 0.7, y: 0.6, z: 0.05, visibility: 0.9 }
    // Pierna en L: cadera arriba de la rodilla, tobillo a la derecha de la rodilla.
    expect(calculateAngle(hip, knee, ankle)).toBeCloseTo(90, 6)
  })
})
