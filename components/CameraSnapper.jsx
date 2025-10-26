"use client";
import { useEffect, useRef, useState } from "react";

/** Props:
 *  onCapture: (blob: Blob, objectUrl: string) => void
 *  open: boolean
 *  onClose: () => void
 *  facingMode?: "user" | "environment"
 */
export default function CameraSnapper({ open, onClose, onCapture, facingMode = "user" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState(facingMode);

  useEffect(() => {
    if (!open) { stop(); return; }
    start(mode);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  async function start(facing) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing } }, audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.playsInline = true; // iOS Safari
        v.muted = true;
        await v.play();
        setReady(true);
      }
    } catch (e) {
      console.error("Camera error:", e);
      alert("Could not access camera. Check permissions.");
      onClose?.();
    }
  }

  function stop() {
    setReady(false);
    const s = streamRef.current;
    s?.getTracks()?.forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function capture() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
    const url = URL.createObjectURL(blob);
    onCapture?.(blob, url);
    onClose?.();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-black rounded-xl border border-white/15 p-3 w-full max-w-md">
        <div className="aspect-[3/4] bg-black/50 rounded overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setMode((m) => (m === "user" ? "environment" : "user"))}
            className="px-3 py-2 text-sm rounded bg-white/10 hover:bg-white/20"
          >
            Switch Camera
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm rounded bg-white/10 hover:bg-white/20">
              Cancel
            </button>
            <button
              onClick={capture}
              disabled={!ready}
              className="px-3 py-2 text-sm rounded bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
            >
              Capture
            </button>
          </div>
        </div>
        <p className="text-xs text-white/60 mt-2">
          Tip: Works best over HTTPS and with camera permissions granted.
        </p>
      </div>
    </div>
  );
}
