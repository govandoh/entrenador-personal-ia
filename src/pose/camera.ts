export async function startCamera(
  videoEl: HTMLVideoElement,
  facingMode: 'environment' | 'user' = 'environment'
): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  });

  videoEl.srcObject = stream;

  await new Promise<void>((resolve) => {
    videoEl.onloadedmetadata = () => resolve();
  });

  await videoEl.play();
  return stream;
}

export function stopCamera(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
