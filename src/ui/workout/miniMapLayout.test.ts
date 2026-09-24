import { describe, expect, it } from 'vitest'
import { EDGE_GAP, TOP_BAR, place, snap } from './miniMapLayout'

const phone = { width: 393, height: 852 }
const panel = { width: 132, height: 200 }
const island = { top: 59, right: 0, bottom: 34, left: 0 }

describe('posición del mini mapa 3D', () => {
  it('se coloca dentro del área segura, debajo de la barra superior', () => {
    const top = place({ side: 'left', y: 0 }, phone, panel, island)
    expect(top).toEqual({ x: EDGE_GAP, y: 59 + TOP_BAR })
    const bottomRight = place({ side: 'right', y: 1 }, phone, panel, island)
    expect(bottomRight.x + panel.width).toBe(phone.width - EDGE_GAP)
    expect(bottomRight.y + panel.height).toBe(phone.height - 34 - EDGE_GAP)
  })

  it('al soltarlo se ancla al lado más cercano y no sale de la zona útil', () => {
    const s = snap(250, 5000, phone, panel, island)
    expect(s.placement.side).toBe('right')
    expect(s.placement.y).toBe(1)
    const l = snap(20, -50, phone, panel, island)
    expect(l.placement).toEqual({ side: 'left', y: 0 })
    expect(l.x).toBe(EDGE_GAP)
  })

  it('respeta el notch en horizontal y una pantalla más baja que el panel', () => {
    const landscape = { width: 852, height: 393 }
    const notch = { top: 0, right: 59, bottom: 21, left: 59 }
    expect(place({ side: 'left', y: 0.5 }, landscape, panel, notch).x).toBe(59 + EDGE_GAP)
    const tiny = place({ side: 'right', y: 1 }, { width: 320, height: 200 }, panel, { top: 0, right: 0, bottom: 0, left: 0 })
    expect(tiny.y).toBe(TOP_BAR)
  })

  it('nunca tapa los controles de abajo (tarjeta de preparación o panel de la serie)', () => {
    const floor = 520
    const low = place({ side: 'right', y: 1 }, phone, panel, island, floor)
    expect(low.y + panel.height).toBe(floor - EDGE_GAP)
    const dropped = snap(300, 700, phone, panel, island, floor)
    expect(dropped.y + panel.height).toBeLessThanOrEqual(floor)
  })

  it('la posición guardada sobrevive al giro del celular', () => {
    const s = snap(10, 400, phone, panel, island)
    const again = place(s.placement, { width: 852, height: 393 }, panel, { top: 0, right: 59, bottom: 21, left: 59 })
    expect(again.x).toBe(59 + EDGE_GAP)
    expect(again.y).toBeGreaterThanOrEqual(TOP_BAR)
  })
})
