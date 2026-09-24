import { useEffect, useRef, useState } from 'react';
import { startCamera, stopCamera } from '../pose/camera';
import { initPoseDetector, detectAndDraw, getLastWorldLandmarks } from '../pose/poseDetector';
import { RECORD_MODE, RECORD_SCRIPT, captureFrame, downloadFixture, type RecordedFrame } from '../testing/fixtureRecorder';
import { SquatTracker, GOOD_DEPTH_ANGLE } from '../exercises/squat';
import { BicepCurlTracker, GOOD_FORM_ANGLE } from '../exercises/bicepCurl';
import { ShoulderPressTracker, GOOD_LOCKOUT_ANGLE } from '../exercises/shoulderPress';
import type { SquatResult } from '../exercises/squat';
import type { BicepCurlResult } from '../exercises/bicepCurl';
import type { ShoulderPressResult } from '../exercises/shoulderPress';
import { ExerciseOverlay } from './ExerciseOverlay';
import { useSpeech } from './useSpeech';
import { ENGINE_3D } from './engineFlag';
import { FramePipeline, type FrameDiagnostics } from '../analysis/framePipeline';
import { DEFINITIONS_3D } from '../exercises/definitions3d';
import type { Tracker3DResult } from '../exercises/tracker3d';
import { DeviceGravityTracker, motionPermissionRequired, requestMotionPermission } from '../pose/deviceGravity';

type Status         = 'loading' | 'ready' | 'error';
type FacingMode     = 'environment' | 'user';
type ActiveExercise = 'squat' | 'curl' | 'press';
type AnyResult      = SquatResult | BicepCurlResult | ShoulderPressResult;
/** Lo que pinta el overlay; común a los dos motores. */
type OverlayResult  = Pick<AnyResult, 'reps' | 'feedbackLevel' | 'feedbackMessage'>;

const EXERCISE_NAMES: Record<ActiveExercise, string> = {
  squat: 'Sentadillas',
  curl:  'Curl de Bíceps',
  press: 'Press de Hombro',
};

const EXERCISE_ICONS: Record<ActiveExercise, React.ReactNode> = {
  squat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="4" r="2" />
      <path d="M12 6v4l-3 4h6l-3-4" />
      <path d="M9 14l-2 5" />
      <path d="M15 14l2 5" />
    </svg>
  ),
  curl: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2"  y="11" width="4" height="3" rx="1" />
      <rect x="18" y="11" width="4" height="3" rx="1" />
      <rect x="5"  y="10" width="3" height="5" rx="1" />
      <rect x="16" y="10" width="3" height="5" rx="1" />
      <line x1="8" y1="12.5" x2="16" y2="12.5" />
    </svg>
  ),
  press: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="3" r="1.5" />
      <line x1="12" y1="5"  x2="12" y2="13" />
      <line x1="12" y1="9"  x2="6"  y2="4"  />
      <line x1="6"  y1="4"  x2="4"  y2="2"  />
      <line x1="12" y1="9"  x2="18" y2="4"  />
      <line x1="18" y1="4"  x2="20" y2="2"  />
      <line x1="12" y1="13" x2="9"  y2="19" />
      <line x1="12" y1="13" x2="15" y2="19" />
    </svg>
  ),
};

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

/** Cada cuántos frames se refresca el contador del botón de grabación. */
const RECORD_UI_EVERY = 15;

/** Frase de técnica al confirmar el pico o fondo en el motor 3D (mismas frases que el 2D, DEC-016). */
function peakPhrase(ex: ActiveExercise, extremeDeg: number): string {
  if (ex === 'squat') return extremeDeg < GOOD_DEPTH_ANGLE ? '¡Excelente profundidad!' : 'Baja un poco más';
  if (ex === 'curl')  return extremeDeg < GOOD_FORM_ANGLE ? '¡Excelente contracción!' : 'Sube un poco más';
  return extremeDeg >= GOOD_LOCKOUT_ANGLE ? '¡Extensión completa!' : 'Extiende un poco más';
}

/** Intervalo mínimo entre avisos de repetición descartada, en ms. */
const REJECTION_SPEECH_MS = 2000;
/** Espera antes de ofrecer el permiso de sensores en iOS si no llegó ninguna lectura, en ms. */
const MOTION_PERMISSION_WAIT_MS = 1500;

/** Texto del indicador de nivelación del motor 3D. */
function levelLabel(d: FrameDiagnostics): string {
  if (!d.leveled) return 'Acomoda el teléfono más vertical';
  const parts = ['3D'];
  if (d.phoneTiltDeg !== null) parts.push(`nivelado ${Math.round(d.phoneTiltDeg)}°`);
  if (d.calibrationDeg !== null) parts.push(`calibrado ${Math.round(d.calibrationDeg)}°`);
  return parts.join(' · ');
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
  // Flag para delay de liberación de hardware al cambiar de cámara
  const cameraStopPendingRef = useRef(false);
  // Buffer del modo grabación (?debug=record). Vacío y sin uso fuera del flag.
  const recordingRef = useRef<RecordedFrame[]>([]);
  // Motor 3D (?engine=3d, DEC-057). Sin el flag no se usan.
  const pipelineRef       = useRef<FramePipeline | null>(null);
  const gravityRef        = useRef<DeviceGravityTracker | null>(null);
  const pendingFormRef    = useRef<string>('');
  const lastRejectRef     = useRef<number>(0);
  const lastOverlayKeyRef = useRef<string>('');
  const lastCalibrationRef = useRef<number | null>(null);

  const [status, setStatus]                 = useState<Status>('loading');
  const [errorMsg, setErrorMsg]             = useState('');
  const [facingMode, setFacingMode]         = useState<FacingMode>(() => {
    try {
      const v = localStorage.getItem('preferred_camera');
      return (v === 'user' || v === 'environment') ? v : 'environment';
    } catch { return 'environment'; }
  });
  const [activeExercise, setActiveExercise] = useState<ActiveExercise>('squat');
  const [exerciseResult, setExerciseResult] = useState<OverlayResult | null>(null);
  // Solo se actualiza en modo grabación, y cada RECORD_UI_EVERY frames.
  const [recordedCount, setRecordedCount]   = useState(0);
  // Solo en el motor 3D: indicador de nivelación y oferta del permiso de sensores (iOS).
  const [levelInfo, setLevelInfo]           = useState('');
  const [needsMotion, setNeedsMotion]       = useState(false);

  const speak = useSpeech();

  useEffect(() => {
    let cancelled = false;
    let motionTimer: ReturnType<typeof setTimeout> | undefined;
    setStatus('loading');

    if (!navigator.mediaDevices) {
      setErrorMsg('Contexto no seguro: abrí la app con HTTPS, no HTTP.');
      setStatus('error');
      return;
    }

    async function setup() {
      try {
        // Si se acaba de detener una cámara, esperar a que el hardware se libere.
        // track.stop() es síncrono pero el dispositivo libera el sensor ~300-500ms
        // después; llamar getUserMedia antes causa "Could not start video source".
        if (cameraStopPendingRef.current) {
          cameraStopPendingRef.current = false;
          await new Promise<void>(resolve => setTimeout(resolve, 450));
          if (cancelled) return;
        }

        await initPoseDetector();
        if (cancelled || !videoRef.current) return;

        const stream = await startCamera(videoRef.current, facingMode);
        streamRef.current = stream;
        if (!cancelled) setStatus('ready');

        if (ENGINE_3D) {
          // Cámara nueva: la calibración y el filtro empiezan de cero.
          if (!pipelineRef.current) pipelineRef.current = new FramePipeline(DEFINITIONS_3D[activeExRef.current]);
          else pipelineRef.current.reset();
        }
        // El acelerómetro se usa en el motor 3D y para guardar la gravedad al grabar (DEC-055).
        if (ENGINE_3D || RECORD_MODE) {
          if (!gravityRef.current) gravityRef.current = new DeviceGravityTracker();
          gravityRef.current.start();
          if (motionPermissionRequired()) {
            motionTimer = setTimeout(() => {
              if (!cancelled && !gravityRef.current?.hasReading) setNeedsMotion(true);
            }, MOTION_PERMISSION_WAIT_MS);
          }
        }

        function loop() {
          if (cancelled || !videoRef.current || !canvasRef.current) return;

          const landmarkSets = detectAndDraw(videoRef.current, canvasRef.current, performance.now());

          if (landmarkSets.length > 0) {
            const ex = activeExRef.current;

            // Modo grabación de fixtures (?debug=record): acumular el frame crudo.
            // Fuera del flag esto es una comparación booleana por frame.
            if (RECORD_MODE) {
              const buf = recordingRef.current;
              buf.push(captureFrame(
                performance.now(),
                landmarkSets[0],
                getLastWorldLandmarks(),
                gravityRef.current?.worldDown(facingMode) ?? null,
              ));
              if (buf.length % RECORD_UI_EVERY === 0) setRecordedCount(buf.length);
            }

            if (ENGINE_3D) {
              const world = getLastWorldLandmarks();
              const pipeline = pipelineRef.current;
              if (world && pipeline) handle3D(pipeline.process({
                world,
                t: performance.now(),
                worldDown: gravityRef.current?.worldDown(facingMode) ?? null,
              }), ex);
              rafRef.current = requestAnimationFrame(loop);
              return;
            }

            const result: AnyResult = (() => {
              if (ex === 'squat') return squatTrackerRef.current.update(landmarkSets[0]);
              if (ex === 'curl')  return curlTrackerRef.current.update(landmarkSets[0]);
              return pressTrackerRef.current.update(landmarkSets[0]);
            })();

            const prevReps = prevRepsRef.current;

            if (prevReps >= 0) {
              if (result.reps > prevReps) {
                if (ex === 'squat') {
                  if (performance.now() - lastSpeakTimeRef.current > 1500) {
                    speak(repPhrase(result.reps));
                    lastSpeakTimeRef.current = performance.now();
                  }
                } else if (ex === 'curl') {
                  const formMsg = curlFormFeedbackRef.current;
                  speak(formMsg ? `${repPhrase(result.reps)}. ${formMsg}` : repPhrase(result.reps));
                  curlFormFeedbackRef.current = '';
                  lastSpeakTimeRef.current = performance.now();
                } else {
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
                  curlFormFeedbackRef.current = r.minAngleReached < GOOD_FORM_ANGLE
                    ? '¡Excelente contracción!'
                    : 'Sube un poco más';
                }
              } else {
                const r = result as ShoulderPressResult;
                if (r.atPeak) {
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
        /**
         * Voz y overlay del motor 3D. Misma política que el 2D (DEC-016): la sentadilla
         * habla en el fondo y el conteo se limita a uno cada 1,5 s; curl y press guardan
         * la frase del pico y la dicen junto con el número. El overlay solo se actualiza
         * cuando cambia lo que muestra (evita el setState por frame).
         */
        function handle3D(out: ReturnType<FramePipeline['process']>, ex: ActiveExercise) {
          const r: Tracker3DResult = out.result;
          const now = performance.now();
          if (r.repCounted) {
            if (ex === 'squat') {
              if (now - lastSpeakTimeRef.current > 1500) {
                speak(repPhrase(r.reps));
                lastSpeakTimeRef.current = now;
              }
            } else {
              const formMsg = pendingFormRef.current;
              speak(formMsg ? `${repPhrase(r.reps)}. ${formMsg}` : repPhrase(r.reps));
              pendingFormRef.current = '';
              lastSpeakTimeRef.current = now;
            }
          } else if (r.peak) {
            if (ex === 'squat') {
              speak(peakPhrase(ex, r.extremeDeg));
              lastSpeakTimeRef.current = now;
            } else {
              pendingFormRef.current = peakPhrase(ex, r.extremeDeg);
            }
          } else if (r.rejectionMessage && now - lastRejectRef.current > REJECTION_SPEECH_MS) {
            speak(r.rejectionMessage);
            lastRejectRef.current = now;
          }

          lastCalibrationRef.current = out.diagnostics.calibrationDeg;
          const label = levelLabel(out.diagnostics);
          const key = `${r.reps}|${r.feedbackLevel}|${r.feedbackMessage}|${label}`;
          if (key !== lastOverlayKeyRef.current) {
            lastOverlayKeyRef.current = key;
            setExerciseResult({ reps: r.reps, feedbackLevel: r.feedbackLevel, feedbackMessage: r.feedbackMessage });
            setLevelInfo(label);
          }
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
      if (motionTimer) clearTimeout(motionTimer);
      gravityRef.current?.stop();
      if (streamRef.current) {
        stopCamera(streamRef.current);
        streamRef.current = null;
        // Limpiar srcObject para que el navegador libere la referencia al stream
        // detenido y el hardware suelte el sensor antes del siguiente getUserMedia.
        // Sin esto, algunos dispositivos ignoran el delay de 450 ms (DEC-021).
        if (videoRef.current) videoRef.current.srcObject = null;
        cameraStopPendingRef.current = true;
      }
    };
  }, [facingMode, speak]);

  function handleSelectExercise(next: ActiveExercise) {
    if (activeExRef.current === next) return;
    activeExRef.current = next;
    setActiveExercise(next);
    squatTrackerRef.current.reset();
    curlTrackerRef.current.reset();
    pressTrackerRef.current.reset();
    prevRepsRef.current          = -1;
    curlFormFeedbackRef.current  = '';
    pressFormFeedbackRef.current = '';
    setExerciseResult(null);
    if (ENGINE_3D) {
      pipelineRef.current?.setExercise(DEFINITIONS_3D[next]);
      pendingFormRef.current    = '';
      lastOverlayKeyRef.current = '';
    }
    // Un fixture pertenece a un solo ejercicio: cambiar de chip descarta lo grabado.
    if (RECORD_MODE) {
      recordingRef.current = [];
      setRecordedCount(0);
    }
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

      {/* Motor 3D (?engine=3d, DEC-057) y grabación: nivelación, permiso de sensores y cierre de serie */}
      {(ENGINE_3D || RECORD_MODE) && status === 'ready' && (
        <div className="engine3d-bar">
          {levelInfo && <span className="engine3d-level">{levelInfo}</span>}
          {needsMotion && (
            <button
              className="engine3d-btn"
              onClick={() => {
                // iOS: el permiso debe pedirse directamente desde el toque, antes de cualquier await.
                void requestMotionPermission().then(ok => {
                  if (ok) gravityRef.current?.start();
                  setNeedsMotion(!ok);
                });
              }}
            >
              Nivelar con el sensor
            </button>
          )}
          {ENGINE_3D && (
            <button
              className="engine3d-btn"
              onClick={() => {
                pipelineRef.current?.startNewSet();
                speak('Nueva serie');
              }}
            >
              Nueva serie
            </button>
          )}
        </div>
      )}

      {/* Modo grabación de fixtures — solo con ?debug=record (ver fixtures/README.md) */}
      {RECORD_MODE && status === 'ready' && (
        <button
          className="record-fixture-btn"
          onClick={() => {
            const frames = recordingRef.current;
            if (frames.length === 0) return;
            downloadFixture(activeExRef.current, frames, {
              script: RECORD_SCRIPT,
              engine: ENGINE_3D ? '3d' : '2d',
              ...(ENGINE_3D ? { calibrationDeg: lastCalibrationRef.current } : {}),
            });
            recordingRef.current = [];
            setRecordedCount(0);
          }}
        >
          Guardar grabación ({recordedCount} frames)
        </button>
      )}

      {status === 'ready' && (
        <div className="bottom-controls">
          {/* Selector de ejercicio — chips horizontales con scroll */}
          <div className="exercise-scroller" role="group" aria-label="Seleccionar ejercicio">
            {(Object.keys(EXERCISE_NAMES) as ActiveExercise[]).map(ex => (
              <button
                key={ex}
                className={`exercise-chip${activeExercise === ex ? ' active' : ''}`}
                onClick={() => handleSelectExercise(ex)}
                aria-pressed={activeExercise === ex}
              >
                {EXERCISE_ICONS[ex]}
                <span>{EXERCISE_NAMES[ex]}</span>
              </button>
            ))}
          </div>

          {/* Selector de cámara */}
          <button
            className="camera-control-btn"
            onClick={() => {
              const next: FacingMode = facingMode === 'environment' ? 'user' : 'environment';
              try { localStorage.setItem('preferred_camera', next); } catch { /* storage bloqueado */ }
              setFacingMode(next);
            }}
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
        </div>
      )}
    </div>
  );
}
