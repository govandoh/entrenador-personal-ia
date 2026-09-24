import { describe, expect, it } from 'vitest'
import { evaluateLoso, formLabel, samplesFromRecording, type SubjectSample } from './knnDataset.ts'
import { DEMOS } from '../exercises/demoPoses.ts'
import { LM, type Landmark3D } from '../geometry/vectors3d.ts'
import { jitter, playDemo, seededGauss, tiltPose } from '../testing/syntheticMotion.ts'
import type { FixtureQuality, LandmarkFixture } from '../testing/fixtureTypes.ts'

/**
 * Grabaciones sintéticas con el formato que produce `?debug=record` por guion, para probar
 * la cadena grabación → ejemplos → LOSO sin datos reales. Cada "sujeto" cambia de escala,
 * de ruido y de inclinación de cámara.
 */
function recording(
  exercise: 'squat' | 'curl' | 'press',
  quality: FixtureQuality,
  subjectId: string,
  scale: number,
  seed: number,
  transform: (w: Landmark3D[]) => Landmark3D[] = w => w,
): LandmarkFixture {
  const demo = DEMOS[exercise === 'squat' ? 'sentadilla' : exercise === 'curl' ? 'curl-biceps' : 'press-hombro']
  const g = seededGauss(seed)
  const tilt = 8 + seed % 7
  const frames = playDemo(demo, { fps: 30, cycles: 4 }).map(f => {
    const w = jitter(transform(f.world).map(p => ({ ...p, x: p.x * scale, y: p.y * scale, z: p.z * scale })), 0.006, g)
    return { t: f.t, image: asFixture(w), world: asFixture(tiltPose(w, tilt, 0)) }
  })
  return {
    meta: {
      schemaVersion: 1, exercise, view: 'side', quality, source: 'phone', fps: 30,
      recordedAt: '2026-09-24T00:00:00Z', capture: { engine: '3d', condition: quality, subjectId },
    },
    frames,
  }
}

/** Landmarks con visibilidad explícita, como los guarda el grabador. */
function asFixture(w: Landmark3D[]) {
  return w.map(p => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1 }))
}

/** Valgo de rodilla sintético: acerca las rodillas a la línea media. */
const valgus = (w: Landmark3D[]) => w.map((p, i) =>
  i === LM.LEFT_KNEE || i === LM.RIGHT_KNEE ? { ...p, x: p.x * 0.35 } : p)

const SUBJECTS = [['s01', 0.95, 1], ['s02', 1.0, 2], ['s03', 1.08, 3], ['s04', 1.15, 4]] as const

describe('samplesFromRecording', () => {
  it('un frame clave por repetición, etiquetado con la condición de la toma', () => {
    const r = samplesFromRecording(recording('squat', 'good', 's01', 1, 1))!
    expect(r.reps).toBe(4)
    expect(r.form).toHaveLength(4)
    expect(r.form.every(s => s.label === 'correct' && s.subjectId === 's01')).toBe(true)
    expect(r.exercise_id.length).toBeGreaterThan(10)
    expect(r.exercise_id.every(s => s.label === 'squat')).toBe(true)
  })

  it('ignora grabaciones sin world (fixtures 2D del PR 1)', () => {
    const f = recording('squat', 'good', 's01', 1, 1)
    f.frames = f.frames.map(({ t, image }) => ({ t, image }))
    expect(samplesFromRecording(f)).toBeNull()
  })

  it('formLabel traduce la calidad del archivo', () => {
    expect(formLabel('good')).toBe('correct')
    expect(formLabel('knee-valgus')).toBe('knee-valgus')
  })
})

describe('evaluateLoso', () => {
  it('sentadilla correcta frente a valgo: F1 macro ≥ 0,9 dejando fuera a cada sujeto', () => {
    const samples: SubjectSample[] = []
    for (const [id, scale, seed] of SUBJECTS) {
      samples.push(...samplesFromRecording(recording('squat', 'good', id, scale, seed))!.form)
      samples.push(...samplesFromRecording(recording('squat', 'knee-valgus', id, scale, seed + 10, valgus))!.form)
    }
    const report = evaluateLoso(samples, { k: 3, topNByMax: 10 })
    expect(report.subjects).toEqual(['s01', 's02', 's03', 's04'])
    expect(report.samples).toBe(32)
    expect(report.f1Macro).toBeGreaterThanOrEqual(0.9)
    expect(report.perClass['knee-valgus'].support).toBe(16)
  })

  it('identificación de ejercicio entre sentadilla, curl y press: accuracy ≥ 0,9', () => {
    const samples: SubjectSample[] = []
    for (const [id, scale, seed] of SUBJECTS) {
      for (const ex of ['squat', 'curl', 'press'] as const) {
        samples.push(...samplesFromRecording(recording(ex, 'good', id, scale, seed))!.exercise_id)
      }
    }
    const report = evaluateLoso(samples)
    expect(report.accuracy).toBeGreaterThanOrEqual(0.9)
    expect(Object.keys(report.perClass)).toEqual(['curl', 'press', 'squat'])
  })

  it('la matriz de confusión suma el total evaluado', () => {
    const s = (label: string, subjectId: string, v: number): SubjectSample =>
      ({ label, subjectId, embedding: Array.from({ length: 60 }, () => v) })
    const report = evaluateLoso([s('a', 'x', 0), s('b', 'x', 1), s('a', 'y', 0.05), s('b', 'y', 0.95)], { k: 1, topNByMax: 2 })
    const sum = Object.values(report.confusion).flatMap(r => Object.values(r)).reduce((a, v) => a + v, 0)
    expect(sum).toBe(report.samples)
    expect(report.accuracy).toBe(1)
  })
})
