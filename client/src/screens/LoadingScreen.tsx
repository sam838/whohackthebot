import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";
import { ALL_MODELS, preloadFonts, preloadModels } from "../game/preload";
import { startWallpaperIntro } from "./TitleBackground";

/** The splash always shows at least this long, like a game studio's logo moment. */
const MIN_SHOW_MS = 2500;
/** How long it fades into the title. */
const FADE_MS = 400;
/** Never wait longer than this: if a file is stuck, the game still starts (missing models fall back to simple shapes). */
const GIVE_UP_MS = 20_000;
/** At most this long to wait for the menu's 3D avatar to draw before fading anyway. */
const PAINT_WAIT_MS = 2500;
/** The developer credit under the bar. */
export const CREDIT_LINE = "Made with ♥ for Build With AI";

/** Set once the menu's 3D avatar has drawn its first frames (avatar/AvatarPreview.tsx). */
export const menuPaint = { done: false };

/**
 * Downloads every model and font before the title shows, so nothing pops or
 * shifts afterwards. The bar fills smoothly and never runs ahead of the real
 * download; the splash stays at least MIN_SHOW_MS, then fades out.
 * The menu starts underneath as soon as the files are in, so its slow first
 * moment (setting up 3D for the avatar) happens behind the splash, not during
 * the fade. Study-Bot's entrance starts when the fade does.
 */
export function LoadingScreen({ onReady, onDone }: { onReady: () => void; onDone: () => void }) {
  const { loaded, total, active } = useProgress();
  const [fontsReady, setFontsReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [readyAt, setReadyAt] = useState<number>();

  useEffect(() => {
    preloadModels();
    void preloadFonts().then(() => setFontsReady(true));
    const start = performance.now();
    const t = setInterval(() => setElapsed(performance.now() - start), 50);
    return () => clearInterval(t);
  }, []);

  const done = Math.min(loaded, ALL_MODELS.length);
  const modelsReady = total > 0 && !active && loaded >= total;
  const real = ((done + (fontsReady ? 1 : 0)) / (ALL_MODELS.length + 1)) * 100;
  const ready = (modelsReady && fontsReady) || elapsed >= GIVE_UP_MS;
  // Never ahead of the real download, never faster than the minimum show time.
  const percent = Math.round(Math.min(ready ? 100 : real, (elapsed / MIN_SHOW_MS) * 100));

  // Files are in: start the menu underneath.
  useEffect(() => {
    if (!ready || readyAt !== undefined) return;
    setReadyAt(elapsed);
    onReady();
  }, [ready, readyAt, elapsed, onReady]);

  useEffect(() => {
    if (readyAt === undefined || elapsed < MIN_SHOW_MS || leaving) return;
    if (!menuPaint.done && elapsed - readyAt < PAINT_WAIT_MS) return;
    startWallpaperIntro();
    setLeaving(true);
  }, [readyAt, elapsed, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onDone, FADE_MS);
    return () => clearTimeout(t);
  }, [leaving, onDone]);

  return (
    <div className={`loading-screen ${leaving ? "leaving" : ""}`} role="status" aria-live="polite">
      <div className="loading-card">
        <div className="loading-bot" aria-hidden>
          <span className="loading-eye" />
          <span className="loading-eye" />
        </div>
        <p className="loading-title">Who Hacked the Bot?</p>
        <div className="loading-track" aria-hidden>
          <div className="loading-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="loading-text">{percent < 100 ? `Getting the school ready… ${percent}%` : "Ready!"}</p>
        <p className="loading-credit">{CREDIT_LINE}</p>
      </div>
    </div>
  );
}
