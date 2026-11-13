"use client";

import { useEffect, useRef, useState } from "react";

export type Attempt = { url: string; score: number; duration: number };
type Session = { recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; started: number; scene: string; discard: boolean };
const MAX_RECORDING_MS = 8_000;

function microphoneMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access is off. Allow the microphone in your browser's site settings, then try again.";
  if (name === "NotFoundError") return "No microphone was found. Connect one, then try again.";
  if (name === "NotReadableError") return "Your microphone is busy. Close any app using it, then try again.";
  return "Recording couldn't start. Check your microphone and try again.";
}

export function useWordRecorder(scene: string) {
  const [recordings, setRecordings] = useState<Record<string, Attempt[]>>({});
  const [status, setStatus] = useState<"idle" | "requesting" | "recording" | "saving">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<number | null>(null);
  const active = useRef<Session | null>(null);
  const version = useRef(0);
  const urls = useRef<string[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clock = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const count = useRef(0);
  const locked = useRef(false);
  const attempts = recordings[scene] || [];
  count.current = attempts.length;

  function stopPlayback() {
    if (audio.current) {
      audio.current.pause(); audio.current.removeAttribute("src"); audio.current.load(); audio.current = null;
    }
    setPlaying(null);
  }

  function clearTimers() {
    clearTimeout(timeout.current); clearInterval(clock.current);
  }

  function discardSession() {
    version.current++;
    clearTimers();
    if (active.current) {
      active.current.discard = true;
      if (active.current.recorder.state !== "inactive") active.current.recorder.stop();
      active.current.stream.getTracks().forEach(track => track.stop());
      active.current = null;
    }
    locked.current = false;
  }

  useEffect(() => {
    setStatus("idle"); setElapsed(0); setError(""); setPlaying(null);
    return () => {
      discardSession();
      if (audio.current) {
        audio.current.pause(); audio.current.removeAttribute("src"); audio.current.load(); audio.current = null;
      }
    };
    // Each scene change cancels in-flight microphone requests and active capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)); }, []);

  function stop() {
    const session = active.current;
    if (!session || session.recorder.state !== "recording") return;
    clearTimers(); setStatus("saving");
    session.recorder.stop();
    session.stream.getTracks().forEach(track => track.stop());
  }

  async function start() {
    if (locked.current || count.current >= 3) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record here. Open the demo in a current browser over HTTPS (or localhost)."); return;
    }
    stopPlayback(); setError(""); setElapsed(0); setStatus("requesting"); locked.current = true;
    const requestVersion = ++version.current;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (requestVersion !== version.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const session: Session = { recorder, stream, chunks: [], started: performance.now(), scene, discard: false };
      active.current = session;
      recorder.ondataavailable = event => { if (event.data.size) session.chunks.push(event.data); };
      recorder.onerror = () => {
        session.discard = true; session.stream.getTracks().forEach(track => track.stop());
        if (requestVersion === version.current) { clearTimers(); active.current = null; setStatus("idle"); setError("The recording was interrupted. Please record this attempt again."); locked.current = false; }
      };
      recorder.onstop = () => {
        session.stream.getTracks().forEach(track => track.stop());
        if (session.discard || requestVersion !== version.current) return;
        clearTimers();
        const duration = (performance.now() - session.started) / 1000;
        const blob = new Blob(session.chunks, { type: recorder.mimeType || session.chunks[0]?.type || "audio/webm" });
        if (blob.size && duration >= 0.35) {
          const url = URL.createObjectURL(blob); urls.current.push(url);
          // Explicitly random demo feedback. No audio is sent to a grading service.
          const attempt = { url, score: Math.floor(Math.random() * 45) + 55, duration };
          setRecordings(previous => ({ ...previous, [session.scene]: [...(previous[session.scene] || []), attempt].slice(0, 3) }));
        } else {
          setError("That take was too short. Tap Record, say the word, then tap Stop.");
        }
        active.current = null; locked.current = false; setStatus("idle");
      };
      recorder.start(); setStatus("recording");
      timeout.current = setTimeout(stop, MAX_RECORDING_MS);
      clock.current = setInterval(() => setElapsed(Math.min(8, (performance.now() - session.started) / 1000)), 100);
    } catch (cause) {
      stream?.getTracks().forEach(track => track.stop());
      if (requestVersion === version.current) { locked.current = false; setStatus("idle"); setError(microphoneMessage(cause)); }
    }
  }

  async function replay(index: number) {
    const attempt = attempts[index];
    if (!attempt) return;
    if (playing === index) { stopPlayback(); return; }
    stopPlayback();
    const player = new Audio(attempt.url); audio.current = player; setPlaying(index);
    player.onended = () => { if (audio.current === player) setPlaying(null); };
    try { await player.play(); }
    catch { if (audio.current === player) { setPlaying(null); setError("Your recording couldn't play. Check your browser's audio settings and tap Replay again."); } }
  }

  return { attempts, status, elapsed, error, start, stop, replay, playing, stopPlayback };
}
