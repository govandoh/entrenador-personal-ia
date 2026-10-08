import { DrawingUtils, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { LandmarkFrame, SkeletonRenderer } from './types';

/** Estilo del MVP; cambiarlo es un cambio visual (lo decide workstream E). */
const CONNECTOR_STYLE = { color: '#00FF00', lineWidth: 2 } as const;
const LANDMARK_STYLE = { color: '#FF3333', lineWidth: 1, radius: 3 } as const;

/** Lo que el renderer usa de `DrawingUtils`; se inyecta en los tests. */
export interface SkeletonPainter {
  drawConnectors(landmarks: NormalizedLandmark[], connections: unknown, style: object): void;
  drawLandmarks(landmarks: NormalizedLandmark[], style: object): void;
}

/**
 * Dibuja el esqueleto 2D sobre un canvas superpuesto al video (PR 3, issue #12).
 *
 * Solo dibuja `frame.image`; no detecta. El canvas debe tener el tamaño interno del
 * stream (`resize(videoWidth, videoHeight)` en cada frame) para que los landmarks
 * normalizados respeten la relación de aspecto real (ARCHITECTURE.md §3).
 */
export class CanvasSkeletonRenderer implements SkeletonRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly painter: SkeletonPainter;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, painter: SkeletonPainter) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.painter = painter;
  }

  /** `null` si el navegador no da contexto 2D. */
  static create(canvas: HTMLCanvasElement): CanvasSkeletonRenderer | null {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return new CanvasSkeletonRenderer(canvas, ctx, new DrawingUtils(ctx));
  }

  /** Iguala el tamaño interno del canvas al del video. Asignarlo también limpia el canvas. */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(frame: LandmarkFrame): void {
    this.clear();
    this.painter.drawConnectors(frame.image, PoseLandmarker.POSE_CONNECTIONS, CONNECTOR_STYLE);
    this.painter.drawLandmarks(frame.image, LANDMARK_STYLE);
  }
}
