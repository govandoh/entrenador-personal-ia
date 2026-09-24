import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import * as THREE from 'three';
import type { Landmark3D } from '../../geometry/vectors3d';
import { FOOT_JOINTS, KEY_JOINTS, POSE_BONES } from './poseTopology';

/**
 * Visor 3D del esqueleto de 33 puntos (DEC-039, DEC-061). Se carga siempre con
 * `React.lazy`: three.js queda fuera del shell.
 *
 * - Se orienta en todas las direcciones: un dedo gira (horizontal sin límite, vertical
 *   hasta ±80°), dos dedos o la rueda acercan y alejan, doble toque vuelve a la vista inicial.
 * - Se actualiza por API imperativa (`update`), nunca por props: el bucle de detección
 *   corre a 30-60 fps y un render de React por cuadro no cabe en el presupuesto de la cámara.
 * - Solo dibuja cuando algo cambió (pose nueva, gesto o giro automático).
 */

export interface Pose3DHandle {
  update(world: readonly Landmark3D[]): void;
  resetView(): void;
}

interface Pose3DViewProps {
  ref?: Ref<Pose3DHandle | null>;
  className?: string;
  /** Giro inicial alrededor de la vertical, en radianes (0 = de frente). */
  initialRotation?: number;
  /** Giro automático lento hasta que la persona toca el modelo (demostraciones). */
  autoRotate?: boolean;
  label: string;
}

/** Metros a unidades de escena: un cuerpo de 1,75 m con los brazos arriba cabe con margen. */
const SCENE_SCALE = 2.1;
const GROUND_Y = -1.95;
/** Altura de cadera por defecto (m) mientras los pies no se ven. */
const DEFAULT_HIP_HEIGHT = 0.92;
const JOINTS = 33;
const MIN_VISIBILITY = 0.5;
const PITCH_LIMIT = (80 * Math.PI) / 180;
const DISTANCE = { initial: 6.3, min: 3.2, max: 11 };
/** Suavizado del giro y el zoom por cuadro: el modelo sigue al dedo sin saltos. */
const VIEW_SMOOTHING = 0.25;
const AUTO_ROTATE_RAD_PER_FRAME = 0.004;
const DOUBLE_TAP_MS = 300;

function token(name: string, fallback: string): THREE.Color {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return new THREE.Color(v || fallback);
  } catch {
    return new THREE.Color(fallback);
  }
}

function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

const seen = (p: Landmark3D | undefined) => (p?.visibility ?? 1) >= MIN_VISIBILITY;

export function Pose3DView({ ref, className, initialRotation = 0, autoRotate = false, label }: Pose3DViewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Pose3DHandle | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = reducedMotion();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 3, 4);
    scene.add(key);

    // Se gira el grupo, no la cámara: la luz queda fija respecto a quien mira.
    const group = new THREE.Group();
    scene.add(group);

    // Huesos vistos (índigo, la "red") y estimados sin ver (tenues): dibujar igual lo que
    // MediaPipe inventa fuera del cuadro hacía creer que se estaba midiendo (DEC-050).
    const makeBones = (material: THREE.LineBasicMaterial) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(POSE_BONES.length * 6);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      group.add(new THREE.LineSegments(geometry, material));
      return { geometry, positions };
    };
    const boneMaterial = new THREE.LineBasicMaterial({ color: token('--color-indigo', '#7b6cff') });
    const guessMaterial = new THREE.LineBasicMaterial({ color: token('--color-text-muted', '#9aa4b8'), transparent: true, opacity: 0.22 });
    const seenBones = makeBones(boneMaterial);
    const guessedBones = makeBones(guessMaterial);

    const jointGeometry = new THREE.SphereGeometry(0.05, 12, 12);
    const jointMaterial = new THREE.MeshStandardMaterial({ color: token('--color-volt', '#d7ff3a'), roughness: 0.45, metalness: 0.05 });
    const joints = new THREE.InstancedMesh(jointGeometry, jointMaterial, JOINTS);
    joints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(joints);

    // Suelo con retícula: referencia de profundidad al girar.
    const grid = new THREE.GridHelper(4, 8, token('--color-line', '#2a3345'), token('--color-surface-2', '#1d2433'));
    grid.position.y = GROUND_Y;
    group.add(grid);

    const dummy = new THREE.Object3D();
    const points = Array.from({ length: JOINTS }, () => new THREE.Vector3());
    let hipHeight = DEFAULT_HIP_HEIGHT;
    let hasData = false;
    let dirty = true;

    // Vista: valores objetivo que marca el gesto y valores actuales que los siguen.
    const target = { yaw: initialRotation, pitch: 0, distance: DISTANCE.initial };
    const view = { ...target };
    let spinning = autoRotate && !reduce;

    function resize() {
      const w = Math.max(1, mount!.clientWidth);
      const h = Math.max(1, mount!.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      dirty = true;
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    // ── Gestos: un dedo gira, dos dedos acercan, doble toque reinicia ──
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let pinchDistance = target.distance;
    let lastTap = 0;
    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';

    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    function onDown(e: PointerEvent) {
      e.stopPropagation();
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      spinning = false;
      if (pointers.size === 2) { pinchStart = spread(); pinchDistance = target.distance; }
      if (pointers.size === 1) {
        if (e.timeStamp - lastTap < DOUBLE_TAP_MS) resetView();
        lastTap = e.timeStamp;
      }
    }
    function onMove(e: PointerEvent) {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const next = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, next);
      if (pointers.size === 1) {
        target.yaw += (next.x - prev.x) * 0.01;
        target.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, target.pitch + (next.y - prev.y) * 0.01));
      } else if (pointers.size === 2 && pinchStart > 0) {
        target.distance = clampDistance(pinchDistance * (pinchStart / Math.max(1, spread())));
      }
      dirty = true;
    }
    function onUp(e: PointerEvent) {
      pointers.delete(e.pointerId);
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (pointers.size < 2) pinchStart = 0;
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      target.distance = clampDistance(target.distance * (1 + e.deltaY * 0.001));
      spinning = false;
      dirty = true;
    }
    const clampDistance = (d: number) => Math.max(DISTANCE.min, Math.min(DISTANCE.max, d));
    function resetView() {
      target.yaw = initialRotation;
      target.pitch = 0;
      target.distance = DISTANCE.initial;
      dirty = true;
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    apiRef.current = {
      resetView,
      update(world) {
        if (world.length < JOINTS) return;
        // Anclaje al suelo: el origen de worldLandmarks es la cadera; el pie visible más
        // bajo marca el suelo para que en una sentadilla baje la cadera y no suban los pies.
        let lowest = -Infinity;
        for (const i of FOOT_JOINTS) if (seen(world[i]) && world[i].y > lowest) lowest = world[i].y;
        hipHeight += ((Number.isFinite(lowest) ? lowest : DEFAULT_HIP_HEIGHT) - hipHeight) * 0.25;

        // worldLandmarks tiene la Y hacia abajo; three.js hacia arriba.
        for (let i = 0; i < JOINTS; i++) {
          points[i].set(world[i].x * SCENE_SCALE, (hipHeight - world[i].y) * SCENE_SCALE + GROUND_Y, -world[i].z * SCENE_SCALE);
        }
        let s = 0;
        let g = 0;
        for (const [a, b] of POSE_BONES) {
          const visible = seen(world[a]) && seen(world[b]);
          const buf = visible ? seenBones.positions : guessedBones.positions;
          const o = (visible ? s++ : g++) * 6;
          buf[o] = points[a].x; buf[o + 1] = points[a].y; buf[o + 2] = points[a].z;
          buf[o + 3] = points[b].x; buf[o + 4] = points[b].y; buf[o + 5] = points[b].z;
        }
        for (const [bones, count] of [[seenBones, s], [guessedBones, g]] as const) {
          bones.geometry.setDrawRange(0, count * 2);
          bones.geometry.attributes.position.needsUpdate = true;
          bones.geometry.computeBoundingSphere();
        }
        for (let i = 0; i < JOINTS; i++) {
          dummy.position.copy(points[i]);
          // Una esfera sólida afirma una posición medida: las estimadas no se dibujan.
          dummy.scale.setScalar(!seen(world[i]) ? 0 : KEY_JOINTS.has(i) ? 1.4 : 0.8);
          dummy.updateMatrix();
          joints.setMatrixAt(i, dummy.matrix);
        }
        joints.instanceMatrix.needsUpdate = true;
        hasData = true;
        dirty = true;
      },
    };

    let frame = 0;
    const k = reduce ? 1 : VIEW_SMOOTHING;
    function loop() {
      if (spinning) { target.yaw += AUTO_ROTATE_RAD_PER_FRAME; dirty = true; }
      const moving = Math.abs(target.yaw - view.yaw) > 1e-4 || Math.abs(target.pitch - view.pitch) > 1e-4 || Math.abs(target.distance - view.distance) > 1e-3;
      if (moving) {
        view.yaw += (target.yaw - view.yaw) * k;
        view.pitch += (target.pitch - view.pitch) * k;
        view.distance += (target.distance - view.distance) * k;
        dirty = true;
      }
      if (dirty && hasData) {
        group.rotation.set(view.pitch, view.yaw, 0);
        camera.position.set(0, 0.25, view.distance);
        camera.lookAt(0, 0.25, 0);
        renderer.render(scene, camera);
        dirty = false;
      }
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      // WebGL no libera la memoria de la GPU con el recolector de basura: se descarta a mano.
      seenBones.geometry.dispose();
      guessedBones.geometry.dispose();
      boneMaterial.dispose();
      guessMaterial.dispose();
      jointGeometry.dispose();
      jointMaterial.dispose();
      joints.dispose();
      grid.dispose();
      renderer.dispose();
      if (canvas.parentNode === mount) mount.removeChild(canvas);
      apiRef.current = null;
    };
  }, [initialRotation, autoRotate]);

  useImperativeHandle(ref, () => ({
    update: world => apiRef.current?.update(world),
    resetView: () => apiRef.current?.resetView(),
  }), []);

  return <div ref={mountRef} className={className} role="img" aria-label={label} />;
}

export default Pose3DView;
