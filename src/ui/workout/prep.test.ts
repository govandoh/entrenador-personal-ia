import { describe, expect, it } from 'vitest'
import { bodyInFrame, bubbleOffset, isReady, phoneTilt, LEVEL_OK_DEG } from './prep'
import { LM } from '../../geometry/vectors3d'

const visibleAll = Array.from({ length: 33 }, () => ({ visibility: 0.9 }))

describe('preparación de la serie', () => {
  it('cuerpo en cuadro: basta un lado visible de cada par (vista lateral)', () => {
    expect(bodyInFrame(visibleAll, 'squat')).toBe(true)
    const side = visibleAll.map((l, i) => (i === LM.RIGHT_KNEE || i === LM.RIGHT_ANKLE ? { visibility: 0.1 } : l))
    expect(bodyInFrame(side, 'squat')).toBe(true)
    const noFeet = visibleAll.map((l, i) => (i === LM.LEFT_ANKLE || i === LM.RIGHT_ANKLE ? { visibility: 0.1 } : l))
    expect(bodyInFrame(noFeet, 'squat')).toBe(false)
    // El curl no necesita los pies.
    expect(bodyInFrame(noFeet, 'curl')).toBe(true)
    expect(bodyInFrame(null, 'squat')).toBe(false)
  })

  it('la burbuja está al centro con el celular vertical y se aleja del lado que baja, sin salir del círculo', () => {
    expect(bubbleOffset({ x: 0, y: 1, z: 0 }, 40)).toEqual({ x: -0, y: 0 })
    const tilted = bubbleOffset({ x: 0.2, y: 0.98, z: 0 }, 40)
    expect(tilted.x).toBeLessThan(0)
    const far = bubbleOffset({ x: 0.9, y: 0.1, z: 0.9 }, 40)
    expect(Math.hypot(far.x, far.y)).toBeCloseTo(40, 5)
    expect(bubbleOffset(null, 40)).toEqual({ x: 0, y: 0 })
  })

  it('inclinación del celular en grados y umbral de nivelado', () => {
    expect(phoneTilt({ x: 0, y: 1, z: 0 })).toBeCloseTo(0)
    const s = Math.sin((LEVEL_OK_DEG + 5) * Math.PI / 180)
    expect(phoneTilt({ x: s, y: Math.cos((LEVEL_OK_DEG + 5) * Math.PI / 180), z: 0 })).toBeGreaterThan(LEVEL_OK_DEG)
    expect(phoneTilt(null)).toBeNull()
  })

  it('lista: sin sensor no se exige la nivelación; en 3D hace falta la calibración completa', () => {
    expect(isReady({ levelOk: null, bodyOk: true, calibration: null })).toBe(true)
    expect(isReady({ levelOk: false, bodyOk: true, calibration: null })).toBe(false)
    expect(isReady({ levelOk: true, bodyOk: true, calibration: 0.7 })).toBe(false)
    expect(isReady({ levelOk: true, bodyOk: true, calibration: 1 })).toBe(true)
    expect(isReady({ levelOk: true, bodyOk: false, calibration: 1 })).toBe(false)
  })
})
