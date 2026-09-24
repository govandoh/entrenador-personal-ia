import { describe, expect, it } from 'vitest'
import {
  dayKey, dayStats, isSetRecord, lastSet, streakDays, totals, weekActivity, type SetRecord,
} from './sessionHistory.ts'
import { MockPaymentProvider, isEntitlement, FREE_ENTITLEMENT } from './payment.ts'

let n = 0
function rec(date: Date, validReps: number, goodReps = validReps, extra: Partial<SetRecord> = {}): SetRecord {
  return {
    id: `r${n++}`, completedAt: date.toISOString(), exerciseId: 'sentadilla',
    validReps, rejectedReps: 0, goodReps, timed: false, fatigue: null, ...extra,
  }
}
/** Miércoles 24 de septiembre de 2026, 10:00 hora local. */
const NOW = new Date(2026, 8, 24, 10, 0)
const day = (offset: number, h = 9) => new Date(2026, 8, 24 + offset, h, 0)

describe('sessionHistory', () => {
  it('dayKey usa la hora local', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('dayStats suma solo el día pedido y calcula la técnica ponderada; la plancha no suma repeticiones', () => {
    const rs = [
      rec(day(0), 10, 8), rec(day(0, 11), 12, 12),
      rec(day(0, 12), 30, 30, { timed: true, exerciseId: 'plancha' }),
      rec(day(-1), 20, 5),
    ]
    expect(dayStats(rs, NOW)).toEqual({ sets: 3, reps: 22, techniquePct: 91 })
    expect(dayStats([], NOW)).toEqual({ sets: 0, reps: 0, techniquePct: null })
  })

  it('weekActivity marca de lunes a domingo la semana en curso', () => {
    // Lunes 21, miércoles 23 y jueves... solo 21 y 23 dentro de la semana; el 20 es domingo anterior.
    const rs = [rec(day(-3), 5), rec(day(-1), 5), rec(day(-4), 5)]
    expect(weekActivity(rs, NOW)).toEqual([true, false, true, false, false, false, false])
  })

  it('la racha cuenta hasta ayer si hoy todavía no se entrenó, y se corta con un día vacío', () => {
    expect(streakDays([rec(day(-1), 5), rec(day(-2), 5), rec(day(-4), 5)], NOW)).toBe(2)
    expect(streakDays([rec(day(0), 5), rec(day(-1), 5)], NOW)).toBe(2)
    expect(streakDays([rec(day(-2), 5)], NOW)).toBe(0)
  })

  it('lastSet y totals', () => {
    const a = rec(day(-2), 5)
    const b = rec(day(0), 7)
    expect(lastSet([b, a])).toBe(b)
    expect(lastSet([])).toBeNull()
    expect(totals([a, b, rec(day(0), 20, 20, { timed: true })])).toEqual({ sets: 3, reps: 12, activeDays: 2 })
  })

  it('isSetRecord rechaza registros mal formados', () => {
    expect(isSetRecord(rec(day(0), 5))).toBe(true)
    expect(isSetRecord({ ...rec(day(0), 5), completedAt: 'ayer' })).toBe(false)
    expect(isSetRecord({ ...rec(day(0), 5), fatigue: 'extrema' })).toBe(false)
    expect(isSetRecord(null)).toBe(false)
  })
})

describe('MockPaymentProvider (pago simulado, regla dura 8)', () => {
  it('aprueba sin datos de tarjeta y marca la suscripción como simulada', async () => {
    const r = await new MockPaymentProvider().checkout('premium', NOW)
    expect(r.status).toBe('approved')
    expect(r.entitlement).toEqual({ premium: true, since: NOW.toISOString(), simulated: true })
    expect(r.receiptId).toMatch(/^SIM-PREMIUM-/)
    expect(isEntitlement(r.entitlement)).toBe(true)
  })

  it('cancelar vuelve al plan libre', async () => {
    expect(await new MockPaymentProvider().cancel()).toEqual(FREE_ENTITLEMENT)
    expect(isEntitlement({ premium: true, since: null, simulated: false })).toBe(false)
  })
})
