import { describe, expect, it } from 'vitest'
import { NODE_COUNT, litNodes } from './nodeRingMath'

describe('anillo de 33 nodos', () => {
  it('enciende nodos en proporción al progreso, al menos uno si hubo avance y nunca más de 33', () => {
    expect(litNodes(0)).toBe(0)
    expect(litNodes(0.001)).toBe(1)
    expect(litNodes(0.79)).toBe(26)
    expect(litNodes(1)).toBe(NODE_COUNT)
    expect(litNodes(2.5)).toBe(NODE_COUNT)
    expect(litNodes(-1)).toBe(0)
  })
})
