export async function startCamera(videoEl: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'environment', // cámara trasera; cambiar a 'user' para front-cam
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
