import { useFrame, useThree } from "@react-three/fiber";
import { VISION_RADIUS, canSee } from "@whtb/shared/vision";
import type { Point } from "@whtb/shared/map";
import { useRef } from "react";
import { Vector3 } from "three";
import { amAlive, useGame } from "../net/store";
import type { Body } from "./useMovement";

/**
 * Limited vision (prd.md > Moving Around the School). While class is on, you only
 * see a circle around yourself, cut off by walls. Meetings, the role book, Game Over,
 * and hall monitors (expelled players) see everyone.
 */
export function visionIsLimited(): boolean {
  const s = useGame.getState();
  return s.game?.phase === "playing" && !s.gameOver && amAlive(s);
}

/** Whether a classmate at `at` should be drawn for the viewer at `me`. */
export function isVisible(me: Point, at: Point): boolean {
  return !visionIsLimited() || canSee(me, at);
}

/** The dark overlay, a DOM element above the canvas; the scene keeps its hole on the player. */
export const shade: { el: HTMLDivElement | null } = { el: null };

const ground = new Vector3();

/**
 * Each frame, puts a clear ellipse (the vision circle seen at the camera's angle)
 * over the local player and darkens everything else.
 */
export function VisionShade({ me }: { me: React.RefObject<Body> }) {
  const size = useThree((s) => s.size);
  const last = useRef("");

  useFrame(({ camera }) => {
    const el = shade.el;
    if (!el) return;
    if (!visionIsLimited()) {
      if (last.current !== "off") el.style.background = "none";
      last.current = "off";
      return;
    }
    const b = me.current;
    const toScreen = (x: number, z: number) => {
      ground.set(x, 0, z).project(camera);
      return { x: ((ground.x + 1) / 2) * size.width, y: ((1 - ground.y) / 2) * size.height };
    };
    const centre = toScreen(b.x, b.z);
    const right = toScreen(b.x + VISION_RADIUS, b.z);
    const far = toScreen(b.x, b.z - VISION_RADIUS);
    const near = toScreen(b.x, b.z + VISION_RADIUS);
    const rx = Math.abs(right.x - centre.x);
    const ry = (Math.abs(far.y - centre.y) + Math.abs(near.y - centre.y)) / 2;
    const bg = `radial-gradient(ellipse ${rx.toFixed(0)}px ${ry.toFixed(0)}px at ${centre.x.toFixed(0)}px ${centre.y.toFixed(0)}px, transparent 0%, transparent 78%, rgba(18, 12, 34, 0.72) 100%)`;
    if (bg !== last.current) el.style.background = bg;
    last.current = bg;
  });

  return null;
}
