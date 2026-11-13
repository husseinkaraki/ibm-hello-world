"use client";

import { useRef, useState } from "react";
import Icon from "./icons";
import styles from "./product.module.css";

export default function ScenePlayer({ src, word }: { src: string; word: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("");
  const [videoError, setVideoError] = useState(false);

  return <div className={styles.playerWrap}>
    <div className={styles.videoFrame}>
      <video ref={video} src={src} controls playsInline preload="metadata" aria-label={`Your generated scene using ${word}`} onError={() => setVideoError(true)} />
      {videoError && <div className={styles.videoError} role="alert"><Icon name="film" size={28} /><strong>The video couldn't load.</strong><p>Your generation is saved.</p><button type="button" onClick={() => { setVideoError(false); video.current?.load(); }}>Reload video</button></div>}
    </div>
    <button className={styles.playScene} type="button" onClick={() => {
      setMessage("");
      void video.current?.play().catch(() => setMessage("Tap the video player's play control to begin."));
    }}><Icon name="play" size={16} />Play scene</button>
    <p className={styles.smallNote}>Normal scene audio. Your focus word is requested to be silently mouthed; generation may vary.</p>
    {message && <p className={styles.inlineMessage} role="status">{message}</p>}
  </div>;
}
