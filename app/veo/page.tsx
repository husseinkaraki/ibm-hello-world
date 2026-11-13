"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MAX_IMAGE_BYTES, MAX_PROMPT_LENGTH, type JobStatus, type Readiness } from "../../lib/veo-contract";
import styles from "./veo.module.css";

type Phase = "idle" | "submitting" | "pending" | "complete" | "error";
const STORAGE_KEY = "scene-lab:veo-job";
const SCENES = [
  { label: "A café encounter", prompt: "A cinematic medium shot of an adult traveler at a sunlit Parisian café. They notice a handwritten note beside their coffee, glance up with a curious smile, and turn toward the door. Warm morning light, gentle camera movement, natural expressions, no text or subtitles." },
  { label: "The last train", prompt: "A cinematic close-up of an adult traveler on a quiet train platform at golden hour. As the train arrives, they recognize an old friend through the window and break into a delighted smile. Soft film grain, slow camera push-in, natural movement, no text or subtitles." },
];

function Icon({ name, size = 20 }: { name: "add" | "arrow" | "film" | "spark" | "download" | "close" | "check"; size?: number }) {
  const paths = {
    add: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    film: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4" /></>,
    close: <><path d="m6 6 12 12M6 18 18 6" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function forgetSavedJob() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
}

export default function VeoPage() {
  const [prompt, setPrompt] = useState(SCENES[0].prompt);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [connection, setConnection] = useState<Readiness | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [job, setJob] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [paused, setPaused] = useState(false);
  const [retry, setRetry] = useState(0);
  const [password, setPassword] = useState("");
  const [dragging, setDragging] = useState(false);
  const submitLock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = phase === "submitting" || phase === "pending";

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/veo", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Connection check failed");
        setConnection(await response.json() as Readiness);
      })
      .catch(() => {
        if (!controller.signal.aborted) setConnection({ ready: false, requiresPassword: false, message: "The cloud connection could not be checked. Refresh the page to try again." });
      });
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { setJob(saved); setPhase("pending"); }
    } catch { /* Private browsing may disable storage. */ }
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!image) { setPreview(null); return; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    if (!job) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    setPaused(false);
    setMessage("");
    async function check() {
      try {
        const response = await fetch(`/api/veo/status?job=${encodeURIComponent(job!)}`, {
          cache: "no-store", signal: controller.signal,
        });
        const result = await response.json() as JobStatus & { error?: string };
        if (controller.signal.aborted) return;
        if (!response.ok) {
          if (response.status >= 500 || response.status === 429) {
            setPaused(true);
            setMessage(result.error || "We couldn't check this clip. Check again in a moment.");
          } else {
            forgetSavedJob(); setJob(null); setPhase("error");
            setMessage(result.error || "This clip could not be generated.");
          }
          return;
        }
        if (result.state === "complete") {
          setVideoUrl(result.videoUrl); setPhase("complete");
          return;
        }
        if (result.state !== "pending") throw new Error("Unexpected generation status");
        if (Date.now() - started > 15 * 60 * 1000) {
          setPaused(true); setMessage("This scene is taking longer than usual. Your generation is saved; check again shortly.");
          return;
        }
        timer = setTimeout(check, Math.max(5, result.retryAfterSeconds) * 1000);
      } catch {
        if (!controller.signal.aborted) {
          setPaused(true); setMessage("The connection was interrupted. Your generation is saved; check again when you're online.");
        }
      }
    }
    void check();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [job, retry]);

  function chooseImage(file?: File) {
    if (!file || busy) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setMessage("Choose a JPEG or PNG photo."); return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage("Choose a photo smaller than 5 MB."); return;
    }
    setImage(file); setMessage("");
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || busy) return;
    submitLock.current = true;
    setPhase("submitting"); setMessage(""); setVideoUrl(null); setJob(null);
    forgetSavedJob();
    const body = new FormData();
    body.set("prompt", prompt);
    if (image) body.set("image", image);
    try {
      const response = await fetch("/api/veo", {
        method: "POST", body,
        headers: password ? { "x-veo-password": password } : {},
      });
      const result = await response.json() as { job?: string; error?: string };
      if (!response.ok || !result.job) throw new Error(result.error || "Google did not confirm a generation. Check the request before trying again.");
      try { localStorage.setItem(STORAGE_KEY, result.job); } catch { /* Still works without persistence. */ }
      setJob(result.job); setPhase("pending");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof TypeError ? "The submission connection ended. Google may still have accepted the request; check before submitting again." : error instanceof Error ? error.message : "The submission connection ended. Google may still have accepted the request; check before submitting again.");
    } finally {
      submitLock.current = false;
    }
  }

  return (
    <main className={styles.app}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <a className={styles.brand} href="/veo" aria-label="Scene Lab home"><span className={styles.brandMark}><Icon name="film" size={22} /></span>scene<span className={styles.brandLight}>lab</span><span className={styles.beta}>EXPERIMENT 01</span></a>
          <div className={styles.provider}><span className={styles.providerDot} />Made with Veo 3.1<span className={styles.providerDivider}>/</span><span>Google Cloud</span></div>
        </header>

        <section className={styles.intro}>
          <div className={styles.eyebrow}><span />YOUR LANGUAGE, IN MOTION</div>
          <h1>Put yourself in the <em>scene.</em></h1>
          <p>A familiar face. An unfamiliar place. Turn a little imagination into your next short film.</p>
        </section>

        <div className={styles.workspace}>
          <form className={styles.editor} onSubmit={generate}>
            <div className={styles.sectionLabel}><span className={styles.number}>01</span><h2>Start with you</h2><span className={styles.optional}>OPTIONAL</span></div>
            <div className={`${styles.upload} ${dragging ? styles.dragging : ""} ${preview ? styles.hasPhoto : ""}`} onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseImage(event.dataTransfer.files[0]); }}>
              <input ref={fileInput} id="scene-photo" type="file" accept="image/jpeg,image/png" disabled={busy} onChange={(event) => chooseImage(event.target.files?.[0])} className={styles.fileInput} />
              <label htmlFor="scene-photo" className={styles.uploadLabel}>
                {preview ? <img className={styles.photo} src={preview} alt="Your selected starting frame" /> : <span className={styles.uploadIcon}><Icon name="add" size={22} /></span>}
                <span><strong>{image ? image.name : "Add your photo"}</strong><small>{image ? "Your scene's starting frame" : "Drop a selfie here, or browse files"}<span>{image ? "Click to replace" : "JPEG or PNG · up to 5 MB"}</span></small></span>
              </label>
              {image && <button className={styles.removePhoto} type="button" disabled={busy} aria-label="Remove photo" onClick={() => { setImage(null); if (fileInput.current) fileInput.current.value = ""; }}><Icon name="close" size={16} /></button>}
            </div>
            <p className={styles.photoHint}>Use a clear photo of yourself. It becomes the first frame of your scene.</p>

            <div className={styles.sectionLabel}><span className={styles.number}>02</span><h2><label htmlFor="scene-prompt">Set the scene</label></h2></div>
            <div className={styles.promptBox}>
              <textarea id="scene-prompt" name="prompt" minLength={10} maxLength={MAX_PROMPT_LENGTH} required value={prompt} disabled={busy} onChange={(event) => setPrompt(event.target.value)} placeholder="Where are you? What happens next? Describe one small cinematic moment…" aria-describedby="prompt-hint" />
              <div className={styles.promptBottom}><span>THE SMALL DETAILS MAKE THE SCENE</span><span>{prompt.length}/{MAX_PROMPT_LENGTH}</span></div>
            </div>
            <div className={styles.inspiration}><span>Try a scene</span>{SCENES.map((scene) => <button type="button" key={scene.label} onClick={() => setPrompt(scene.prompt)} disabled={busy}>{scene.label}<span>↗</span></button>)}</div>
            <p className={styles.promptHint} id="prompt-hint">Writing in English works best. With a photo, describe how the person moves and what happens around them.</p>

            {connection?.requiresPassword && <label className={styles.password}>Demo password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} /></label>}

            <div className={styles.generateArea}>
              <button className={styles.generate} disabled={busy || !connection?.ready} type="submit"><Icon name="spark" size={19} /><span>{phase === "submitting" ? "Sending your scene…" : phase === "pending" ? "Your scene is generating…" : "Generate my scene"}</span>{!busy && <Icon name="arrow" size={20} />}</button>
              <span className={styles.generateNote}>One clip per take · each generation uses Google Cloud credit</span>
            </div>

            {connection && !connection.ready && <div className={styles.setupNotice}><span className={styles.statusDot} /><div><strong>Cloud connection needed</strong><p>The studio is ready. Connect Google Cloud to generate your first scene.</p><details><summary>Connection details</summary><p>{connection.message}</p></details></div></div>}
            {message && <div className={styles.message} role="alert">{message}{paused && <button type="button" onClick={() => { setPhase("pending"); setRetry((value) => value + 1); }}>Check this clip again <Icon name="arrow" size={15} /></button>}</div>}
          </form>

          <section className={styles.output} aria-labelledby="preview-title">
            <div className={styles.previewHeading}><h2 id="preview-title">Your first take</h2><span className={styles.takeStatus}><span className={`${styles.statusDot} ${phase === "complete" ? styles.greenDot : ""}`} />{phase === "complete" ? "READY TO WATCH" : busy ? "IN PRODUCTION" : "AWAITING YOUR SCENE"}</span></div>
            <div className={styles.theater}>
              {phase === "complete" && videoUrl ? <video className={styles.video} src={videoUrl} controls playsInline preload="metadata" aria-label="Your generated scene" onError={() => { setPaused(true); setMessage("This video could not be loaded. Check this clip again to retrieve it."); }} /> : <>
                <span className={styles.frameTop}>SCENE LAB ORIGINAL</span><span className={styles.frameFormat}>16:9</span>
                <div className={styles.frameContent} aria-live="polite">
                  <div className={`${styles.aperture} ${busy && !paused ? styles.spinning : ""}`}><Icon name="film" size={32} /></div>
                  <h3>{phase === "pending" ? (paused ? "Your take is saved." : "A scene is taking shape.") : phase === "submitting" ? "And… action." : phase === "error" ? "Let's try another take." : "Every story starts somewhere."}</h3>
                  <p>{phase === "pending" ? (paused ? "Check its progress whenever you're ready." : "Google is creating your clip. This can take a few minutes.") : phase === "submitting" ? "Sending your prompt to Google Cloud." : phase === "error" ? "Check the message beside the editor." : "Your generated film will appear right here."}</p>
                </div>
                <div className={styles.frameBottom}><span className={styles.frameCross}>+</span><span>YOUR MOMENT, IN MOTION</span><span className={styles.frameCross}>+</span></div>
              </>}
            </div>
            <div className={styles.clipDetails}><span><strong>04</strong> seconds</span><span><strong>720p</strong> HD</span><span><strong>Veo 3.1</strong> Fast</span><span className={styles.silent}>SILENT CLIP</span></div>

            {phase === "complete" && videoUrl ? <div className={styles.finished}><div><span className={styles.successIcon}><Icon name="check" size={16} /></span><span>Your scene is ready. Make it yours.</span></div><a href={videoUrl} download="my-scene.mp4"><Icon name="download" size={16} />Save video</a></div> : <div className={styles.directorsNote}><span className={styles.noteSymbol}>✳</span><div><h3>A note from the director</h3><p>Think in moments, not movies. A glance across a café. A familiar face on a train. One small action makes a great first scene.</p></div></div>}

            <div className={styles.flow}><span className={styles.flowActive}>01 <span>Create a scene</span></span><span className={styles.flowLine} /><span>02 <span>Make it a lesson</span><small>UP NEXT</small></span></div>
          </section>
        </div>

        <footer className={styles.footer}><span>Small scenes. Bigger possibilities.</span><span>PERSONALIZED VIDEO EXPERIMENT <span>✳</span> 2026</span></footer>
      </div>
    </main>
  );
}
