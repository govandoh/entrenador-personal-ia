import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startCamera, stopCamera } from '../../pose/camera';
import { initPoseDetector, detectAndDraw, getLastWorldLandmarks } from '../../pose/poseDetector';
import { DeviceGravityTracker, motionPermissionRequired, requestMotionPermission } from '../../pose/deviceGravity';
import { RECORD_MODE, RECORD_SCRIPT, captureFrame, downloadFixture, type RecordedFrame } from '../../testing/fixtureRecorder';
import { SquatTracker, type SquatResult } from '../../exercises/squat';
import { BicepCurlTracker, type BicepCurlResult } from '../../exercises/bicepCurl';
import { ShoulderPressTracker, type ShoulderPressResult } from '../../exercises/shoulderPress';
import { PlankTracker, type PlankResult } from '../../exercises/plankTracker';
import type { FeedbackLevel } from '../../exercises/tracker3d';
import { FramePipeline } from '../../analysis/framePipeline';
import { SetSummaryBuilder, type SetSummary } from '../../analysis/setSummary';
import { FeedbackPolicy } from '../../feedback/feedbackPolicy';
import type { AssistantId } from '../../domain/catalog';
import { useSpeech } from '../useSpeech';
import { appActions, useAppState } from '../state/appStore';
import { ASSISTED, ASSISTED_NAMES, catalogIdFor, isAssistantId, usesEngine3D } from './exercises';
import {
  DEFAULT_TARGET_REPS, FEEDBACK_STRATEGY, PLANK_ANNOUNCE_EVERY_S, PLANK_WARNING_MIN_MS,
  definitionFor, fatigueSummary, peakPhrase,
} from './coaching';
import { AUTO_START_MS, LEVEL_OK_DEG, bodyInFrame, bubbleOffset, isReady, phoneTilt, type PrepState } from './prep';
import { PrepPanel } from './PrepPanel';
import { SetHud, type HudState } from './SetHud';
import { SetSummaryView } from './SetSummaryView';
import { IconBack, IconSwitchCamera, IconVoice, IconVoiceOff } from '../components/icons';
import './workout.css';

type Status = 'loading' | 'ready' | 'error';
type Phase = 'prep' | 'active' | 'summary';
type FacingMode = 'environment' | 'user';
type Result2D = SquatResult | BicepCurlResult | ShoulderPressResult;

/** Espera antes de ofrecer el permiso de sensores en iOS si no llegó ninguna lectura, en ms. */
const MOTION_PERMISSION_WAIT_MS = 1500;
/** Radio útil del nivelador para la burbuja, en px (círculo de 176 px, burbuja de 34 px). */
const BUBBLE_TRAVEL_PX = 62;
/** Suavizado de la burbuja por cuadro: sigue al sensor sin temblar (DESIGN.md §6). */
const BUBBLE_SMOOTHING = 0.18;
/** Cada cuántos frames se refresca el contador del botón de grabación. */
const RECORD_UI_EVERY = 15;

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  // Un Event (fallo al descargar el WASM o el modelo) no trae mensaje útil.
  if (typeof Event !== 'undefined' && err instanceof Event) return 'no se pudo descargar el detector de poses; revisa tu conexión.';
  try { return JSON.stringify(err); } catch { return String(err); }
}

function newId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
}

const EMPTY_HUD: HudState = { reps: 0, level: 'idle', message: '', extreme: null, lastConcentricMs: null, qualities: [], rejected: 0 };

export function WorkoutScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { voiceEnabled } = useAppState();
  const initialEx = params.get('ex');
  const targetReps = Number(params.get('reps')) || DEFAULT_TARGET_REPS;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const cameraStopPendingRef = useRef(false);

  const [ex, setEx] = useState<AssistantId>(isAssistantId(initialEx) ? initialEx : 'squat');
  const [phase, setPhase] = useState<Phase>('prep');
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [facingMode, setFacingMode] = useState<FacingMode>(() => {
    try {
      const v = localStorage.getItem('preferred_camera');
      return v === 'user' || v === 'environment' ? v : 'environment';
    } catch { return 'environment'; }
  });
  const [setNumber, setSetNumber] = useState(1);
  const [prep, setPrep] = useState<PrepState>({ levelOk: null, bodyOk: false, calibration: null });
  const [tilt, setTilt] = useState<number | null>(null);
  const [needsMotion, setNeedsMotion] = useState(false);
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [summary, setSummary] = useState<{ summary: SetSummary | null; heldSeconds: number | null } | null>(null);
  const [recordedCount, setRecordedCount] = useState(0);

  // Estado leído desde el bucle de cuadros (evita closures viejos).
  const exRef = useRef(ex);
  const phaseRef = useRef<Phase>('prep');
  const voiceRef = useRef(voiceEnabled);
  const squatRef = useRef(new SquatTracker());
  const curlRef = useRef(new BicepCurlTracker());
  const pressRef = useRef(new ShoulderPressTracker());
  const plankRef = useRef(new PlankTracker());
  const pipelineRef = useRef<FramePipeline | null>(null);
  const gravityRef = useRef<DeviceGravityTracker | null>(null);
  const policyRef = useRef(new FeedbackPolicy(FEEDBACK_STRATEGY[ex]));
  const builderRef = useRef(new SetSummaryBuilder());
  const prevRepsRef = useRef(-1);
  const lastPeakLevelRef = useRef<FeedbackLevel>('good');
  const readySinceRef = useRef<number | null>(null);
  const prepKeyRef = useRef('');
  const hudKeyRef = useRef('');
  const hudRef = useRef<HudState>(EMPTY_HUD);
  const plankAnnouncedRef = useRef(0);
  const plankWarnedAtRef = useRef(-Infinity);
  const plankSecondsRef = useRef(0);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bubblePos = useRef({ x: 0, y: 0 });
  const recordingRef = useRef<RecordedFrame[]>([]);
  const startSetRef = useRef<() => void>(() => {});

  const rawSpeak = useSpeech();
  const speak = useCallback((text: string) => { if (voiceRef.current && text) rawSpeak(text); }, [rawSpeak]);

  useEffect(() => { voiceRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { exRef.current = ex; }, [ex]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /** HUD: solo se actualiza cuando cambia lo que se ve, nunca por cuadro. */
  const pushHud = useCallback((next: HudState) => {
    hudRef.current = next;
    const key = `${next.reps}|${next.level}|${next.message}|${next.extreme}|${next.qualities.join('')}|${next.rejected}`;
    if (key === hudKeyRef.current) return;
    hudKeyRef.current = key;
    setHud(next);
  }, []);

  function resetCounters(next: AssistantId) {
    squatRef.current.reset();
    curlRef.current.reset();
    pressRef.current.reset();
    plankRef.current.reset();
    plankAnnouncedRef.current = 0;
    plankSecondsRef.current = 0;
    prevRepsRef.current = -1;
    lastPeakLevelRef.current = 'good';
    builderRef.current = new SetSummaryBuilder();
    policyRef.current = new FeedbackPolicy(FEEDBACK_STRATEGY[next]);
    hudKeyRef.current = '';
    pushHud(EMPTY_HUD);
    if (usesEngine3D(next)) {
      if (!pipelineRef.current) pipelineRef.current = new FramePipeline(definitionFor(next));
      else if (pipelineRef.current.definition !== definitionFor(next)) pipelineRef.current.setExercise(definitionFor(next));
    }
  }

  function startSet() {
    resetCounters(exRef.current);
    pipelineRef.current?.startNewSet();
    readySinceRef.current = null;
    phaseRef.current = 'active';
    setPhase('active');
    speak(exRef.current === 'plank' ? 'Mantén la posición' : '¡Vamos!');
  }
  // El bucle de cuadros arranca la serie sola; lee siempre la versión actual.
  useEffect(() => { startSetRef.current = startSet; });

  function finishSet() {
    const current = exRef.current;
    const timed = current === 'plank';
    const s = timed ? null : builderRef.current.summary();
    const held = timed ? plankSecondsRef.current : null;
    phaseRef.current = 'summary';
    setSummary({ summary: s, heldSeconds: held });
    setPhase('summary');
    const valid = timed ? held ?? 0 : s?.validReps ?? 0;
    if (valid > 0) {
      appActions.addSet({
        id: newId(),
        completedAt: new Date().toISOString(),
        exerciseId: catalogIdFor(current),
        validReps: valid,
        rejectedReps: s?.rejectedReps ?? 0,
        goodReps: timed ? valid : s?.goodReps ?? 0,
        timed,
        fatigue: s ? fatigueSummary(s.fatigue.level, s.validReps) : null,
      });
    }
    speak(timed ? `Serie completada. ${valid} segundos` : `Serie completada. ${valid} repeticiones`);
  }

  function selectExercise(next: AssistantId) {
    if (next === exRef.current) return;
    exRef.current = next;
    setEx(next);
    setSetNumber(1);
    resetCounters(next);
    readySinceRef.current = null;
    prepKeyRef.current = '';
    if (RECORD_MODE) { recordingRef.current = []; setRecordedCount(0); }
  }

  function nextSet() {
    setSummary(null);
    setSetNumber(n => n + 1);
    resetCounters(exRef.current);
    readySinceRef.current = null;
    prepKeyRef.current = '';
    phaseRef.current = 'prep';
    setPhase('prep');
  }

  useEffect(() => {
    let cancelled = false;
    let motionTimer: ReturnType<typeof setTimeout> | undefined;
    const video = videoRef.current;
    if (!navigator.mediaDevices) return;

    async function setup() {
      try {
        // Tras detener una cámara, el hardware tarda ~300-500 ms en liberarse (DEC-021).
        if (cameraStopPendingRef.current) {
          cameraStopPendingRef.current = false;
          await new Promise<void>(resolve => setTimeout(resolve, 450));
          if (cancelled) return;
        }
        await initPoseDetector();
        if (cancelled || !videoRef.current) return;
        streamRef.current = await startCamera(videoRef.current, facingMode);
        if (cancelled) return;
        setStatus('ready');

        // Cámara nueva: filtro y calibración desde cero.
        pipelineRef.current?.reset();
        if (usesEngine3D(exRef.current) && !pipelineRef.current) pipelineRef.current = new FramePipeline(definitionFor(exRef.current));

        // El acelerómetro alimenta el nivelador, el motor 3D y la gravedad de las grabaciones.
        if (!gravityRef.current) gravityRef.current = new DeviceGravityTracker();
        gravityRef.current.start();
        if (motionPermissionRequired()) {
          motionTimer = setTimeout(() => {
            if (!cancelled && !gravityRef.current?.hasReading) setNeedsMotion(true);
          }, MOTION_PERMISSION_WAIT_MS);
        }

        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(serializeError(err));
          setStatus('error');
        }
      }
    }

    function loop() {
      if (cancelled || !videoRef.current || !canvasRef.current) return;
      const now = performance.now();
      const landmarkSets = detectAndDraw(videoRef.current, canvasRef.current, now);
      const worldDown = gravityRef.current?.worldDown(facingMode) ?? null;
      const current = exRef.current;
      const engine3D = usesEngine3D(current);
      const world = landmarkSets.length > 0 ? getLastWorldLandmarks() : null;

      if (RECORD_MODE && landmarkSets.length > 0) {
        const buf = recordingRef.current;
        buf.push(captureFrame(now, landmarkSets[0], getLastWorldLandmarks(), worldDown));
        if (buf.length % RECORD_UI_EVERY === 0) setRecordedCount(buf.length);
      }

      if (phaseRef.current === 'prep') {
        updateBubble(worldDown);
        let calibration: number | null = null;
        if (engine3D && world && pipelineRef.current) {
          // En preparación solo se aprende la calibración de pie (el contador no cuenta).
          calibration = pipelineRef.current.prepare({ world, t: now, worldDown }).diagnostics.calibrationProgress;
        } else if (engine3D) {
          calibration = 0;
        }
        const tiltDeg = phoneTilt(worldDown);
        const next: PrepState = {
          levelOk: tiltDeg === null ? null : tiltDeg <= LEVEL_OK_DEG,
          bodyOk: bodyInFrame(landmarkSets[0], current),
          calibration: calibration === null ? null : Math.round(calibration * 10) / 10,
        };
        const key = `${next.levelOk}|${next.bodyOk}|${next.calibration}|${tiltDeg === null ? '' : Math.round(tiltDeg)}`;
        if (key !== prepKeyRef.current) {
          prepKeyRef.current = key;
          setPrep(next);
          setTilt(tiltDeg === null ? null : Math.round(tiltDeg));
        }
        if (isReady(next)) {
          readySinceRef.current ??= now;
          if (now - readySinceRef.current >= AUTO_START_MS) startSetRef.current();
        } else {
          readySinceRef.current = null;
        }
      } else if (phaseRef.current === 'active' && landmarkSets.length > 0) {
        if (engine3D) {
          if (world && pipelineRef.current) {
            const input = { world, t: now, worldDown };
            if (current === 'plank') {
              const prepared = pipelineRef.current.prepare(input);
              handlePlank(plankRef.current.update(prepared.world, now), now);
            } else {
              handle3D(pipelineRef.current.process(input), current, now);
            }
          }
        } else {
          handle2D(landmarkSets[0], current, now);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    /** Burbuja del nivelador: `transform` directo sobre el elemento, sin renders de React. */
    function updateBubble(worldDown: Parameters<typeof bubbleOffset>[0]) {
      const target = bubbleOffset(worldDown, BUBBLE_TRAVEL_PX);
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const k = reduce ? 1 : BUBBLE_SMOOTHING;
      bubblePos.current.x += (target.x - bubblePos.current.x) * k;
      bubblePos.current.y += (target.y - bubblePos.current.y) * k;
      if (bubbleRef.current) {
        bubbleRef.current.style.transform = `translate(${bubblePos.current.x.toFixed(1)}px, ${bubblePos.current.y.toFixed(1)}px)`;
      }
    }

    function handle3D(out: ReturnType<FramePipeline['process']>, current: AssistantId, now: number) {
      const r = out.result;
      builderRef.current.addFrame(r);
      for (const u of policyRef.current.decide({
        now, reps: builderRef.current.validReps, repCounted: r.repCounted,
        peakPhrase: r.peak ? peakPhrase(current, r.extremeDeg) : null,
        rejectionMessage: r.rejectionMessage,
      })) speak(u);

      // El contador del motor acumula entre series; el HUD y la voz cuentan la serie en curso.
      const b = builderRef.current;
      const prev = hudRef.current;
      const s = r.repCounted || r.rejection ? b.summary() : null;
      pushHud({
        reps: b.validReps,
        level: r.rejectionMessage ? 'bad' : r.feedbackLevel,
        message: r.rejectionMessage ?? r.feedbackMessage,
        extreme: r.peak ? Math.round(r.extremeDeg) : prev.extreme,
        lastConcentricMs: s ? s.reps.at(-1)?.concentricMs ?? prev.lastConcentricMs : prev.lastConcentricMs,
        qualities: s ? s.reps.map(x => x.quality) : prev.qualities,
        rejected: s ? s.rejectedReps : prev.rejected,
      });
    }

    function handle2D(landmarks: Parameters<SquatTracker['update']>[0], current: AssistantId, now: number) {
      const result: Result2D = current === 'squat' ? squatRef.current.update(landmarks)
        : current === 'curl' ? curlRef.current.update(landmarks)
          : pressRef.current.update(landmarks);
      const peakAngle =
        current === 'squat' ? ((result as SquatResult).atBottom ? (result as SquatResult).minAngleReached : null)
          : current === 'curl' ? ((result as BicepCurlResult).atTop ? (result as BicepCurlResult).minAngleReached : null)
            : ((result as ShoulderPressResult).atPeak ? (result as ShoulderPressResult).maxAngleReached : null);
      if (peakAngle !== null) lastPeakLevelRef.current = result.feedbackLevel;

      const prevReps = prevRepsRef.current;
      if (prevReps >= 0) {
        for (const u of policyRef.current.decide({
          now, reps: result.reps, repCounted: result.reps > prevReps,
          peakPhrase: peakAngle === null ? null : peakPhrase(current, peakAngle),
        })) speak(u);
        if (result.reps > prevReps) builderRef.current.addRep2D(lastPeakLevelRef.current);
      }
      prevRepsRef.current = result.reps;

      const prev = hudRef.current;
      const s = builderRef.current.summary();
      pushHud({
        reps: s.validReps,
        level: result.feedbackLevel,
        message: result.feedbackMessage,
        extreme: peakAngle !== null ? Math.round(peakAngle) : prev.extreme,
        lastConcentricMs: null,
        qualities: s.reps.map(x => x.quality),
        rejected: 0,
      });
    }

    function handlePlank(r: PlankResult, now: number) {
      plankSecondsRef.current = r.heldSeconds;
      if (r.heldSeconds >= plankAnnouncedRef.current + PLANK_ANNOUNCE_EVERY_S) {
        plankAnnouncedRef.current = r.heldSeconds - (r.heldSeconds % PLANK_ANNOUNCE_EVERY_S);
        speak(`${plankAnnouncedRef.current} segundos`);
      } else if (r.formIssue && now - plankWarnedAtRef.current > PLANK_WARNING_MIN_MS) {
        plankWarnedAtRef.current = now;
        speak(r.feedbackMessage);
      }
      pushHud({ ...hudRef.current, reps: r.heldSeconds, level: r.feedbackLevel, message: r.feedbackMessage, extreme: Math.round(r.bodyLineDeg) });
    }

    void setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (motionTimer) clearTimeout(motionTimer);
      gravityRef.current?.stop();
      if (streamRef.current) {
        stopCamera(streamRef.current);
        streamRef.current = null;
        // Soltar srcObject para que el hardware se libere antes del siguiente getUserMedia (DEC-021).
        if (video) video.srcObject = null;
        cameraStopPendingRef.current = true;
      }
    };
  }, [facingMode, speak, pushHud]);

  function askMotion() {
    // iOS: el permiso se pide directamente desde el toque, antes de cualquier await.
    void requestMotionPermission().then(ok => {
      if (ok) gravityRef.current?.start();
      setNeedsMotion(!ok);
    });
  }

  function switchCamera() {
    const next: FacingMode = facingMode === 'environment' ? 'user' : 'environment';
    try { localStorage.setItem('preferred_camera', next); } catch { /* storage bloqueado */ }
    setStatus('loading');
    setFacingMode(next);
  }

  // Sin contexto seguro no existe `mediaDevices`: la cámara no puede arrancar.
  const insecure = typeof navigator !== 'undefined' && !navigator.mediaDevices;
  const shownStatus: Status = insecure ? 'error' : status;
  const shownError = insecure ? 'abre la app con HTTPS: la cámara no funciona en una conexión no segura.' : errorMsg;

  const mirrorStyle = facingMode === 'user' ? { transform: 'scaleX(-1)' } : undefined;
  const levelPill = needsMotion
    ? <button className="pill pill--amber" onClick={askMotion}>Nivelar</button>
    : tilt === null
      ? null
      : <span className={`pill ${tilt <= LEVEL_OK_DEG ? 'pill--volt' : 'pill--amber'}`}>{tilt}°</span>;

  return (
    <div className="workout">
      <video ref={videoRef} className="workout__video" style={mirrorStyle} playsInline muted />
      <canvas ref={canvasRef} className="workout__canvas" style={mirrorStyle} />

      <header className="workout__top">
        <button className="icon-btn icon-btn--glass" aria-label="Salir del entrenamiento" onClick={() => navigate(-1)}><IconBack /></button>
        <div className="workout__title">
          <strong>{ASSISTED_NAMES[ex]}</strong>
          <span>Serie {setNumber}</span>
        </div>
        {levelPill}
        <button className="icon-btn icon-btn--glass" aria-label={voiceEnabled ? 'Silenciar voz' : 'Activar voz'} aria-pressed={voiceEnabled}
          onClick={() => appActions.setVoice(!voiceEnabled)}>
          {voiceEnabled ? <IconVoice /> : <IconVoiceOff />}
        </button>
        <button className="icon-btn icon-btn--glass" aria-label="Cambiar cámara" onClick={switchCamera}><IconSwitchCamera /></button>
      </header>

      {shownStatus === 'loading' && <p className="workout__status" role="status">Preparando la cámara y el detector…</p>}
      {shownStatus === 'error' && <p className="workout__status workout__status--error" role="alert">No se pudo iniciar la cámara: {shownError}</p>}

      {status === 'ready' && phase === 'prep' && (
        <PrepPanel
          ex={ex}
          exercises={ASSISTED}
          names={ASSISTED_NAMES}
          onSelect={selectExercise}
          prep={prep}
          tilt={tilt}
          bubbleRef={bubbleRef}
          onStart={() => startSetRef.current()}
        />
      )}

      {status === 'ready' && phase === 'active' && (
        <SetHud
          ex={ex}
          hud={hud}
          target={ex === 'plank' ? null : targetReps}
          engine3D={usesEngine3D(ex)}
          onFinish={finishSet}
          onCancel={nextSet}
        />
      )}

      {phase === 'summary' && summary && (
        <SetSummaryView
          ex={ex}
          setNumber={setNumber}
          summary={summary.summary}
          heldSeconds={summary.heldSeconds}
          onNextSet={nextSet}
          onFinish={() => navigate('/', { replace: true })}
        />
      )}

      {RECORD_MODE && status === 'ready' && (
        <button
          className="record-fixture-btn"
          onClick={() => {
            const frames = recordingRef.current;
            if (frames.length === 0) return;
            downloadFixture(exRef.current, frames, { script: RECORD_SCRIPT, engine: usesEngine3D(exRef.current) ? '3d' : '2d' });
            recordingRef.current = [];
            setRecordedCount(0);
          }}
        >
          Guardar grabación ({recordedCount} frames)
        </button>
      )}
    </div>
  );
}

