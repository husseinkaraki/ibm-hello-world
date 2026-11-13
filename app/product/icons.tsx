export type IconName = "mic" | "arrow" | "play" | "pause" | "check" | "close" | "camera" | "spark" | "refresh" | "film" | "eye" | "back";

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths = {
    mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    back: <path d="M20 12H4m6-6-6 6 6 6" />,
    play: <path d="m9 5 11 7-11 7V5Z" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    camera: <><path d="M8 5 10 2h4l2 3h4a2 2 0 0 1 2 2v12H2V7a2 2 0 0 1 2-2h4Z" /><circle cx="12" cy="12" r="4" /></>,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />,
    refresh: <path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" />,
    film: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
