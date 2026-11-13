"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_IMAGE_BYTES, validateImage } from "../../lib/veo-contract";

type Photo = { file: File; fingerprint: string };

async function photo(file: File): Promise<Photo> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Choose a photo smaller than 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateImage(bytes, file.type);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return { file, fingerprint: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("") };
}

function usePreview(file?: File) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const next = URL.createObjectURL(file); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

export function useSceneReferences() {
  const [learner, setLearner] = useState<Photo | null>(null);
  const [cast, setCast] = useState<Photo | null>(null);
  const [loadingCast, setLoadingCast] = useState(true);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [castError, setCastError] = useState("");
  const [reload, setReload] = useState(0);
  const version = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingCast(true); setCastError("");
    void fetch("/api/cast-reference", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Lucy reference unavailable");
      const blob = await response.blob();
      const reference = await photo(new File([blob], "lucy.png", { type: blob.type }));
      if (!controller.signal.aborted) setCast(reference);
    }).catch(() => {
      if (!controller.signal.aborted) { setCast(null); setCastError("Lucy's reference photo couldn't load."); }
    }).finally(() => { if (!controller.signal.aborted) setLoadingCast(false); });
    return () => controller.abort();
  }, [reload]);

  async function chooseLearner(file?: File) {
    if (!file) return;
    const selected = ++version.current;
    setReading(true); setError("");
    try {
      const reference = await photo(file);
      if (selected === version.current) setLearner(reference);
    } catch (cause) {
      if (selected === version.current) setError(cause instanceof Error ? cause.message : "Choose a JPEG or PNG photo.");
    } finally { if (selected === version.current) setReading(false); }
  }

  const same = Boolean(learner && cast && learner.fingerprint === cast.fingerprint);
  return {
    learner: learner?.file || null,
    cast: cast?.file || null,
    learnerPreview: usePreview(learner?.file),
    castPreview: usePreview(cast?.file),
    referenceKey: learner && cast && !same ? `${learner.fingerprint}:${cast.fingerprint}` : "",
    loading: reading || loadingCast,
    error: same ? "Choose your own photo. Lucy is already included separately." : error,
    castError,
    chooseLearner,
    removeLearner: () => { version.current++; setReading(false); setLearner(null); setError(""); },
    reloadCast: () => setReload(value => value + 1),
  };
}
