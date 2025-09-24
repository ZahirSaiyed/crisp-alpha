export async function decodeToPCM16kMono(blob: Blob): Promise<{ pcm: Float32Array; sampleRate: number; durationSec: number }> {
  const arrayBuf = await blob.arrayBuffer();
  const ACctor = (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
  const OfflineCtor = (globalThis as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!ACctor || !OfflineCtor) throw new Error("Web Audio API not supported");
  const ctx = new ACctor();
  const decoded: AudioBuffer = await new Promise((resolve, reject) => {
    ctx.decodeAudioData(arrayBuf.slice(0), resolve, reject);
  });
  (ctx as unknown as { close?: () => Promise<void> }).close?.();
  const targetSr = 16000;
  const length = Math.max(1, Math.ceil(decoded.duration * targetSr));
  const offline = new OfflineCtor(1, length, targetSr);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  const mono = rendered.getChannelData(0);
  return { pcm: new Float32Array(mono), sampleRate: targetSr, durationSec: decoded.duration };
} 