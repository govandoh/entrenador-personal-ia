import { useEffect, useRef, useState } from 'react';
import { startCamera, stopCamera } from '../pose/camera';
import { initPoseDetector, detectAndDraw } from '../pose/poseDetector';
import { SquatTracker, GOOD_DEPTH_ANGLE } from '../exercises/squat';
import { BicepCurlTracker, GOOD_FORM_ANGLE } from '../exercises/bicepCurl';
import { ShoulderPressTracker, GOOD_LOCKOUT_ANGLE } from '../exercises/shoulderPress';
import type { SquatResult } from '../exercises/squat';
import type { BicepCurlResult } from '../exercises/bicepCurl';
import type { ShoulderPressResult } from '../exercises/shoulderPress';
import { ExerciseOverlay } from './ExerciseOverlay';
import { useSpeech } from './useSpeech';

type Status         = 'loading' | 'ready' | 'error';
type FacingMode     = 'environment' | 'user';
type ActiveExercise = 'squat' | 'curl' | 'press';
type AnyResult      = SquatResult | BicepCurlResult | ShoulderPressResult;

const EXERCISE_NAMES: Record<ActiveExercise, string> = {
  squat: 'Sentadillas',
  curl:  'Curl de Bíceps',
  press: 'Press de Hombro',
};

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

function repPhrase(n: number): string {
  if (n === 1)        return 'Una';
  if (n % 10 === 0)   return `${n}. ¡Excelente ritmo!`;
  if (n % 5  === 0)   return `${n}. ¡Sigue así!`;
  return String(n);
}

export function CameraView() {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number>(0);

  // Trackers — uno por ejercicio, persisten entre cambios de cámara y de ejercicio
  const squatTrackerRef = useRef(new SquatTracker());
  const curlTrackerRef  = useRef(new BicepCurlTracker());
  const pressTrackerRef = useRef(new ShoulderPressTracker());

  // Referencia al ejercicio activo legible desde el RAF loop (evita stale closure)
  const activeExRef = useRef<ActiveExercise>('squat');
  // Reps del frame anterior para detectar nueva rep completada
  const prevRepsRef = useRef<number>(-1);
  // Arquitectura de voz sin colisiones (ver DEC-016)
  const curlFormFeedbackRef  = useRef<string>('');
  const pressFormFeedbackRef = useRef<string>('');
  const lastSpeakTimeRef     = useRef<number>(0);

  const [status, setStatus]               = useState<Status>('loading');
  const [errorMsg, setErrorMsg]           = useState('');
  const [facingMode, setFacingMode]       = useState<FacingMode>(
    () => (localStorage.getItem('preferred_camera') as FacingMode) ?? 'environment',
  );
  const [activeExercise, setActiveExercise] = useState<ActiveExercise>('squat');
  const [exerciseResult, setExerciseResult] = useState<AnyResult | null>(null);

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
            const ex = activeExRef.current;
            const result: AnyResult = (() => {
              if (ex === 'squat') return squatTrackerRef.current.update(landmarkSets[0]);
              if (ex === 'curl')  return curlTrackerRef.current.update(landmarkSets[0]);
              return pressTrackerRef.current.update(landmarkSets[0]);
            })();

            const prevReps = prevRepsRef.current;

            if (prevReps >= 0) {
              if (result.reps > prevReps) {
                if (ex === 'squat') {
                  // Para sentadilla: respetar cooldown para no solapar con el feedback de fondo
                  if (performance.now() - lastSpeakTimeRef.current > 1500) {
                    speak(repPhrase(result.reps));
                    lastSpeakTimeRef.current = performance.now();
                  }
                } else if (ex === 'curl') {
                  // Para curl: combinar conteo + feedback de forma en un único utterance (ver DEC-016)
                  const formMsg = curlFormFeedbackRef.current;
                  speak(formMsg ? `${repPhrase(result.reps)}. ${formMsg}` : repPhrase(result.reps));
                  curlFormFeedbackRef.current = '';
                  lastSpeakTimeRef.current = performance.now();
                } else {
                  // Para press: mismo patrón que curl (pico al fin del esfuerzo)
                  const formMsg = pressFormFeedbackRef.current;
                  speak(formMsg ? `${repPhrase(result.reps)}. ${formMsg}` : repPhrase(result.reps));
                  pressFormFeedbackRef.current = '';
                  lastSpeakTimeRef.current = performance.now();
                }
              } else if (ex === 'squat') {
                const r = result as SquatResult;
                if (r.atBottom) {
                  speak(r.minAngleReached < GOOD_DEPTH_ANGLE
                    ? '¡Excelente profundidad!'
                    : 'Baja un poco más',
                  );
                  lastSpeakTimeRef.current = performance.now();
                }
              } else if (ex === 'curl') {
                const r = result as BicepCurlResult;
                if (r.atTop) {
                  // Guardar feedback de forma; se pronunciará junto con el conteo al completar la rep
                  curlFormFeedbackRef.current = r.minAngleReached < GOOD_FORM_ANGLE
                    ? '¡Excelente contracción!'
                    : 'Sube un poco más';
                }
              } else {
                const r = result as ShoulderPressResult;
                if (r.atPeak) {
                  // Guardar feedback de forma; se pronunciará junto con el conteo al completar la rep
                  pressFormFeedbackRef.current = r.maxAngleReached >= GOOD_LOCKOUT_ANGLE
                    ? '¡Extensión completa!'
                    : 'Extiende un poco más';
                }
              }
            }

            prevRepsRef.current = result.reps;
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

  function handleSwitchExercise() {
    const current = activeExRef.current;
    const next: ActiveExercise =
      current === 'squat' ? 'curl' :
      current === 'curl'  ? 'press' : 'squat';
    activeExRef.current = next;
    setActiveExercise(next);
    squatTrackerRef.current.reset();
    curlTrackerRef.current.reset();
    pressTrackerRef.current.reset();
    prevRepsRef.current          = -1;
    curlFormFeedbackRef.current  = '';
    pressFormFeedbackRef.current = '';
    setExerciseResult(null);
  }

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
        <ExerciseOverlay
          result={exerciseResult}
          exerciseName={EXERCISE_NAMES[activeExercise]}
        />
      )}

      {status === 'ready' && (
        <>
          {/* Selector de ejercicio — esquina inferior izquierda */}
          <button
            className="exercise-btn"
            onClick={handleSwitchExercise}
            aria-label="Cambiar ejercicio"
          >
            {activeExercise === 'squat' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {/* figura en sentadilla */}
                <circle cx="12" cy="4" r="2" />
                <path d="M12 6v4l-3 4h6l-3-4" />
                <path d="M9 14l-2 5" />
                <path d="M15 14l2 5" />
              </svg>
            ) : activeExercise === 'curl' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {/* mancuerna */}
                <rect x="2"  y="11" width="4" height="3" rx="1" />
                <rect x="18" y="11" width="4" height="3" rx="1" />
                <rect x="5"  y="10" width="3" height="5" rx="1" />
                <rect x="16" y="10" width="3" height="5" rx="1" />
                <line x1="8" y1="12.5" x2="16" y2="12.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {/* figura con brazos extendidos overhead (press de hombro) */}
                <circle cx="12" cy="3" r="1.5" />
                <line x1="12" y1="5"  x2="12" y2="13" />
                <line x1="12" y1="9"  x2="6"  y2="4"  />
                <line x1="6"  y1="4"  x2="4"  y2="2"  />
                <line x1="12" y1="9"  x2="18" y2="4"  />
                <line x1="18" y1="4"  x2="20" y2="2"  />
                <line x1="12" y1="13" x2="9"  y2="19" />
                <line x1="12" y1="13" x2="15" y2="19" />
              </svg>
            )}
            <span>{EXERCISE_NAMES[activeExercise]}</span>
          </button>

          {/* Selector de cámara — esquina inferior derecha */}
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
        </>
      )}
    </div>
  );
}
