import { describe, expect, it } from 'vitest'
import { FeedbackPolicy, REJECTION_SPEECH_MIN_MS, REP_SPEECH_MIN_MS, repPhrase, type FeedbackEvent } from './feedbackPolicy.ts'

const ev = (now: number, over: Partial<FeedbackEvent> = {}): FeedbackEvent =>
  ({ now, reps: 0, repCounted: false, peakPhrase: null, ...over })

describe('repPhrase', () => {
  it('dice "Una", números y ánimo cada 5 y cada 10', () => {
    expect(repPhrase(1)).toBe('Una')
    expect(repPhrase(3)).toBe('3')
    expect(repPhrase(5)).toBe('5. ¡Sigue así!')
    expect(repPhrase(10)).toBe('10. ¡Excelente ritmo!')
  })
})

describe('FeedbackPolicy mid-range-peak (sentadilla, DEC-016)', () => {
  it('dice la técnica en el fondo y el número al subir', () => {
    const p = new FeedbackPolicy('mid-range-peak')
    expect(p.decide(ev(0, { peakPhrase: '¡Excelente profundidad!' }))).toEqual(['¡Excelente profundidad!'])
    expect(p.decide(ev(REP_SPEECH_MIN_MS + 1, { reps: 1, repCounted: true }))).toEqual(['Una'])
  })

  it('no dice el número si la frase del fondo fue hace menos de 1,5 s (no pisar la voz)', () => {
    const p = new FeedbackPolicy('mid-range-peak')
    p.decide(ev(0, { peakPhrase: 'Baja un poco más' }))
    expect(p.decide(ev(900, { reps: 1, repCounted: true }))).toEqual([])
  })

  it('en el frame en que se cuenta la rep, la frase de pico se ignora', () => {
    const p = new FeedbackPolicy('mid-range-peak')
    expect(p.decide(ev(5000, { reps: 2, repCounted: true, peakPhrase: 'x' }))).toEqual(['2'])
  })
})

describe('FeedbackPolicy peak-at-end-of-effort (curl y press, DEC-016)', () => {
  it('guarda la frase del pico y la dice junto con el número', () => {
    const p = new FeedbackPolicy('peak-at-end-of-effort')
    expect(p.decide(ev(0, { peakPhrase: '¡Excelente contracción!' }))).toEqual([])
    expect(p.decide(ev(400, { reps: 3, repCounted: true }))).toEqual(['3. ¡Excelente contracción!'])
    // La frase se consume: la siguiente rep sin pico solo dice el número.
    expect(p.decide(ev(3000, { reps: 4, repCounted: true }))).toEqual(['4'])
  })

  it('no limita el número por tiempo (cada rep se anuncia)', () => {
    const p = new FeedbackPolicy('peak-at-end-of-effort')
    expect(p.decide(ev(0, { reps: 1, repCounted: true }))).toEqual(['Una'])
    expect(p.decide(ev(300, { reps: 2, repCounted: true }))).toEqual(['2'])
  })

  it('setStrategy cambia de ejercicio sin olvidar cuándo habló (una sola voz por sesión)', () => {
    const p = new FeedbackPolicy('peak-at-end-of-effort')
    p.decide(ev(0, { peakPhrase: 'Sube un poco más' }))
    p.decide(ev(200, { reps: 1, repCounted: true }))
    p.setStrategy('mid-range-peak')
    // La sentadilla no pisa la frase del curl dicha hace 1 s.
    expect(p.decide(ev(1200, { reps: 1, repCounted: true }))).toEqual([])
    expect(p.decide(ev(1800, { reps: 2, repCounted: true }))).toEqual(['2'])
  })

  it('reset descarta la frase pendiente', () => {
    const p = new FeedbackPolicy('peak-at-end-of-effort')
    p.decide(ev(0, { peakPhrase: 'Sube un poco más' }))
    p.reset()
    expect(p.decide(ev(500, { reps: 1, repCounted: true }))).toEqual(['Una'])
  })
})

describe('FeedbackPolicy: repeticiones descartadas (motor 3D)', () => {
  it('anuncia el motivo como mucho una vez cada 2 s', () => {
    const p = new FeedbackPolicy('peak-at-end-of-effort')
    const msg = 'Movimiento muy rápido, controla el recorrido'
    expect(p.decide(ev(10_000, { rejectionMessage: msg }))).toEqual([msg])
    expect(p.decide(ev(10_000 + REJECTION_SPEECH_MIN_MS - 1, { rejectionMessage: msg }))).toEqual([])
    expect(p.decide(ev(10_000 + REJECTION_SPEECH_MIN_MS + 1, { rejectionMessage: msg }))).toEqual([msg])
  })

  it('una rep contada tiene prioridad sobre un descarte en el mismo frame', () => {
    const p = new FeedbackPolicy('mid-range-peak')
    expect(p.decide(ev(9000, { reps: 1, repCounted: true, rejectionMessage: 'x' }))).toEqual(['Una'])
  })
})
