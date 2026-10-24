// Floors, posters, signs, and the chalkboard are painted on canvases in code,
// so the school's look is unique to this game and has no license to track.

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

type Paint = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const cache = new Map<string, CanvasTexture>();

function make(key: string, w: number, h: number, paint: Paint, repeat?: [number, number]): CanvasTexture {
  const id = `${key}:${repeat?.join("x") ?? ""}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext("2d")!, w, h);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  cache.set(id, tex);
  return tex;
}

const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

// --- Floors (one canvas tile = 2×2 world units) ---

export function woodFloor(repeat: [number, number], dark = false) {
  return make(dark ? "wood-dark" : "wood", 256, 256, (c, w, h) => {
    const tones = dark ? ["#7a4e33", "#6e452c", "#83563a", "#68412a"] : ["#d9a873", "#cf9b66", "#e0b383", "#c99460"];
    const plank = h / 8;
    for (let i = 0; i < 8; i++) {
      c.fillStyle = tones[i % tones.length];
      c.fillRect(0, i * plank, w, plank);
      c.fillStyle = "rgba(90,55,25,0.35)";
      c.fillRect(0, i * plank + plank - 2, w, 2);
      c.fillRect(((i * 97) % w) | 0, i * plank, 2, plank);
    }
  }, repeat);
}

export function checkerFloor(a: string, b: string, repeat: [number, number]) {
  return make(`checker-${a}-${b}`, 128, 128, (c, w, h) => {
    c.fillStyle = a;
    c.fillRect(0, 0, w, h);
    c.fillStyle = b;
    c.fillRect(0, 0, w / 2, h / 2);
    c.fillRect(w / 2, h / 2, w / 2, h / 2);
    c.strokeStyle = "rgba(0,0,0,0.08)";
    c.lineWidth = 2;
    c.strokeRect(0, 0, w, h);
  }, repeat);
}

export function linoleumFloor(repeat: [number, number]) {
  return make("lino", 256, 64, (c, w, h) => {
    c.fillStyle = "#e9e6ef";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#cfc9db";
    for (let x = 0; x < w; x += 64) c.fillRect(x, 0, 2, h);
    c.fillStyle = "#6b4fd8";
    c.fillRect(0, h / 2 - 3, w, 6);
  }, repeat);
}

// --- Wall pictures ---

function rounded(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

export function chalkboard() {
  return make("chalkboard", 1024, 200, (c, w, h) => {
    c.fillStyle = "#8a5a3c";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#2f5d4a";
    c.fillRect(12, 12, w - 24, h - 24);
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.font = `600 54px ${FONT}`;
    c.fillText("Today's lesson:", 48, 86);
    c.font = `800 62px ${FONT}`;
    c.fillText("trust, but verify ✓", 48, 160);
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.font = `600 34px ${FONT}`;
    c.fillText("Class 7A · Monday", w - 330, 70);
  });
}

export function poster(kind: "think" | "periodic" | "goggles" | "menu" | "map" | "quiet") {
  return make(`poster-${kind}`, 256, 320, (c, w, h) => {
    if (kind === "periodic") {
      c.fillStyle = "#fffdf4";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#2b2440";
      c.font = `800 26px ${FONT}`;
      c.fillText("PERIODIC TABLE", 28, 40);
      const colors = ["#f7c59f", "#b8e0d2", "#cdbbe8", "#ffd84d", "#9cc9f5"];
      for (let r = 0; r < 7; r++)
        for (let col = 0; col < 9; col++) {
          if (r === 0 && col > 0 && col < 8) continue;
          c.fillStyle = colors[(r + col) % colors.length];
          c.fillRect(14 + col * 26, 60 + r * 34, 22, 30);
        }
      return;
    }
    if (kind === "menu") {
      c.fillStyle = "#2b2440";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#ffd84d";
      c.font = `800 40px ${FONT}`;
      c.fillText("KANTIN", 60, 52);
      c.fillStyle = "#fff";
      c.font = `600 24px ${FONT}`;
      [["Nasi Goreng", "$1.50"], ["Mie Ayam", "$1.75"], ["Bakso", "$1.75"], ["Es Teh", "$0.50"], ["Gorengan", "$0.25"]].forEach(([item, price], i) => {
        c.fillText(item, 24, 104 + i * 42);
        c.textAlign = "right";
        c.fillText(price, w - 20, 104 + i * 42);
        c.textAlign = "left";
      });
      return;
    }
    if (kind === "map") {
      c.fillStyle = "#9cc9f5";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#4cbf87";
      [[40, 70, 70, 50], [130, 60, 80, 70], [160, 160, 60, 80], [50, 170, 50, 40], [190, 240, 40, 30]].forEach(([x, y, a, b]) => {
        c.beginPath();
        c.ellipse(x, y, a / 2, b / 2, 0.3, 0, Math.PI * 2);
        c.fill();
      });
      c.fillStyle = "#2b2440";
      c.font = `800 26px ${FONT}`;
      c.fillText("WORLD MAP", 52, h - 22);
      return;
    }
    const looks = {
      think: { bg: "#6b4fd8", fg: "#fff", lines: ["THINK", "BEFORE", "YOU", "TRUST"] },
      goggles: { bg: "#ffd84d", fg: "#2b2440", lines: ["SAFETY", "FIRST!", "Goggles", "on"] },
      quiet: { bg: "#4cbf87", fg: "#fff", lines: ["SHHH…", "Quiet", "please"] },
    }[kind];
    c.fillStyle = looks.bg;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = looks.fg;
    c.lineWidth = 8;
    rounded(c, 14, 14, w - 28, h - 28, 18);
    c.stroke();
    c.fillStyle = looks.fg;
    c.textAlign = "center";
    looks.lines.forEach((line, i) => {
      c.font = `800 ${i === 0 ? 52 : 42}px ${FONT}`;
      c.fillText(line, w / 2, 86 + i * 62);
    });
  });
}

export function sign(text: string) {
  return make(`sign-${text}`, 512, 112, (c, w, h) => {
    c.fillStyle = "#2b2440";
    rounded(c, 0, 0, w, h, 24);
    c.fill();
    c.fillStyle = "#ffd84d";
    c.font = `800 60px ${FONT}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, w / 2, h / 2 + 4);
  });
}

export function lockerFront() {
  return make("locker", 64, 256, (c, w, h) => {
    c.fillStyle = "#5b8def";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.fillRect(w - 3, 0, 3, h);
    c.fillStyle = "rgba(0,0,0,0.3)";
    for (let y = 20; y < 60; y += 8) c.fillRect(14, y, w - 28, 3);
    c.fillStyle = "#d9dde6";
    c.fillRect(w - 18, h / 2 - 12, 6, 24);
  }, [1, 1]);
}

export function vendingFront() {
  return make("vending", 128, 256, (c, w, h) => {
    c.fillStyle = "#e5484d";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#cfe8ff";
    c.fillRect(12, 16, 76, 160);
    const cans = ["#ffd84d", "#4cbf87", "#5b8def", "#f7c59f"];
    for (let r = 0; r < 5; r++) for (let col = 0; col < 4; col++) {
      c.fillStyle = cans[(r + col) % cans.length];
      c.fillRect(18 + col * 17, 24 + r * 30, 12, 22);
    }
    c.fillStyle = "#2b2440";
    c.fillRect(96, 40, 20, 60);
    c.fillRect(20, 196, 66, 26);
  });
}
