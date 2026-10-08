import { describe, expect, it, vi } from 'vitest';
import { CanvasSkeletonRenderer, type SkeletonPainter } from './skeletonRenderer';

vi.mock('@mediapipe/tasks-vision', () => ({
  DrawingUtils: class {},
  PoseLandmarker: { POSE_CONNECTIONS: [{ start: 11, end: 13 }] },
}));

function setup() {
  const canvas = { width: 0, height: 0 } as HTMLCanvasElement;
  const ctx = { clearRect: vi.fn() } as unknown as CanvasRenderingContext2D;
  const painter: SkeletonPainter = { drawConnectors: vi.fn(), drawLandmarks: vi.fn() };
  return { canvas, ctx, painter, r: new CanvasSkeletonRenderer(canvas, ctx, painter) };
}

describe('CanvasSkeletonRenderer', () => {
  it('resize iguala el tamaño interno del canvas al del video', () => {
    const { canvas, r } = setup();
    r.resize(640, 480);
    expect([canvas.width, canvas.height]).toEqual([640, 480]);
  });

  it('draw limpia y dibuja conexiones y puntos con el estilo del MVP', () => {
    const { ctx, painter, r } = setup();
    r.resize(640, 480);
    const image = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
    r.draw({ t: 0, seq: 0, image, view: 'unknown' });

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
    expect(painter.drawConnectors).toHaveBeenCalledWith(image, [{ start: 11, end: 13 }], { color: '#00FF00', lineWidth: 2 });
    expect(painter.drawLandmarks).toHaveBeenCalledWith(image, { color: '#FF3333', lineWidth: 1, radius: 3 });
  });

  it('create devuelve null sin contexto 2D', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(CanvasSkeletonRenderer.create(canvas)).toBeNull();
  });
});
