"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { generationPrompt, type DramaEpisode } from "../../lib/drama-episode";
import { composeScenePrompt } from "../../lib/scene-prompt";
import { MAX_IMAGE_BYTES, MAX_PROMPT_LENGTH, VEO_MODEL, validateImage, type JobStatus, type Readiness } from "../../lib/veo-contract";
import { DEFAULT_SETTINGS, formatScenePrompt, parseDraft, parseTake, sameTake, type CreatorSettings, type SavedTake, type TakeSnapshot } from "./creator-state";
import styles from "./creator.module.css";

type Phase = "idle" | "submitting" | "pending" | "complete" | "error";
const TAKE_KEY = "scene-creator:take:v1";
const DRAFT_KEY = "scene-creator:draft:v1";
const LEGACY_KEY = "scene-lab:veo-job";

function Icon({ name, size = 20 }: { name: "add" | "arrow" | "film" | "spark" | "download" | "close" | "check"; size?: number }) {
  const paths = {
    add: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    film: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />,
    download: <path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function saveTake(take: SavedTake | null) {
  try {
    if (take) localStorage.setItem(TAKE_KEY, JSON.stringify(take));
    else localStorage.removeItem(TAKE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* Generation still works when browser storage is unavailable. */ }
}

export default function SceneCreator({ episodes }: { episodes: DramaEpisode[] }) {
  const [episodeId, setEpisodeId] = useState(episodes[0].id);
  const [shotId, setShotId] = useState(episodes[0].shots[0].id);
  const [prompt, setPrompt] = useState(episodes[0].shots[0].scenePrompt);
  const [settings, setSettings] = useState<CreatorSettings>({ ...DEFAULT_SETTINGS });
  const [image, setImage] = useState<File | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [imageChecking, setImageChecking] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [connection, setConnection] = useState<Readiness | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [take, setTake] = useState<SavedTake | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [paused, setPaused] = useState(false);
  const [retry, setRetry] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const submitLock = useRef(false);
  const imageChoice = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = phase === "submitting" || phase === "pending";
  const locked = busy || imageChecking;
  const episode = episodes.find(item => item.id === episodeId) || episodes[0];
  const shot = episode.shots.find(item => item.id === shotId) || episode.shots[0];
  const basePrompt = formatScenePrompt(generationPrompt({ ...shot, scenePrompt: prompt }, !!image), settings);
  const focusWord = shot.focusWord;
  const effectivePrompt = composeScenePrompt(basePrompt, focusWord, { generateAudio: settings.generateAudio });
  const promptValid = basePrompt.trim().length >= 10 && effectivePrompt.length <= MAX_PROMPT_LENGTH;
  const currentSnapshot: TakeSnapshot = {
    episodeId: episode.id, episodeTitle: episode.title, shotId: shot.id, shotTitle: shot.title,
    focusWord: shot.focusWord, effectivePrompt, settings, referenceId, referenceName: image?.name || null,
  };
  const mismatched = !!take && (!take.snapshot || !sameTake(take.snapshot, currentSnapshot));
  const shownSettings = take?.snapshot?.settings || settings;
  const job = take?.job;

  useEffect(() => {
    try {
      const draft = parseDraft(sessionStorage.getItem(DRAFT_KEY));
      const savedEpisode = episodes.find(item => item.id === draft?.episodeId);
      if (draft && savedEpisode?.shots.some(item => item.id === draft.shotId)) {
        setEpisodeId(draft.episodeId); setShotId(draft.shotId);
        setPrompt(draft.prompt); setSettings(draft.settings);
      }
      let saved = parseTake(localStorage.getItem(TAKE_KEY));
      const legacyJob = localStorage.getItem(LEGACY_KEY);
      if (!saved && legacyJob) { saved = { job: legacyJob, snapshot: null }; saveTake(saved); }
      if (saved) { setTake(saved); setPhase("pending"); }
    } catch { /* Browser storage is optional. */ }
    setHydrated(true);
  }, [episodes]);

  useEffect(() => {
    if (!hydrated) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ episodeId, shotId, prompt, settings })); }
    catch { /* Edits remain available in this page. */ }
  }, [hydrated, episodeId, shotId, prompt, settings]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/veo", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Connection check failed");
        const result = await response.json() as Readiness;
        if (!controller.signal.aborted) setConnection(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setConnection({ ready: false, requiresPassword: false, message: "The cloud connection could not be checked. Try checking again." });
      });
    return () => controller.abort();
  }, [connectionAttempt]);

  useEffect(() => {
    if (!image) { setPreview(null); return; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    if (!job) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    setPaused(false); setMessage("");
    async function check() {
      try {
        const response = await fetch(`/api/veo/status?job=${encodeURIComponent(job!)}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json() as JobStatus & { error?: string };
        if (controller.signal.aborted) return;
        if (!response.ok) {
          if (response.status >= 500 || response.status === 429) {
            setPaused(true); setMessage(result.error || "We couldn't check this clip. Check again in a moment.");
          } else {
            saveTake(null); setPhase("error");
            setMessage(result.error || "This clip could not be generated.");
          }
          return;
        }
        if (result.state === "complete") {
          setVideoUrl(result.videoUrl); setPhase("complete"); return;
        }
        if (result.state === "error") {
          saveTake(null); setPhase("error"); setMessage(result.error); return;
        }
        if (result.state !== "pending") throw new Error("Unexpected generation status");
        if (Date.now() - started > 15 * 60 * 1000) {
          setPaused(true); setMessage("This scene is taking longer than usual. Your request is saved; check again shortly."); return;
        }
        timer = setTimeout(check, Math.max(5, result.retryAfterSeconds || 10) * 1000);
      } catch {
        if (!controller.signal.aborted) {
          setPaused(true); setMessage("The connection was interrupted. Your request is saved; check again when you're online.");
        }
      }
    }
    void check();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [job, retry]);

  function chooseScene(nextEpisodeId: string, nextShotId?: string) {
    if (locked) return;
    const nextEpisode = episodes.find(item => item.id === nextEpisodeId)!;
    const nextShot = nextEpisode.shots.find(item => item.id === nextShotId) || nextEpisode.shots[0];
    setEpisodeId(nextEpisode.id); setShotId(nextShot.id); setPrompt(nextShot.scenePrompt);
  }

  async function chooseImage(file?: File) {
    if (!file || busy) return;
    const choice = ++imageChoice.current;
    setImageChecking(true);
    try {
      if (file.size > MAX_IMAGE_BYTES) throw new Error("Choose a photo smaller than 5 MB.");
      validateImage(new Uint8Array(await file.arrayBuffer()), file.type);
      if (choice !== imageChoice.current) return;
      setImage(file); setReferenceId(crypto.randomUUID()); setMessage("");
    } catch (error) {
      if (choice === imageChoice.current) setMessage(error instanceof Error ? error.message : "This photo could not be read. Choose it again.");
    } finally {
      if (choice === imageChoice.current) setImageChecking(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || locked || !hydrated || !connection?.ready || !promptValid) return;
    submitLock.current = true;
    const snapshot = currentSnapshot;
    setPhase("submitting"); setMessage(""); setVideoUrl(null); setTake(null); setPaused(false); saveTake(null);
    const body = new FormData();
    body.set("prompt", basePrompt);
    body.set("focusWord", focusWord);
    for (const [key, value] of Object.entries(settings)) body.set(key, String(value));
    if (image) body.set("image", image);
    try {
      const response = await fetch("/api/veo", { method: "POST", body });
      const result = await response.json() as { job?: string; error?: string };
      if (!response.ok || !result.job) throw new Error(result.error || "Google did not confirm a generation. Check the request before trying again.");
      const submitted = { job: result.job, snapshot };
      saveTake(submitted); setTake(submitted); setPhase("pending");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof TypeError ? "The submission connection ended. Google may still have accepted the request. Check before starting another paid generation." : error instanceof Error ? error.message : "The request could not be confirmed. Check before starting another paid generation.");
    } finally { submitLock.current = false; }
  }

  return (
    <main className={styles.app}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/scene-creator"><span className={styles.brandMark}><Icon name="film" size={22} /></span>scene<span className={styles.brandLight}>creator</span></Link>
          <Link href="/" className={styles.backLink}>← Back to learning</Link>
        </header>

        <section className={styles.intro}>
          <div className={styles.eyebrow}><span />FINDING LOVE AT A HACKATHON</div>
          <h1>Scene <em>Creator</em></h1>
          <p>Choose a moment from the story. Make it your own. Direct one short scene at a time.</p>
        </section>

        <section className={styles.catalog} aria-labelledby="catalog-title">
          <div className={styles.catalogHeading}>
            <div><span className={styles.number}>01 / CHOOSE YOUR MOMENT</span><h2 id="catalog-title">A little drama. One useful word.</h2></div>
            <label className={styles.episodeSelect}>Episode<select value={episode.id} disabled={locked} onChange={event => chooseScene(event.target.value)}>{episodes.map(item => <option key={item.id} value={item.id}>Episode {item.number} · {item.title}</option>)}</select></label>
          </div>
          <div className={styles.sceneList} aria-label="Scenes">
            {episode.shots.map((item, index) => <button type="button" key={item.id} disabled={locked} aria-pressed={shot.id === item.id} className={`${styles.sceneCard} ${shot.id === item.id ? styles.selectedScene : ""}`} onClick={() => chooseScene(episode.id, item.id)}><span>SCENE {String(index + 1).padStart(2, "0")}</span><strong>{item.focusWord}</strong></button>)}
          </div>
          <div className={styles.sceneSummary}><span className={styles.focusWord}>{shot.focusWord}</span><span>{shot.meaning}</span><span className={styles.dialogue}>{shot.dialogue && <>Your line: “{shot.dialogue}”</>}</span></div>
        </section>

        <div className={styles.workspace}>
          <form className={styles.editor} onSubmit={generate}>
            <div className={styles.sectionLabel}><span className={styles.number}>02</span><h2>Your reference photo</h2><span className={styles.optional}>OPTIONAL</span></div>
            <div className={`${styles.upload} ${dragging ? styles.dragging : ""}`} onDragOver={event => { event.preventDefault(); if (!locked) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!locked) void chooseImage(event.dataTransfer.files[0]); }}>
              <input ref={fileInput} id="scene-photo" type="file" accept="image/jpeg,image/png" disabled={locked} onChange={event => void chooseImage(event.target.files?.[0])} className={styles.fileInput} />
              <label htmlFor="scene-photo" className={styles.uploadLabel}>
                {preview ? <img className={styles.photo} src={preview} alt="Your selected reference" /> : <span className={styles.uploadIcon}><Icon name="add" size={22} /></span>}
                <span><strong>{imageChecking ? "Checking your photo…" : image ? image.name : "Add a selfie or reference"}</strong><small>{image ? "Reused when you change scenes" : "Drop a photo here, or browse files"}<span>JPEG or PNG · up to 5 MB</span></small></span>
              </label>
              {image && <button className={styles.removePhoto} type="button" disabled={locked} aria-label="Remove photo" onClick={() => { setImage(null); setReferenceId(null); }}><Icon name="close" size={16} /></button>}
            </div>
            <p className={styles.hint}>Your photo becomes the starting frame and stays selected across scenes. Reattach it after a reload.</p>

            <div className={styles.sectionLabel}><span className={styles.number}>03</span><h2><label htmlFor="scene-prompt">Direct the scene</label></h2><button className={styles.textButton} type="button" disabled={locked} onClick={() => setPrompt(shot.scenePrompt)}>Reset prompt</button></div>
            <div className={styles.promptBox}>
              <textarea id="scene-prompt" minLength={10} maxLength={MAX_PROMPT_LENGTH} required value={prompt} disabled={locked} onChange={event => setPrompt(event.target.value)} aria-describedby="prompt-hint" />
              <div className={styles.promptBottom}><span>SCENE {shot.id}</span><span>{effectivePrompt.length}/{MAX_PROMPT_LENGTH} including direction</span></div>
            </div>
            <p className={styles.hint} id="prompt-hint">Edit the action, camera, or dialogue. Your selected word is <strong>{shot.focusWord}</strong>.</p>

            <fieldset className={styles.settings} disabled={locked}>
              <legend><span className={styles.number}>04</span> Generation settings</legend>
              <div className={styles.settingsGrid}>
                <label>Duration<select value={settings.durationSeconds} onChange={event => setSettings(previous => ({ ...previous, durationSeconds: Number(event.target.value) as CreatorSettings["durationSeconds"] }))}><option value="4" disabled={settings.resolution === "1080p"}>4 seconds</option><option value="6" disabled={settings.resolution === "1080p"}>6 seconds</option><option value="8">8 seconds</option></select></label>
                <label>Format<select value={settings.aspectRatio} onChange={event => setSettings(previous => ({ ...previous, aspectRatio: event.target.value as CreatorSettings["aspectRatio"] }))}><option value="9:16">Portrait · 9:16</option><option value="16:9">Landscape · 16:9</option></select></label>
                <label>Resolution<select value={settings.resolution} onChange={event => setSettings(previous => ({ ...previous, resolution: event.target.value as CreatorSettings["resolution"], ...(event.target.value === "1080p" ? { durationSeconds: 8 } : {}) }))}><option value="720p">720p</option><option value="1080p">1080p · 8 seconds</option></select></label>
                <div className={styles.model}><span>Model</span><strong>Veo 3.1 Fast</strong></div>
              </div>
              <label className={styles.audioToggle}><input type="checkbox" checked={settings.generateAudio} onChange={event => setSettings(previous => ({ ...previous, generateAudio: event.target.checked }))} /><span><strong>Generate full scene audio</strong><small>Dialogue, ambience, music, and effects. Only “{shot.focusWord}” is instructed to be silently mouthed.</small></span></label>
              {!settings.generateAudio && <p className={styles.audioNotice}>Audio is off. This take will be a silent clip.</p>}
              {settings.resolution === "1080p" && <p className={styles.hint}>1080p is available for eight-second clips.</p>}
            </fieldset>

            <details className={styles.effectivePrompt}>
              <summary>Preview final generation prompt</summary>
              <p>This is the composed prompt sent to Veo with the settings above.</p>
              <pre data-testid="effective-prompt">{effectivePrompt}</pre>
            </details>
            {!promptValid && <p className={styles.validation} role="alert">{basePrompt.trim().length < 10 ? "Describe your scene in at least 10 characters." : `Shorten the prompt to ${MAX_PROMPT_LENGTH} characters including audio direction.`}</p>}

            <div className={styles.generateArea}>
              <button className={styles.generate} disabled={locked || !hydrated || !connection?.ready || !promptValid} type="submit"><Icon name="spark" size={19} /><span>{phase === "submitting" ? "Sending your scene…" : phase === "pending" ? "Your scene is generating…" : "Generate scene"}</span>{!busy && <Icon name="arrow" size={20} />}</button>
              <span className={styles.generateNote}>One clip per request · each generation uses Google Cloud credit</span>
            </div>
            {connection && !connection.ready && <div className={styles.setupNotice}><strong>Cloud connection needed</strong><p>{connection.message}</p><button type="button" className={styles.textButton} onClick={() => { setConnection(null); setConnectionAttempt(value => value + 1); }}>Check connection again</button></div>}
            {message && <div className={styles.message} role="alert">{message}{paused && <button type="button" onClick={() => { setRetry(value => value + 1); }}>Check this clip again <Icon name="arrow" size={15} /></button>}</div>}
          </form>

          <section className={styles.output} aria-labelledby="preview-title">
            <div className={styles.previewHeading}><h2 id="preview-title">Your scene preview</h2><span className={styles.takeStatus}><span className={`${styles.statusDot} ${phase === "complete" ? styles.greenDot : ""}`} />{phase === "complete" ? "READY TO WATCH" : busy ? "IN PRODUCTION" : "READY WHEN YOU ARE"}</span></div>
            <div className={styles.theater}>
              {phase === "complete" && videoUrl ? <video key={videoUrl} className={styles.video} src={videoUrl} controls playsInline preload="metadata" aria-label="Your generated scene" onError={() => { setPaused(true); setMessage("This video could not be loaded. Check this clip again to retrieve it."); }} /> : <>
                <span className={styles.frameTop}>SCENE CREATOR</span><span className={styles.frameFormat}>{take && !take.snapshot ? "EARLIER TAKE" : shownSettings.aspectRatio}</span>
                <div className={styles.frameContent} aria-live="polite">
                  <div className={`${styles.aperture} ${busy && !paused ? styles.spinning : ""}`}><Icon name="film" size={32} /></div>
                  <h3>{phase === "pending" ? (paused ? "Your request is saved." : "A scene is taking shape.") : phase === "submitting" ? "And… action." : phase === "error" ? "Your next take awaits." : "Put yourself in the story."}</h3>
                  <p>{phase === "pending" ? (paused ? "Check its progress when you're ready. No new generation is needed." : "Google is creating your clip. This can take a few minutes.") : phase === "submitting" ? "Sending your scene to Google Cloud." : phase === "error" ? "Review the message in the editor before trying again." : `Episode ${episode.number} · ${episode.title} · ${shot.title}`}</p>
                </div>
                <div className={styles.frameBottom}><span>+</span><span>ONE MOMENT. YOUR STORY.</span><span>+</span></div>
              </>}
            </div>
            {take && !take.snapshot ? <p className={styles.hint}>Restored from the original creator. Its prompt and settings were not saved.</p> : <div className={styles.clipDetails}><span><strong>{shownSettings.durationSeconds}</strong> seconds</span><span><strong>{shownSettings.aspectRatio}</strong></span><span><strong>{shownSettings.resolution}</strong></span><span className={styles.audioBadge}>{shownSettings.generateAudio ? "SCENE AUDIO" : "AUDIO OFF"}</span></div>}
            {mismatched && <div className={styles.mismatch} role="status">{take?.snapshot ? "This preview belongs to a previous take. Generate again to apply your current scene, prompt, photo, or settings." : "This is an earlier take. Generate to use your current scene and settings."}</div>}
            {take?.snapshot && <details className={styles.takeDetails}><summary>Take details · {take.snapshot.shotId}</summary><p>{take.snapshot.episodeTitle} · {take.snapshot.shotTitle}</p><p>Reference: {take.snapshot.referenceName || "No photo"}</p><pre>{take.snapshot.effectivePrompt}</pre></details>}
            {phase === "complete" && videoUrl && <div className={styles.finished}><div><span className={styles.successIcon}><Icon name="check" size={16} /></span><span>Ready for a closer look.</span></div><a href={videoUrl} download={`${take?.snapshot?.shotId || "my-scene"}.mp4`}><Icon name="download" size={16} />Download video</a></div>}
            <div className={styles.directorsNote}><span className={styles.noteSymbol}>✳</span><div><h3>Let the scene speak.</h3><p>With audio on, Veo is asked to keep the soundtrack natural while your character silently mouths “{shot.focusWord}”. Review your take: that selective silence is a prompt instruction, and the result can vary.</p></div></div>
            <div className={styles.modelNote}>Google Cloud · <code>{VEO_MODEL}</code></div>
          </section>
        </div>
        <footer className={styles.footer}><span>Small scenes. Bigger possibilities.</span><Link href="/">Continue the learning story <Icon name="arrow" size={16} /></Link></footer>
      </div>
    </main>
  );
}
