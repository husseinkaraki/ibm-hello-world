"use client";

import { useRef, useState } from "react";
import type { DramaEpisode } from "../../lib/drama-episode";
import { generationPrompt } from "../../lib/drama-prompt";
import { composeScenePrompt } from "../../lib/scene-prompt";
import { useWordRecorder } from "./use-word-recorder";
import { useSceneGeneration } from "./use-scene-generation";
import { useSceneReferences } from "./use-scene-references";
import ScenePlayer from "./scene-player";
import Icon from "./icons";
import styles from "./product.module.css";

const WAVE = [8, 16, 25, 14, 32, 42, 26, 52, 34, 22, 46, 62, 36, 50, 28, 42, 20, 34, 14, 24, 12];

export default function Product({ episode }: { episode: DramaEpisode }) {
  const [index, setIndex] = useState(0);
  const [screen, setScreen] = useState<"practice" | "watch">("practice");
  const [promptOpen, setPromptOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const shot = episode.shots[index];
  const recorder = useWordRecorder(shot.id);
  const references = useSceneReferences();
  const basePrompt = generationPrompt(shot, true);
  const generation = useSceneGeneration(shot.id, episode.id, references.referenceKey, basePrompt, shot.focusWord);
  const { current, connection } = generation;
  const recording = recorder.status === "recording";
  const microphoneBusy = recorder.status !== "idle";
  const generating = current.phase === "submitting" || current.phase === "pending";
  const last = index === episode.shots.length - 1;
  const attemptsDone = recorder.attempts.length === 3;
  const disabledGeneration = !connection?.ready || !generation.hydrated || generating || references.loading || !references.referenceKey;

  function navigate(next: number, view: "practice" | "watch" = "practice") {
    recorder.stopPlayback(); setPromptOpen(false); setFinished(false); setIndex(next); setScreen(view);
    requestAnimationFrame(() => heading.current?.focus());
  }

  const startGeneration = (newTake = false) => void generation.generate(references.learner, references.cast, newTake);

  return <main className={styles.app}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <a href="/" className={styles.brand} aria-label="Drama Talk home"><span className={styles.brandMark}><Icon name="film" size={21} /></span>Drama Talk<span className={styles.brandPeriod}>.</span><span className={styles.brandDescriptor}>LEARN IT. LIVE IT.</span></a>
        <span className={styles.demoBadge}><span />HACKATHON DEMO</span>
      </header>

      <section className={styles.episodeHeader} aria-label="Episode progress">
        <div className={styles.episodeTop}><p className={styles.eyebrow}>YOUR OWN LITTLE DRAMA <span> / </span> EPISODE {String(episode.number).padStart(2, "0")}</p><p className={styles.sceneTally} aria-live="polite">Scene <strong>{index + 1}</strong> <span>of {episode.shots.length}</span></p></div>
        <h1>{episode.seriesTitle}</h1>
        <div className={styles.progress} aria-label={`Scene ${index + 1} of ${episode.shots.length}`}>{episode.shots.map((item, i) => <span key={item.id} className={i < index || finished ? styles.progressDone : i === index ? styles.progressCurrent : ""} />)}</div>
      </section>

      <div className={styles.lessonLayout}>
        <aside className={styles.storyAside}>
          <div className={styles.episodeStamp}><span>01—{String(episode.shots.length).padStart(2, "0")}</span><Icon name="spark" size={21} /></div>
          <p className={styles.eyebrow}>EPISODE {String(episode.number).padStart(2, "0")}</p>
          <h2>{episode.title}</h2>
          <p className={styles.storyDescription}>One word at a time.<br />One scene closer.</p>
          <div className={styles.steps} aria-label="Learning steps">
            <div className={screen === "practice" ? styles.stepActive : styles.stepDone}><span>{screen === "watch" ? <Icon name="check" size={14} /> : "01"}</span><div><strong>Find your voice</strong><small>One word. Three takes.</small></div></div>
            <span className={styles.stepLine} />
            <div className={screen === "watch" ? styles.stepActive : ""}><span>02</span><div><strong>Live the scene</strong><small>You’re the main character.</small></div></div>
          </div>
          <p className={styles.repeatNote}><Icon name="refresh" size={15} />Next scene, a new word.</p>
          <div className={styles.sceneInfo}><span>THIS SCENE</span><strong>{shot.title}</strong><small>~8 seconds · vertical drama</small></div>
          {index > 0 && <button type="button" className={styles.previous} disabled={microphoneBusy || current.phase === "submitting"} onClick={() => navigate(index - 1)}><Icon name="back" size={15} />Previous scene</button>}
        </aside>

        <section className={`${styles.lesson} ${screen === "watch" ? styles.watchLesson : ""}`} aria-labelledby="lesson-title">
          <div className={styles.lessonTop}><span className={styles.eyebrow}>{screen === "practice" ? "01 / FIND YOUR VOICE" : "02 / LIVE THE SCENE"}</span><span className={styles.tinyLabel}>{screen === "practice" ? "MICROPHONE EXERCISE" : current.phase === "complete" ? "READY TO WATCH" : "YOUR NEXT TAKE"}</span></div>

          {screen === "practice" ? <>
            <div className={styles.practiceHeading}><h2 id="lesson-title" tabIndex={-1} ref={heading}>Make this word yours.</h2></div>
            <div className={styles.wordBlock}><span className={styles.wordLabel}>YOUR WORD</span><p className={styles.word}>{shot.focusWord}<span>.</span></p>{shot.pronunciation && <span className={styles.pronunciation}>{shot.pronunciation}</span>}<p className={styles.meaning}>{shot.meaning}</p></div>
            <div className={`${styles.capture} ${recording ? styles.isRecording : ""}`}>
              <div className={styles.wave} aria-hidden="true">{WAVE.map((height, i) => <i key={i} style={{ height, animationDelay: `${i * 45}ms` }} />)}</div>
              <button type="button" className={`${styles.recordButton} ${recording ? styles.stopButton : ""}`} disabled={attemptsDone || recorder.status === "requesting" || recorder.status === "saving"} onClick={() => { if (recording) recorder.stop(); else void recorder.start(); }} aria-label={recording ? "Stop recording" : `Record attempt ${Math.min(3, recorder.attempts.length + 1)}`}>
                {recording ? <span className={styles.stopSquare} /> : attemptsDone ? <Icon name="check" size={27} /> : <Icon name="mic" size={27} />}
              </button>
              <p className={styles.recordHint} aria-live="polite">{recording ? `Recording · ${recorder.elapsed.toFixed(1)}s / 8s · tap to stop` : recorder.status === "requesting" ? "Allow your microphone to begin…" : recorder.status === "saving" ? "Saving your take…" : attemptsDone ? "Three takes. You’re ready for your scene." : `Tap to record take ${recorder.attempts.length + 1} of 3`}</p>
            </div>
            {recorder.error && <p className={styles.inlineMessage} role="alert">{recorder.error}</p>}
            <div className={styles.attempts} aria-label="Your three attempts">{[0, 1, 2].map(i => {
              const attempt = recorder.attempts[i];
              return <div key={i} className={`${styles.attempt} ${attempt ? styles.attemptComplete : ""}`}><div className={styles.attemptTop}><span>TAKE {String(i + 1).padStart(2, "0")}</span>{attempt ? <Icon name="check" size={14} /> : <span className={styles.emptyDot} />}</div><strong>{attempt ? <>{attempt.score}<small>/100</small></> : <span className={styles.pendingScore}>—</span>}</strong>{attempt ? <button type="button" disabled={microphoneBusy} onClick={() => void recorder.replay(i)} aria-label={`${recorder.playing === i ? "Pause" : "Play"} attempt ${i + 1}`}><Icon name={recorder.playing === i ? "pause" : "play"} size={12} />{recorder.playing === i ? "Pause" : "Replay"}</button> : <span className={styles.notRecorded}>Not recorded yet</span>}</div>;
            })}</div>
            <p className={styles.scoreNote}><span>DEMO SCORES</span>Random demo scores · not a speech assessment.</p>
            <div className={styles.practiceBottom}><span><Icon name="mic" size={14} />Recordings stay local.</span><button type="button" className={styles.primaryButton} disabled={!attemptsDone} onClick={() => navigate(index, "watch")}>Next: your scene<Icon name="arrow" size={18} /></button></div>
          </> : <>
            <div className={styles.watchHeading}><div><h2 id="lesson-title" tabIndex={-1} ref={heading}>{finished ? "To be continued…" : "Your scene"}</h2>{!finished && <p>Get ready to mouth <strong>“{shot.focusWord}”.</strong></p>}</div><button type="button" className={styles.textButton} onClick={() => navigate(index, "practice")}><Icon name="back" size={14} />Back to practice</button></div>
            <div className={`${styles.watchWorkspace} ${generating || current.phase === "complete" ? styles.watchReady : ""}`}>
              <div className={styles.theater}>
                {current.phase === "complete" && current.videoUrl ? <ScenePlayer key={`${shot.id}:${references.referenceKey}`} src={current.videoUrl} word={shot.focusWord} /> : <div className={styles.emptyTheater}>
                  <div className={styles.frameTop}><span>SCENE {String(index + 1).padStart(2, "0")}</span><span>9:16</span></div>
                  <div className={styles.frameCenter} aria-live="polite"><span className={`${styles.filmRing} ${generating && !current.paused ? styles.spinning : ""}`}><Icon name={generating ? "spark" : current.phase === "error" || current.phase === "uncertain" ? "refresh" : "play"} size={29} /></span><h3>{current.phase === "submitting" ? "Sending…" : current.phase === "pending" ? current.paused ? "Your take is saved." : "Generating your scene…" : current.phase === "error" ? "Try another take." : current.phase === "uncertain" ? "Check this request." : !references.cast ? "Lucy reference needed." : !references.learner ? "Add your photo." : "Ready for your scene."}</h3></div>
                  <div className={styles.frameBottom}><span>+</span><span>FINDING LOVE AT A HACKATHON</span><span>+</span></div>
                </div>}
                <div className={styles.clipMeta}><span>~08 SEC</span><span>FULL AUDIO</span><span>VEO 3.1 FAST</span></div>
              </div>
              <div className={styles.generationControls}>
                <div className={styles.referenceHeading}>CAST REFERENCES <span>BOTH INCLUDED IN EVERY SCENE</span></div>
                <div className={styles.referenceCards}>
                  <div className={styles.referenceCard}>
                    <div className={styles.referenceTitle}><strong>Your photo</strong><span>REQUIRED</span></div>
                    <div className={styles.referencePreview}>{references.learnerPreview ? <img src={references.learnerPreview} alt="Your character reference" /> : <Icon name="camera" size={28} />}</div>
                    <div className={styles.referenceActions}><label className={styles.photoLabel}>{references.learner ? "Replace" : "Choose photo"}<input type="file" aria-label="Your photo" accept="image/jpeg,image/png" capture="user" disabled={generating || references.loading} onChange={event => { void references.chooseLearner(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{references.learner && <button type="button" aria-label="Remove your photo" disabled={generating} onClick={references.removeLearner}><Icon name="close" size={14} /></button>}</div>
                  </div>
                  <div className={styles.referenceCard}>
                    <div className={styles.referenceTitle}><strong>Lucy</strong><span>ALWAYS INCLUDED</span></div>
                    <div className={styles.referencePreview}>{references.castPreview ? <img src={references.castPreview} alt="Lucy recurring character reference" /> : <Icon name="camera" size={28} />}</div>
                    <span className={styles.fixedCastLabel}>{references.cast ? "Your recurring co-star" : references.loading ? "Loading Lucy…" : "Reference unavailable"}</span>
                  </div>
                </div>
                <p className={styles.photoLimit}>JPEG / PNG · up to 5 MB per photo</p>
                {references.error && <p className={styles.inlineMessage} role="alert">{references.error}</p>}
                {references.castError && <div className={styles.generationMessage} role="alert"><p>{references.castError}</p><button type="button" onClick={references.reloadCast}>Reload Lucy photo</button></div>}
                {connection && !connection.ready && current.phase !== "complete" && <div className={styles.connectionNotice}><strong>Video connection unavailable.</strong><details><summary>Details</summary><p>{connection.message}</p></details></div>}
                {current.message && <div className={styles.generationMessage} role="alert"><p>{current.message}</p>{current.paused && <button type="button" onClick={generation.checkAgain}><Icon name="refresh" size={15} />Check this generation again</button>}</div>}
                {current.phase === "complete" && <><button type="button" className={styles.primaryButton} disabled={disabledGeneration} onClick={() => startGeneration(true)}><Icon name="refresh" size={16} />Regenerate scene</button><p className={styles.creditNote}>New take · uses Google Cloud credit</p></>}
                {current.phase === "idle" || current.phase === "submitting" || (current.phase === "pending" && !current.paused) ? <><button type="button" className={styles.primaryButton} disabled={disabledGeneration} onClick={() => startGeneration()}><Icon name="spark" size={18} />{current.phase === "submitting" ? "Sending your scene…" : current.phase === "pending" ? "Creating your scene…" : "Generate my scene"}{!generating && <Icon name="arrow" size={18} />}</button><p className={styles.creditNote}>Uses Google Cloud credit</p></> : current.phase === "error" || current.phase === "uncertain" ? <><button type="button" className={styles.primaryButton} disabled={disabledGeneration} onClick={() => startGeneration(true)}><Icon name="refresh" size={16} />{current.phase === "uncertain" ? "Submit another paid request" : "Retry generation · new paid take"}</button><p className={styles.creditNote}>New request · new charge</p></> : null}
                <div className={styles.promptSection}><button type="button" className={styles.promptToggle} aria-expanded={promptOpen} aria-controls="scene-prompt" onClick={() => setPromptOpen(value => !value)}><Icon name="eye" size={16} />{promptOpen ? "Hide scene prompt" : "Show scene prompt"}<span>{promptOpen ? "−" : "+"}</span></button></div>
              </div>
            </div>
            {promptOpen && <div id="scene-prompt" className={styles.promptContent}><p>{composeScenePrompt(basePrompt, shot.focusWord, { castReferences: true })}</p>{shot.dialogue && <p><strong>Your line:</strong> {shot.dialogue}</p>}</div>}
            <div className={styles.watchBottom}><span>{finished ? "EPISODE COMPLETE" : `SCENE ${String(index + 1).padStart(2, "0")} / ${String(episode.shots.length).padStart(2, "0")}`}</span><button type="button" className={styles.primaryButton} disabled={current.phase !== "complete" || finished} onClick={() => { if (last) setFinished(true); else navigate(index + 1); }}>{last ? finished ? "Chapter complete" : "Finish episode" : "Next scene"}<Icon name={finished ? "check" : "arrow"} size={18} /></button></div>
          </>}
        </section>
      </div>

      <footer className={styles.footer}><span>A LITTLE PRACTICE. A LITTLE PLOT TWIST.</span><div><span>Powered by Veo · Hosted on IBM Cloud</span><a href="/scene-creator">Scene Creator <span aria-hidden="true">↗</span></a></div></footer>
    </div>
  </main>;
}
