import { describe, expect, it } from 'vitest'
import { CycleDetector, type CycleConfig, type CycleUpdate } from './cycleDetector.ts'

const feed = (d: CycleDetector, angles: number[]): CycleUpdate[] => angles.map(a => d.update(a))

const SQUAT: CycleConfig = { polarity: 'min', restDeg: 160, effortDeg: 100, confirmMarginDeg: 8 }
const PRESS: CycleConfig = { polarity: 'max', restDeg: 100, effortDeg: 150, confirmMarginDeg: 8 }

describe('CycleDetector', () => {
  it('polaridad min: entra en esfuerzo, confirma el fondo con el margen y cierra el ciclo', () => {
    const u = feed(new CycleDetector(SQUAT), [170, 130, 95, 85, 80, 84, 89, 120, 165])
    expect(u.findIndex(x => x.cycleStarted)).toBe(2)
    expect(u.findIndex(x => x.peakConfirmed)).toBe(6) // 89 ≥ 80 + 8
    expect(u.filter(x => x.peakConfirmed)).toHaveLength(1)
    expect(u.findIndex(x => x.cycleCompleted)).toBe(8)
    expect(u[8].extremeDeg).toBe(80)
  })

  it('polaridad max: el pico es el ángulo máximo', () => {
    const u = feed(new CycleDetector(PRESS), [90, 120, 155, 168, 172, 163, 130, 95])
    expect(u.findIndex(x => x.peakConfirmed)).toBe(5) // 163 ≤ 172 − 8
    expect(u.findIndex(x => x.cycleCompleted)).toBe(7)
  })

  it('la confirmación no depende de cuántos frames haya (subida de 0,1° por frame)', () => {
    const angles = [170, 95, 80, ...Array.from({ length: 200 }, (_, i) => 80 + i * 0.1), 170]
    const u = feed(new CycleDetector(SQUAT), angles)
    expect(u.some(x => x.peakConfirmed)).toBe(true)
    expect(u[u.length - 1].cycleCompleted).toBe(true)
  })

  it('sin confirmar el fondo, volver al reposo no cierra el ciclo', () => {
    // Baja a 95 y vuelve sin alejarse 8° del mínimo dentro de la fase de esfuerzo.
    const u = feed(new CycleDetector(SQUAT), [170, 99, 98, 165])
    expect(u.some(x => x.cycleCompleted)).toBe(false)
  })

  it('el gate de recorrido inicial exige haber partido lo bastante extendido', () => {
    const cfg: CycleConfig = { polarity: 'min', restDeg: 160, effortDeg: 60, confirmMarginDeg: 8, minStartDeg: 130 }
    // Arranca ya a mitad de recorrido (sin haber pasado por 130°): no cuenta.
    const partial = feed(new CycleDetector(cfg), [90, 55, 45, 60, 165])
    expect(partial.some(x => x.cycleCompleted)).toBe(false)
    // Desde brazo extendido sí.
    const full = feed(new CycleDetector(cfg), [170, 100, 55, 45, 60, 165])
    expect(full.some(x => x.cycleCompleted)).toBe(true)
  })

  it('la zona intermedia conserva la fase (histéresis)', () => {
    const d = new CycleDetector(SQUAT)
    feed(d, [170, 95])
    expect(d.update(130).phase).toBe('effort')
    feed(d, [170])
    expect(d.update(130).phase).toBe('rest')
  })
})
