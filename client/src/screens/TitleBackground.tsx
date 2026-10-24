import { useEffect, useRef } from "react";

// Title-screen wallpaper (learner's pick, option 6): a big, happy Study-Bot
// bouncing on a spinning sunburst, saying "I'm always right! …probably."
// It teases the twist without being spooky. Drawn in code, so no image to license.
// Wide screens: bot on the right (the logo sits on the left). Tall screens: bot at the bottom.

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function drawBot(c: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.strokeStyle = "#2b2440";
  c.lineWidth = 8;
  c.lineJoin = "round";
  // antenna
  c.fillStyle = "#2b2440";
  c.fillRect(-4, -150, 8, 34);
  c.beginPath();
  c.arc(0, -158, 13, 0, Math.PI * 2);
  c.fillStyle = "#ff7a7a";
  c.fill();
  c.stroke();
  // head and screen face
  c.fillStyle = "#ffd84d";
  roundRect(c, -80, -120, 160, 130, 34);
  c.fill();
  c.stroke();
  c.fillStyle = "#2b2440";
  roundRect(c, -60, -100, 120, 70, 20);
  c.fill();
  c.fillStyle = "#7fe3ff";
  c.beginPath();
  c.arc(-25, -70, 12, Math.PI, 0);
  c.arc(25, -70, 12, Math.PI, 0);
  c.fill();
  c.strokeStyle = "#7fe3ff";
  c.lineWidth = 6;
  c.beginPath();
  c.arc(0, -55, 16, 0.2, Math.PI - 0.2);
  c.stroke();
  // body
  c.strokeStyle = "#2b2440";
  c.lineWidth = 8;
  c.fillStyle = "#ffd84d";
  roundRect(c, -52, 16, 104, 72, 18);
  c.fill();
  c.stroke();
  // waving arm
  c.save();
  c.translate(70, 30);
  c.rotate(-1.2 + Math.sin(t * 0.008) * 0.5);
  roundRect(c, -12, -70, 24, 70, 12);
  c.fill();
  c.stroke();
  c.restore();
  c.restore();
}

function drawBubble(c: CanvasRenderingContext2D, cx: number, top: number, s: number, tailX: number, line1: string, line2: string) {
  const w = 640 * s;
  const h = 210 * s;
  const x = cx - w / 2;
  c.fillStyle = "#ffffff";
  c.strokeStyle = "#2b2440";
  c.lineWidth = 8 * s;
  c.lineJoin = "round";
  roundRect(c, x, top, w, h, 46 * s);
  c.fill();
  c.stroke();
  // tail pointing down at the bot
  c.beginPath();
  c.moveTo(tailX - 34 * s, top + h - 4 * s);
  c.lineTo(tailX + 6 * s, top + h + 70 * s);
  c.lineTo(tailX + 24 * s, top + h - 4 * s);
  c.fill();
  c.stroke();
  c.fillStyle = "#ffffff";
  c.fillRect(tailX - 30 * s, top + h - 12 * s, 50 * s, 10 * s);
  c.textAlign = "center";
  c.fillStyle = "#2b2440";
  // Long lines shrink to fit inside the bubble.
  let size = 74;
  c.font = `800 ${size * s}px "Baloo 2", "Trebuchet MS", sans-serif`;
  while (c.measureText(line1).width > w - 60 * s && size > 30) {
    size -= 2;
    c.font = `800 ${size * s}px "Baloo 2", "Trebuchet MS", sans-serif`;
  }
  c.fillText(line1, cx, top + 105 * s);
  c.fillStyle = "#6b6280";
  c.font = `800 ${48 * s}px "Nunito", system-ui, sans-serif`;
  c.fillText(line2, cx, top + 172 * s);
  c.textAlign = "left";
}

interface Props {
  /** What Study-Bot says (menus change it per screen). */
  line1?: string;
  line2?: string;
  /** On tall screens, menus hide the bot so it never covers the card. */
  botOnNarrow?: boolean;
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x: number) => x * x * x;
/** Overshoots a little, then settles: a "pop". */
const easeOutBack = (x: number) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Study-Bot drops out, then jumps back in with its new line (ms). */
export const BOT_EXIT_MS = 520;
const BOT_ENTER_MS = 950;
const BUBBLE_DELAY_MS = 600;
const BUBBLE_POP_MS = 420;

/**
 * Lets a screen send Study-Bot down before it moves on (the title does this when
 * you press anything), so the exit plays while the next screen loads.
 */
export const wallpaperCue = { exitAt: -Infinity };
export function sendBotDown() {
  wallpaperCue.exitAt = performance.now();
}

/**
 * One wallpaper shared by the title and every menu, so the sunburst never
 * restarts. When Study-Bot's line changes, it drops out of view and jumps back
 * up saying the new line.
 */
export function TitleBackground({ line1 = "I'm always right!", line2 = "…probably.", botOnNarrow = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The drawing loop reads the latest props without restarting.
  const live = useRef({ shown: { line1, line2 }, next: { line1, line2 }, enterAt: performance.now(), botOnNarrow });
  live.current.botOnNarrow = botOnNarrow;
  const n = live.current.next;
  if (n.line1 !== line1 || n.line2 !== line2) {
    const now = performance.now();
    // Use the exit already cued by the screen, or start one now.
    // (A small margin, because the title switches screens right as its cued exit ends.)
    if (now - wallpaperCue.exitAt > BOT_EXIT_MS + 250) wallpaperCue.exitAt = now;
    live.current.next = { line1, line2 };
    live.current.enterAt = wallpaperCue.exitAt + BOT_EXIT_MS;
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    const c = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    live.current.enterAt = start;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const frame = (now: number) => {
      const t = reduce ? 0 : now - start;
      const w = canvas.width;
      const h = canvas.height;
      const wide = w / h > 1.1;
      // Where the bot stands, and how big everything is.
      const s = wide ? Math.min(w / 1600, h / 900) : Math.min(w / 900, h / 1500);
      const L = live.current;
      const showBot = wide || L.botOnNarrow;
      const botX = wide ? w * 0.7 : w * 0.5;
      const botBase = wide ? h * 0.93 : h * 0.95;
      const burstY = wide || L.botOnNarrow ? botBase - 300 * s : h * 0.5;

      c.fillStyle = "#ffcf5a";
      c.fillRect(0, 0, w, h);
      // spinning sunburst behind the bot
      const rays = 18;
      for (let r = 0; r < rays; r++) {
        c.fillStyle = r % 2 ? "#ffd977" : "#ffc443";
        c.save();
        c.translate(botX, burstY);
        c.rotate((r * Math.PI * 2) / rays + t * 0.0003);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(-260 * s, -3000 * s);
        c.lineTo(260 * s, -3000 * s);
        c.fill();
        c.restore();
      }

      // The new line takes over once the bot is out of sight.
      if (now >= L.enterAt) L.shown = L.next;

      if (showBot) {
        const exiting = now >= wallpaperCue.exitAt && now < L.enterAt;
        let offset = 0; // how far below its spot the bot is
        let bubble = 0; // 0 hidden … 1 fully popped
        if (reduce) {
          bubble = 1;
        } else if (exiting) {
          const p = clamp01((now - wallpaperCue.exitAt) / BOT_EXIT_MS);
          offset = easeInCubic(p) * h * 0.95;
          bubble = 1 - clamp01(p * 2.5); // the bubble shrinks away first
        } else {
          offset = (1 - easeOutBack(clamp01((now - L.enterAt) / BOT_ENTER_MS))) * h * 0.95;
          bubble = clamp01((now - L.enterAt - BUBBLE_DELAY_MS) / BUBBLE_POP_MS);
        }

        const bounce = Math.abs(Math.sin(t * 0.004)) * 26 * s;
        // Bot (antenna tip to feet ≈ 259 units) plus bubble (≈ 290) must fit the height.
        const botScale = 1.75 * s;
        const antennaTop = botBase - 259 * botScale;
        drawBot(c, botX, botBase - 88 * botScale - bounce + offset, botScale, t);

        if (bubble > 0) {
          const k = exiting ? bubble : easeOutBack(bubble);
          const bubbleTop = Math.max(16 * s, antennaTop - 290 * s);
          const pivotY = bubbleTop + 280 * s;
          c.save();
          c.globalAlpha = easeOutCubic(bubble);
          c.translate(botX, pivotY);
          c.scale(k, k);
          c.translate(-botX, -pivotY);
          drawBubble(c, botX, bubbleTop, s, botX - 20 * s, L.shown.line1, L.shown.line2);
          c.restore();
        }
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    document.fonts?.ready.then(resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="title-bg" aria-hidden />;
}
