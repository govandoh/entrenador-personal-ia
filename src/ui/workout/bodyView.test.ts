import { describe, expect, it } from 'vitest';
import { LM, type Landmark3D } from '../../geometry/vectors3d';
import { VIEW_STABLE_MS, ViewStabilizer, bodyView } from './bodyView';

/** Pose mínima: solo los hombros, separados 0,4 m y girados `yawDeg` respecto a la cámara. */
function shoulders(yawDeg: number, visibility = 1): Landmark3D[] {
  const world: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility }));
  const a = (yawDeg * Math.PI) / 180;
  world[LM.LEFT_SHOULDER] = { x: 0.2 * Math.cos(a), y: -0.4, z: 0.2 * Math.sin(a), visibility };
  world[LM.RIGHT_SHOULDER] = { x: -0.2 * Math.cos(a), y: -0.4, z: -0.2 * Math.sin(a), visibility };
  return world;
}

describe('bodyView', () => {
  it('distingue de frente, en diagonal y de perfil', () => {
    expect(bodyView(shoulders(5))).toBe('frontal');
    expect(bodyView(shoulders(45))).toBe('diagonal');
    expect(bodyView(shoulders(85))).toBe('lateral');
  });

  it('sin hombros visibles no hay vista', () => {
    expect(bodyView(null)).toBeNull();
    expect(bodyView([])).toBeNull();
    expect(bodyView(shoulders(0, 0.1))).toBeNull();
  });
});

describe('ViewStabilizer', () => {
  it('muestra una vista nueva solo cuando se mantiene', () => {
    const s = new ViewStabilizer();
    expect(s.update('lateral', 0)).toBeNull();
    expect(s.update('lateral', VIEW_STABLE_MS - 1)).toBeNull();
    expect(s.update('lateral', VIEW_STABLE_MS)).toBe('lateral');
  });

  it('ignora un cambio de un cuadro cerca del umbral', () => {
    const s = new ViewStabilizer();
    s.update('lateral', 0);
    s.update('lateral', VIEW_STABLE_MS);
    let t = VIEW_STABLE_MS;
    for (let i = 0; i < 20; i++) {
      t += 33;
      expect(s.update(i % 2 === 0 ? 'diagonal' : 'lateral', t)).toBe('lateral');
    }
  });

  it('reset vuelve a empezar sin vista', () => {
    const s = new ViewStabilizer();
    s.update('frontal', 0);
    s.update('frontal', VIEW_STABLE_MS);
    s.reset();
    expect(s.update('frontal', VIEW_STABLE_MS + 1)).toBeNull();
  });
});
