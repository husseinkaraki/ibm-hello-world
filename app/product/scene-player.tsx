"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./icons";
import styles from "./product.module.css";

export default function ScenePlayer({ src, word }: { src: string; word: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("");
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const player = video.current;
    return () => player?.pause();
  }, [src]);

  return <div className={styles.playerWrap}>
    <div className={styles.videoFrame}>
      <video ref={video} src={src} controls playsInline preload="metadata" aria-label={`Your generated scene using ${word}`} onError={() => setVideoError(true)} />
      {videoError && <div className={styles.videoError} role="alert"><Icon name="film" size={28} /><strong>The video couldn't load.</strong><p>Your generation is saved.</p><button type="button" onClick={() => { setVideoError(false); video.current?.load(); }}>Reload video</button></div>}
    </div>
    <div className={styles.videoActions}><button className={styles.playScene} type="button" onClick={() => {
      setMessage("");
      void video.current?.play().catch(() => setMessage("Tap the video player's play control to begin."));
    }}><Icon name="play" size={16} />Play scene</button><a className={styles.downloadLink} href={src} download="hackathon-scene.mp4">Download ↓</a></div>
    {message && <p className={styles.inlineMessage} role="status">{message}</p>}
  </div>;
}
