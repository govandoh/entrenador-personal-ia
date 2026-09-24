import { describe, expect, it } from 'vitest'
import {
  COCO17_FROM_MEDIAPIPE, POSE_EMBEDDING_SIZE, embedPose, mirrorPose, normalizePose, rotateYaw,
} from './poseEmbedding.ts'
import { LM, type Landmark3D } from './vectors3d.ts'
import { DEMOS } from '../exercises/demoPoses.ts'

const pose = DEMOS.sentadilla.pose(0.7)

function expectClose(a: number[] | null, b: number[] | null, digits = 9) {
  expect(a).not.toBeNull()
  expect(b).not.toBeNull()
  a!.forEach((v, i) => expect(v).toBeCloseTo(b![i], digits))
}

describe('normalizePose', () => {
  it('centra en la cadera y escala el torso a 1', () => {
    const n = normalizePose(pose)!
    const hipMidX = (n[LM.LEFT_HIP].x + n[LM.RIGHT_HIP].x) / 2
    expect(hipMidX).toBeCloseTo(0, 9)
    const sh = { x: (n[11].x + n[12].x) / 2, y: (n[11].y + n[12].y) / 2, z: (n[11].z + n[12].z) / 2 }
    expect(Math.hypot(sh.x, sh.y, sh.z)).toBeCloseTo(1, 9)
  })

  it('deja el eje de caderas sobre +X', () => {
    const n = normalizePose(rotateYaw(pose, 55))!
    expect(n[LM.LEFT_HIP].z - n[LM.RIGHT_HIP].z).toBeCloseTo(0, 9)
    expect(n[LM.LEFT_HIP].x - n[LM.RIGHT_HIP].x).toBeGreaterThan(0)
  })

  it('devuelve null con un torso degenerado', () => {
    const flat: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
    expect(normalizePose(flat)).toBeNull()
    expect(embedPose(flat)).toBeNull()
  })
})

describe('embedPose', () => {
  it(`tiene ${POSE_EMBEDDING_SIZE} dimensiones (COCO-17 × 3 + 8 ángulos + tronco)`, () => {
    expect(COCO17_FROM_MEDIAPIPE).toHaveLength(17)
    expect(embedPose(pose)).toHaveLength(POSE_EMBEDDING_SIZE)
  })

  it('es invariante a traslación y escala (distancia y estatura)', () => {
    const moved = pose.map(p => ({ ...p, x: p.x * 1.3 + 0.4, y: p.y * 1.3 - 0.2, z: p.z * 1.3 + 1 }))
    expectClose(embedPose(moved), embedPose(pose))
  })

  it('es invariante al giro alrededor de la vertical (orientación frente a la cámara)', () => {
    expectClose(embedPose(rotateYaw(pose, 40)), embedPose(pose))
    expectClose(embedPose(rotateYaw(pose, -90)), embedPose(pose))
  })

  it('distingue posturas distintas del mismo ejercicio', () => {
    const top = embedPose(DEMOS.sentadilla.pose(0))!
    const bottom = embedPose(DEMOS.sentadilla.pose(1))!
    const diff = top.reduce((acc, v, i) => acc + Math.abs(v - bottom[i]), 0) / top.length
    expect(diff).toBeGreaterThan(0.05)
  })
})

describe('mirrorPose', () => {
  it('aplicado dos veces devuelve la pose original', () => {
    const twice = mirrorPose(mirrorPose(pose))
    twice.forEach((p, i) => {
      expect(p.x).toBeCloseTo(pose[i].x, 12)
      expect(p.y).toBe(pose[i].y)
      expect(p.z).toBe(pose[i].z)
    })
  })

  it('intercambia izquierda y derecha', () => {
    const m = mirrorPose(pose)
    expect(m[LM.LEFT_KNEE].x).toBeCloseTo(-pose[LM.RIGHT_KNEE].x, 12)
    expect(m[LM.LEFT_WRIST].y).toBe(pose[LM.RIGHT_WRIST].y)
  })

  it('una pose simétrica espejada da el mismo vector de rasgos', () => {
    const symmetric = DEMOS['curl-biceps'].pose(0.5)
    expectClose(embedPose(mirrorPose(symmetric)), embedPose(symmetric), 6)
  })
})
