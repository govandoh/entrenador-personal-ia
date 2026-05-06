import { useEffect, useRef, useState } from 'react';
import { startCamera, stopCamera } from '../pose/camera';
import { initPoseDetector, detectAndDraw } from '../pose/poseDetector';
import { SquatTracker, GOOD_DEPTH_ANGLE, type SquatResult } from '../exercises/squat';
import { ExerciseOverlay } from './ExerciseOverlay';
import { useSpeech } from './useSpeech';

type Status = 'loading' | 'ready' | 'error';
type FacingMode = 'environment' | 'user';

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

// Frases de voz al completar una rep. El motor de es-ES lee los números en español.
function repPhrase(n: number): string {
  if (n === 1)         return 'Una';
  if (n % 10 === 0)    return `${n}. ¡Excelente ritmo!`;
  if (n % 5  === 0)    return `${n}. ¡Sigue así!`;
  return String(n);
}

export function CameraView() {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number>(0);
  const trackerRef = useRef(new SquatTracker());
  const prevRef    = useRef<SquatResult | null>(null);

  const [status, setStatus]               = useState<Status>('loading');
  const [errorMsg, setErrorMsg]           = useState('');
  const [facingMode, setFacingMode]       = useState<FacingMode>(
    () => (localStorage.getItem('preferred_camera') as FacingMode) ?? 'environment'
  );
  const [exerciseResult, setExerciseResult] = useState<SquatResult | null>(null);

  const speak = useSpeech();

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    if (!navigator.mediaDevices) {
      setErrorMsg('Contexto no seguro: abrí la app con HTTPS, no HTTP.');
      setStatus('error');
      return;
    }

    async function setup() {
      try {
        await initPoseDetector();
        if (cancelled || !videoRef.current) return;

        const stream = await startCamera(videoRef.current, facingMode);
        streamRef.current = stream;
        if (!cancelled) setStatus('ready');

        function loop() {
          if (cancelled || !videoRef.current || !canvasRef.current) return;

          const landmarkSets = detectAndDraw(videoRef.current, canvasRef.current, performance.now());

          if (landmarkSets.length > 0) {
            const result = trackerRef.current.update(landmarkSets[0]);
            const prev   = prevRef.current;

            // ── Retroalimentación por voz (solo en transiciones, no cada frame) ──
            if (prev) {
              if (result.reps > prev.reps) {
                // Rep completada → solo el número (el feedback de forma ya se dio en el fondo)
                speak(repPhrase(result.reps));
              } else if (result.atBottom) {
                // Fondo real detectado → evaluar con el ángulo mínimo acumulado,
                // no con el ángulo del frame de entrada a squatting
                speak(result.minAngleReached < GOOD_DEPTH_ANGLE
                  ? '¡Excelente profundidad!'
                  : 'Baja un poco más'
                );
              }
            }

            prevRef.current = result;
            setExerciseResult(result);
          }

          rafRef.current = requestAnimationFrame(loop);
        }
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(serializeError(err));
          setStatus('error');
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        stopCamera(streamRef.current);
        streamRef.current = null;
      }
    };
  }, [facingMode, speak]);

  const mirrorStyle = facingMode === 'user' ? { transform: 'scaleX(-1)' } : undefined;

  return (
    <div className="camera-container">
      {status === 'loading' && (
        <p className="status-msg">
          {streamRef.current ? 'Cambiando cámara...' : 'Inicializando detector de poses...'}
        </p>
      )}
      {status === 'error' && (
        <p className="status-msg error">
          Error al iniciar la cámara: {errorMsg}
        </p>
      )}

      <video ref={videoRef} className="camera-video" style={mirrorStyle} playsInline muted />
      <canvas ref={canvasRef} className="camera-canvas" style={mirrorStyle} />

      {status === 'ready' && exerciseResult && (
        <ExerciseOverlay result={exerciseResult} />
      )}

      {status === 'ready' && (
        <button
          className="switch-camera-btn"
          onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
          aria-label="Cambiar cámara"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
            <path d="M9 2H4a2 2 0 0 0-2 2v4" />
            <path d="M2 17v3a2 2 0 0 0 2 2h3" />
            <path d="M15 22h3a2 2 0 0 0 2-2v-3" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      )}
    </div>
  );
}
