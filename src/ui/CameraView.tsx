import { useEffect, useRef, useState } from 'react';
import { startCamera, stopCamera } from '../pose/camera';
import { initPoseDetector, detectAndDraw } from '../pose/poseDetector';

type Status = 'loading' | 'ready' | 'error';

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    // getUserMedia solo funciona en contextos seguros (HTTPS o localhost)
    if (!navigator.mediaDevices) {
      setErrorMsg('Contexto no seguro: abrí la app con HTTPS, no HTTP.');
      setStatus('error');
      return;
    }

    async function setup() {
      try {
        await initPoseDetector();
        if (cancelled || !videoRef.current) return;

        const stream = await startCamera(videoRef.current);
        streamRef.current = stream;
        if (!cancelled) setStatus('ready');

        function loop() {
          if (cancelled || !videoRef.current || !canvasRef.current) return;
          detectAndDraw(videoRef.current, canvasRef.current, performance.now());
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
      if (streamRef.current) stopCamera(streamRef.current);
    };
  }, []);

  return (
    <div className="camera-container">
      {status === 'loading' && (
        <p className="status-msg">Inicializando detector de poses...</p>
      )}
      {status === 'error' && (
        <p className="status-msg error">
          Error al iniciar la cámara: {errorMsg}
        </p>
      )}
      <video
        ref={videoRef}
        className="camera-video"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="camera-canvas" />
    </div>
  );
}
