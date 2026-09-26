import { describe, expect, it } from 'vitest'
import { SetSummaryBuilder, FORM_ISSUE_LABELS } from './setSummary.ts'
import { FramePipeline } from './framePipeline.ts'
import { SQUAT_3D } from '../exercises/definitions3d.ts'
import { DEMOS } from '../exercises/demoPoses.ts'
import { playDemo, type PlayOptions } from '../testing/syntheticMotion.ts'
import type { Tracker3DResult } from '../exercises/tracker3d.ts'
import { FRESH_FATIGUE } from './fatigue.ts'

function squatSet(opts: PlayOptions) {
  const pipeline = new FramePipeline(SQUAT_3D)
  const demo = DEMOS.sentadilla
  const frames = playDemo(demo, { fps: 30, ...opts })
  const tail = frames[frames.length - 1].t
  for (let i = 1; i <= 30; i++) frames.push({ t: tail + (i * 1000) / 30, p: 0, cycle: -1, world: demo.pose(0) })
  const b = new SetSummaryBuilder()
  for (const f of frames) b.addFrame(pipeline.process({ world: f.world, t: f.t }).result)
  return b.summary()
}

describe('SetSummaryBuilder', () => {
  it('cuenta las repeticiones válidas del contador 3D con su duración y velocidad', () => {
    const s = squatSet({ cycles: 6 })
    expect(s.validReps).toBe(6)
    expect(s.rejectedReps).toBe(0)
    expect(s.reps.every(r => r.concentricMs !== null && r.concentricMs > 0)).toBe(true)
    expect(s.goodReps).toBeGreaterThan(0)
  })

  it('con fatiga simulada la velocidad cae entre el principio y el final de la serie', () => {
    const s = squatSet({ cycles: 8, slowdown: 0.12, effortPhase: 3 })
    expect(s.velocityDropPercent).not.toBeNull()
    expect(s.velocityDropPercent!).toBeGreaterThan(10)
  })

  it('los tirones se registran como descartados, no como repeticiones', () => {
    const s = squatSet({ cycles: 5, speed: 0.12 })
    expect(s.validReps).toBe(0)
    expect(s.rejectedReps).toBeGreaterThan(0)
  })

  it('la calidad de la repetición es el aviso del pico, y los problemas de forma se cuentan por código', () => {
    const base = { exerciseId: 'squat', reps: 0, visible: true, phase: 'rest', primaryAngle: 170, extremeDeg: 80,
      peak: false, repCounted: false, rejection: null, rejectionMessage: null, feedbackLevel: 'good', feedbackMessage: '',
      formIssue: null, orientation: 'side', fatigue: FRESH_FATIGUE, lastRepMetrics: null, velocity: 0, asymmetry: 0,
      activeSides: [], keyFrame: null } as unknown as Tracker3DResult
    const b = new SetSummaryBuilder()
    b.addFrame({ ...base, peak: true, feedbackLevel: 'bad', formIssue: 'trunk_lean' })
    b.addFrame({ ...base, repCounted: true, reps: 1 })
    b.addFrame({ ...base, peak: true, feedbackLevel: 'good' })
    b.addFrame({ ...base, repCounted: true, reps: 2 })
    const s = b.summary()
    expect(s.reps.map(r => r.quality)).toEqual(['bad', 'good'])
    expect(s.goodReps).toBe(1)
    expect(s.formIssues).toEqual({ trunk_lean: 1 })
    expect(FORM_ISSUE_LABELS.trunk_lean).toBeTruthy()
    expect(s.velocityDropPercent).toBeNull()
  })

  it('motor 2D: una repetición por llamada, sin métricas de tiempo', () => {
    const b = new SetSummaryBuilder()
    b.addRep2D('good')
    b.addRep2D('warning')
    const s = b.summary()
    expect(s.validReps).toBe(2)
    expect(s.goodReps).toBe(1)
    expect(s.reps[0].concentricMs).toBeNull()
  })
})
