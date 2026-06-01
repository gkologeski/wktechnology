import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "stopped" | "error";

const MAX_DURATION_MS = 120_000; // 2 minutes

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return "video/webm";
}

export function useScreenRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setStatus("idle");
    setError(null);
    setElapsedMs(0);
    chunksRef.current = [];
    recorderRef.current = null;
  }, [cleanup, previewUrl]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
  }, []);

  const start = useCallback(
    async (opts: { includeMic: boolean }) => {
      try {
        setError(null);
        setBlob(null);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        chunksRef.current = [];

        const display = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 15 },
          audio: true,
        });
        streamsRef.current.push(display);

        let combinedStream: MediaStream = display;

        if (opts.includeMic) {
          let mic: MediaStream | null = null;
          try {
            mic = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamsRef.current.push(mic);
          } catch (e) {
            console.warn("microphone denied", e);
          }

          // Mix audio tracks if mic granted
          if (mic) {
            const AudioCtx =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            const ctx = new AudioCtx();
            audioCtxRef.current = ctx;
            const dest = ctx.createMediaStreamDestination();

            const addSource = (stream: MediaStream) => {
              if (stream.getAudioTracks().length === 0) return;
              const src = ctx.createMediaStreamSource(stream);
              src.connect(dest);
            };
            addSource(display);
            addSource(mic);

            combinedStream = new MediaStream([
              ...display.getVideoTracks(),
              ...dest.stream.getAudioTracks(),
            ]);
          }
        }

        const mimeType = pickMimeType();
        const recorder = new MediaRecorder(combinedStream, { mimeType });
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const finalBlob = new Blob(chunksRef.current, { type: mimeType });
          setBlob(finalBlob);
          setPreviewUrl(URL.createObjectURL(finalBlob));
          setStatus("stopped");
          cleanup();
        };

        // Stop if user clicks browser-native "Stop sharing"
        display.getVideoTracks()[0]?.addEventListener("ended", () => stop());

        recorder.start(1000);
        startedAtRef.current = Date.now();
        setStatus("recording");
        setElapsedMs(0);

        timerRef.current = window.setInterval(() => {
          const elapsed = Date.now() - startedAtRef.current;
          setElapsedMs(elapsed);
          if (elapsed >= MAX_DURATION_MS) stop();
        }, 250);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha ao iniciar gravação";
        setError(msg);
        setStatus("error");
        cleanup();
      }
    },
    [cleanup, previewUrl, stop],
  );

  useEffect(() => {
    return () => {
      cleanup();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    error,
    blob,
    previewUrl,
    elapsedMs,
    maxDurationMs: MAX_DURATION_MS,
    start,
    stop,
    reset,
  };
}
