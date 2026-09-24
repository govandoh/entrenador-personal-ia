import { describe, expect, it } from 'vitest'
import { KnnPoseClassifier, ScoreSmoother, type LabeledSample } from './poseClassifier.ts'
import { POSE_EMBEDDING_VERSION, embedPose, mirrorPose, rotateYaw } from '../geometry/poseEmbedding.ts'
import { LM, type Landmark3D } from '../geometry/vectors3d.ts'
import { DEMOS } from '../exercises/demoPoses.ts'
import { jitter, playDemo, seededGauss } from '../testing/syntheticMotion.ts'

/**
 * Pruebas de concepto sobre datos sintéticos (demos + ruido). Demuestran que la cadena
 * normalización → k-NN funciona y es invariante a cámara y estatura; las metas reales
 * (F1 LOSO ≥ 0.75, ≥ 90 % en identificar ejercicio) se miden con el dataset propio (DEC-055).
 */

const embed = (w: Landmark3D[]) => {
  const e = embedPose(w)
  if (!e) throw new Error('pose degenerada')
  return e
}

/** "Otra persona frente a otra cámara": escala, giro y temblor distintos a los del entrenamiento. */
function otherSubject(w: Landmark3D[], gauss: () => number, yawDeg: number): Landmark3D[] {
  const scaled = w.map(p => ({ ...p, x: p.x * 1.12, y: p.y * 1.12, z: p.z * 1.12 }))
  return jitter(rotateYaw(scaled, yawDeg), 0.01, gauss)
}

describe('KnnPoseClassifier: identificar el ejercicio', () => {
  const train: LabeledSample[] = []
  const gTrain = seededGauss(1)
  for (const [id, def] of Object.entries(DEMOS)) {
    // Solo la parte con movimiento: la postura inicial de pie es casi igual en los tres.
    for (const f of playDemo(def, { fps: 15, cycles: 1 })) {
      if (f.p < 0.25) continue
      const w = jitter(f.world, 0.005, gTrain)
      train.push({ label: id, embedding: embed(w) })
      train.push({ label: id, embedding: embed(mirrorPose(w)) })
    }
  }
  const knn = new KnnPoseClassifier().fit(train)

  it('acierta ≥ 90 % de los frames de otra persona, a otra distancia y girada', () => {
    const g = seededGauss(7)
    let hits = 0
    let total = 0
    for (const [id, def] of Object.entries(DEMOS)) {
      for (const f of playDemo(def, { fps: 30, cycles: 2 })) {
        if (f.p < 0.25) continue
        total++
        if (knn.predict(embed(otherSubject(f.world, g, 35))).label === id) hits++
      }
    }
    expect(hits / total).toBeGreaterThanOrEqual(0.9)
  })

  it('expone las etiquetas y el tamaño del modelo', () => {
    expect(knn.labels).toEqual(['curl-biceps', 'press-hombro', 'sentadilla'])
    expect(knn.size).toBe(train.length)
  })
})

describe('KnnPoseClassifier: error de forma en el frame clave', () => {
  /** Valgo de rodilla sintético: acerca las rodillas a la línea media. */
  const valgus = (w: Landmark3D[]) => w.map((p, i) =>
    i === LM.LEFT_KNEE || i === LM.RIGHT_KNEE ? { ...p, x: p.x * 0.35 } : p)

  const bottoms = (seed: number, n: number) => {
    const g = seededGauss(seed)
    return Array.from({ length: n }, (_, i) => jitter(DEMOS.sentadilla.pose(0.85 + (0.15 * i) / n), 0.008, g))
  }

  it('separa sentadilla correcta de valgo de rodilla con ejemplos de otro sujeto', () => {
    const knn = new KnnPoseClassifier().fit([
      ...bottoms(3, 30).map(w => ({ label: 'correcta', embedding: embed(w) })),
      ...bottoms(4, 30).map(w => ({ label: 'knee_valgus', embedding: embed(valgus(w)) })),
    ])
    const g = seededGauss(9)
    const test = bottoms(11, 20)
    const ok = test.filter(w => knn.predict(embed(otherSubject(w, g, -25))).label === 'correcta').length
    const bad = test.filter(w => knn.predict(embed(otherSubject(valgus(w), g, -25))).label === 'knee_valgus').length
    expect(ok / test.length).toBeGreaterThanOrEqual(0.9)
    expect(bad / test.length).toBeGreaterThanOrEqual(0.9)
  })

  it('separa profundidad buena de sentadilla corta', () => {
    const g = seededGauss(5)
    const at = (p: number) => embed(jitter(DEMOS.sentadilla.pose(p), 0.008, g))
    const knn = new KnnPoseClassifier().fit([
      ...[0.9, 0.95, 1, 0.92, 0.97, 0.99].map(p => ({ label: 'profunda', embedding: at(p) })),
      ...[0.45, 0.5, 0.55, 0.48, 0.52, 0.58].map(p => ({ label: 'shallow_depth', embedding: at(p) })),
    ])
    const small = new KnnPoseClassifier({ topNByMax: 8, k: 3 }).fit(knn.toJSON().samples)
    expect(small.predict(at(0.96)).label).toBe('profunda')
    expect(small.predict(at(0.5)).label).toBe('shallow_depth')
  })
})

describe('KnnPoseClassifier: serialización y validación', () => {
  const samples: LabeledSample[] = [
    { label: 'a', embedding: embed(DEMOS.sentadilla.pose(1)) },
    { label: 'b', embedding: embed(DEMOS['press-hombro'].pose(1)) },
  ]

  it('toJSON/fromJSON conserva las predicciones', () => {
    const knn = new KnnPoseClassifier({ k: 1, topNByMax: 2 }).fit(samples)
    const copy = KnnPoseClassifier.fromJSON(JSON.parse(JSON.stringify(knn.toJSON())))
    const q = embed(DEMOS.sentadilla.pose(0.95))
    expect(copy.predict(q)).toEqual(knn.predict(q))
  })

  it('rechaza un modelo de otra versión del vector de rasgos', () => {
    const json = { ...new KnnPoseClassifier().fit(samples).toJSON(), embeddingVersion: POSE_EMBEDDING_VERSION + 1 }
    expect(() => KnnPoseClassifier.fromJSON(json)).toThrow(/embedding v/)
  })

  it('rechaza vectores de otra dimensión', () => {
    expect(() => new KnnPoseClassifier().fit([{ label: 'x', embedding: [1, 2, 3] }])).toThrow(/dimensiones/)
  })

  it('sin ejemplos no predice nada', () => {
    expect(new KnnPoseClassifier().predict(samples[0].embedding)).toEqual({ label: null, confidence: 0, scores: {} })
  })
})

describe('ScoreSmoother', () => {
  it('un frame aislado de otra clase no cambia la etiqueta', () => {
    const s = new ScoreSmoother(150)
    let t = 0
    for (let i = 0; i < 10; i++, t += 33) s.push({ sentadilla: 1 }, t)
    expect(s.push({ curl: 1 }, t).label).toBe('sentadilla')
  })

  it('un cambio sostenido sí cambia la etiqueta, al mismo tiempo a 15 y 60 fps', () => {
    const switchTime = (fps: number) => {
      const s = new ScoreSmoother(150)
      let t = 0
      for (; t < 1000; t += 1000 / fps) s.push({ sentadilla: 1 }, t)
      for (; t < 3000; t += 1000 / fps) if (s.push({ curl: 1 }, t).label === 'curl') return t - 1000
      return Infinity
    }
    const slow = switchTime(15)
    const fast = switchTime(60)
    expect(slow).toBeLessThan(250)
    expect(Math.abs(slow - fast)).toBeLessThanOrEqual(1000 / 15)
  })
})
