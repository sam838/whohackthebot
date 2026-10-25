// Turns the raw footage from record-demo.ts into videos with ffmpeg.
//   npm run demo:cut -- raw <dir>          frames → <dir>/raw.mp4 (30 fps), and prints the log in video time
//   npm run demo:cut -- cut <dir> <plan>   cuts <dir>/raw.mp4 into <dir>/demo.mp4 following a plan file:
//     [{ "from": 12.5, "to": 30, "speed": 1, "src": "../run2" }, …]  (seconds in raw.mp4; speed 2 plays
//     twice as fast; src takes the part from another recording's raw.mp4, relative to <dir>;
//     hold freezes the part's last frame for that many extra seconds)

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [mode, dirArg, planArg] = process.argv.slice(2);
const dir = resolve(dirArg ?? ".");

function ffmpeg(args: string[]) {
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

if (mode === "raw") {
  // frames.json and marks.json are written at the end of a run; the .log files as it goes (if it crashed).
  const fromLog = (file: string) =>
    readFileSync(join(dir, file), "utf8")
      .trim()
      .split("\n")
      .map((line) => line.split(" "));
  const frames = existsSync(join(dir, "frames.json"))
    ? (JSON.parse(readFileSync(join(dir, "frames.json"), "utf8")) as { file: string; t: number }[])
    : fromLog("frames.log").map(([file, t]) => ({ file, t: Number(t) }));
  const marks = existsSync(join(dir, "marks.json"))
    ? (JSON.parse(readFileSync(join(dir, "marks.json"), "utf8")) as { t: number; what: string }[])
    : fromLog("marks.log").map(([t, ...what]) => ({ t: Number(t), what: what.join(" ") }));
  const t0 = frames[0].t;
  // Each frame stays on screen until the next one arrived (the page only sends frames when something changes).
  const list = frames
    .map((f, i) => {
      const next = frames[i + 1]?.t ?? f.t + 0.5;
      return `file '${join(dir, "frames", f.file).replace(/\\/g, "/")}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}`;
    })
    .join("\n");
  const listFile = join(dir, "frames.txt");
  writeFileSync(listFile, `${list}\nfile '${join(dir, "frames", frames.at(-1)!.file).replace(/\\/g, "/")}'\n`);
  ffmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-fps_mode", "cfr", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", join(dir, "raw.mp4")]);
  const timeline = marks.map((m) => `${(m.t - t0).toFixed(1).padStart(7)}s  ${m.what}`).join("\n");
  writeFileSync(join(dir, "timeline.txt"), timeline);
  console.log(timeline);
  console.log(`\n${frames.length} frames, ${(frames.at(-1)!.t - t0).toFixed(0)} s → ${join(dir, "raw.mp4")}`);
} else if (mode === "cut") {
  const plan = JSON.parse(readFileSync(resolve(planArg), "utf8")) as { from: number; to: number; speed?: number; src?: string; hold?: number }[];
  const parts: string[] = [];
  plan.forEach((seg, i) => {
    const part = join(dir, `part-${i}.mp4`);
    const speed = seg.speed ?? 1;
    const raw = join(seg.src ? resolve(dir, seg.src) : dir, "raw.mp4");
    const hold = seg.hold ? `,tpad=stop_mode=clone:stop_duration=${seg.hold}` : "";
    ffmpeg(["-ss", String(seg.from), "-to", String(seg.to), "-i", raw, "-vf", `setpts=PTS/${speed},fps=30${hold}`, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", part]);
    parts.push(part);
  });
  const listFile = join(dir, "parts.txt");
  writeFileSync(listFile, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
  ffmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", join(dir, "demo.mp4")]);
  for (const p of parts) rmSync(p, { force: true });
  const total = plan.reduce((sum, s) => sum + (s.to - s.from) / (s.speed ?? 1) + (s.hold ?? 0), 0);
  console.log(`demo.mp4: ${plan.length} parts, about ${total.toFixed(0)} s → ${join(dir, "demo.mp4")}`);
} else {
  console.log("Usage: npm run demo:cut -- raw <dir>  |  npm run demo:cut -- cut <dir> <plan.json>");
}
