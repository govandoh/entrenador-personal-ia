import { describe, expect, it } from 'vitest'
import { buildFixture, captureFrame, parseRecordScript, qualityForCondition } from './fixtureRecorder'
import { FIXTURE_FILENAME_RE, fixtureFileName } from './fixtureTypes'

const lm = (x: number) => Array.from({ length: 33 }, () => ({ x, y: 0.5, z: 0, visibility: 0.9 }))

describe('grabación por guion (DEC-055)', () => {
  it('lee condición, vista y sujeto de la URL', () => {
    expect(parseRecordScript('?debug=record&cond=Knee_Valgus&view=side&subject=s01')).toEqual({
      condition: 'knee_valgus', view: 'side', subjectId: 's01',
    })
  })

  it('ignora vistas desconocidas y sujetos que no son identificadores anónimos cortos', () => {
    const s = parseRecordScript('?cond=correct&view=top&subject=Maria%20Lopez%20Garcia')
    expect(s.view).toBeNull()
    expect(s.subjectId).toBeNull()
  })

  it('traduce la condición a la calidad del archivo', () => {
    expect(qualityForCondition('correct')).toBe('good')
    expect(qualityForCondition('knee_valgus')).toBe('knee-valgus')
    expect(qualityForCondition('lumbar_arch')).toBe('lumbar-arch')
    expect(qualityForCondition('inventado')).toBeNull()
    expect(qualityForCondition(null)).toBeNull()
  })

  it('el fixture lleva vista, calidad, sujeto, motor y gravedad por frame', () => {
    const frames = [
      captureFrame(1000, lm(0.4), lm(0.1), { x: 0.01, y: 0.99, z: -0.12346 }),
      captureFrame(1033.4, lm(0.41), lm(0.11), null),
    ]
    const f = buildFixture('squat', frames, {
      script: { condition: 'knee_valgus', view: 'side', subjectId: 's02' },
      engine: '3d',
      calibrationDeg: 18.2,
    })
    expect(f.meta.view).toBe('side')
    expect(f.meta.quality).toBe('knee-valgus')
    expect(f.meta.capture).toEqual({ engine: '3d', condition: 'knee_valgus', subjectId: 's02', calibrationDeg: 18.2 })
    expect(f.frames[0].t).toBe(0)
    expect(f.frames[0].down).toEqual([0.01, 0.99, -0.1235])
    expect(f.frames[1].down).toBeUndefined()
    expect(FIXTURE_FILENAME_RE.test(fixtureFileName(f.meta, 1))).toBe(true)
    expect(fixtureFileName(f.meta, 1)).toBe('squat-side-knee-valgus-01.json')
  })

  it('sin guion conserva los valores por defecto que se corrigen a mano', () => {
    const f = buildFixture('curl', [captureFrame(0, lm(0.5), null)])
    expect(f.meta.view).toBe('front')
    expect(f.meta.quality).toBe('good')
    expect(f.meta.capture).toEqual({ engine: '2d' })
  })
})
