"use client";

import { useEffect, useRef, useState } from "react";
import type { Readiness } from "../../lib/veo-contract";

export type Generation = {
  phase: "idle" | "submitting" | "pending" | "complete" | "error" | "uncertain";
  job?: string;
  videoUrl?: string;
  message?: string;
  paused?: boolean;
};
const IDLE: Generation = { phase: "idle" };

export function useSceneGeneration(scene: string, episode: string) {
  const [records, setRecords] = useState<Record<string, Generation>>({});
  const [connection, setConnection] = useState<Readiness | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);
  const recordRef = useRef(records);
  const submitLock = useRef(false);
  const storageKey = `scene:episode:${episode}:audio-v2`;
  const current = records[scene] || IDLE;

  function update(id: string, record: Generation) {
    const next = { ...recordRef.current, [id]: record };
    recordRef.current = next;
    setRecords(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* The in-memory cache still prevents duplicate jobs. */ }
  }

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const restored: Record<string, Generation> = {};
        for (const [id, value] of Object.entries(parsed)) {
          if (!value || typeof value !== "object") continue;
          const saved = value as Generation;
          if (saved.phase === "submitting" || saved.phase === "uncertain") {
            restored[id] = { phase: "uncertain", message: "The submission wasn't confirmed. Google may have accepted it. Check Google Cloud before submitting another paid request." };
          } else if (typeof saved.job === "string" && saved.job.length <= 2048) {
            // Resume the same signed job, including after a reload. Never submit here.
            restored[id] = { phase: "pending", job: saved.job };
          }
        }
        recordRef.current = restored; setRecords(restored);
      }
    } catch { /* A malformed or unavailable cache starts with an empty session. */ }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/veo", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Connection check failed");
        const data = await response.json() as Readiness;
        if (!controller.signal.aborted) setConnection(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setConnection({ ready: false, requiresPassword: false, message: "We couldn't check the video connection. Refresh the page to try again." });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const job = current.job;
    if (!job || current.phase !== "pending" || current.paused) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    async function poll() {
      try {
        const response = await fetch(`/api/veo/status?job=${encodeURIComponent(job!)}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json() as { state?: string; videoUrl?: string; error?: string; retryAfterSeconds?: number };
        if (controller.signal.aborted) return;
        if (!response.ok || result.state === "error") {
          if (response.status >= 500 || response.status === 429) {
            update(scene, { phase: "pending", job, paused: true, message: result.error || "We couldn't check this scene. Your job is saved; check again shortly." });
          } else {
            update(scene, { phase: "error", job, message: result.error || "This scene couldn't be generated. You can explicitly request a new take." });
          }
          return;
        }
        if (result.state === "complete" && result.videoUrl?.startsWith("/api/veo/video?")) {
          update(scene, { phase: "complete", job, videoUrl: result.videoUrl }); return;
        }
        if (result.state !== "pending") throw new Error("Unexpected status");
        if (Date.now() - started > 15 * 60 * 1000) {
          update(scene, { phase: "pending", job, paused: true, message: "This scene is taking longer than usual. Your job is saved; check it again whenever you're ready." }); return;
        }
        timer = setTimeout(poll, Math.min(30, Math.max(5, result.retryAfterSeconds || 10)) * 1000);
      } catch {
        if (!controller.signal.aborted) update(scene, { phase: "pending", job, paused: true, message: "The connection was interrupted. Your existing job is saved. Check again when you're online." });
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
    // Updates within one pending job must not restart its polling timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, current.job, current.phase, current.paused, checkVersion]);

  async function generate(prompt: string, focusWord: string, image: File | null, newTake = false) {
    const existing = recordRef.current[scene];
    if (!hydrated || submitLock.current || existing?.phase === "submitting" || existing?.phase === "pending" ||
        (!newTake && (existing?.job || existing?.phase === "uncertain"))) return;
    submitLock.current = true;
    update(scene, { phase: "submitting" });
    const body = new FormData();
    body.set("prompt", prompt); body.set("durationSeconds", "8"); body.set("aspectRatio", "9:16");
    body.set("resolution", "720p"); body.set("generateAudio", "true"); body.set("focusWord", focusWord);
    if (image) body.set("image", image);
    try {
      const response = await fetch("/api/veo", { method: "POST", body });
      const result = await response.json() as { job?: string; error?: string };
      if (!response.ok || !result.job) {
        update(scene, { phase: response.status >= 500 || response.ok ? "uncertain" : "error", message: result.error || "No generation was confirmed. Check Google Cloud before submitting another request." });
        return;
      }
      update(scene, { phase: "pending", job: result.job });
    } catch {
      update(scene, { phase: "uncertain", message: "The submission connection ended. Google may still have accepted this paid request. Check Google Cloud before submitting again." });
    } finally { submitLock.current = false; }
  }

  function checkAgain() {
    if (!current.job) return;
    update(scene, { phase: "pending", job: current.job }); setCheckVersion(value => value + 1);
  }

  return { current, connection, hydrated, generate, checkAgain };
}
