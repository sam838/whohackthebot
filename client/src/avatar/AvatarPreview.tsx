import { Canvas, type RootState, useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Group } from "three";
import { create } from "zustand";
import { Player } from "../game/Player";
import type { Body } from "../game/useMovement";
import { loadAvatar } from "./avatarStorage";

/**
 * Setting up 3D freezes the page for a moment, so the menus share one live view
 * that is created once, behind the loading screen, and kept for the whole visit.
 * Each screen just marks where your avatar goes (AvatarPreview), and the view
 * (AvatarStage) floats over that spot. It never restarts between screens.
 */
const useSlot = create<{ el?: HTMLElement; color: string; character: string }>(() => {
  const saved = loadAvatar();
  return { color: saved.color, character: saved.character };
});

/** How long the view renders with nowhere to show, so its 3D is ready before the first menu appears. */
const WARM_UP_MS = 1500;

function Turntable({ color, character }: { color: string; character: string }) {
  const spin = useRef<Group>(null);
  // Standing still, so the character plays its idle animation.
  const body = useRef<Body>({ x: 0, z: 0, heading: 0, moving: false });
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.8;
  });
  return (
    <group ref={spin}>
      <Player color={color} character={character} body={body} />
    </group>
  );
}

/** How see-through an element really is right now, including fading cards around it. */
function opacityOf(el: HTMLElement): number {
  let o = 1;
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
  return o;
}

/** The one live 3D view of your avatar (App mounts it once). It shows only while a menu has a spot for it. */
export function AvatarStage() {
  const { el, color, character } = useSlot();
  const box = useRef<HTMLDivElement>(null);
  const three = useRef<RootState | null>(null);
  const [warming, setWarming] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setWarming(false), WARM_UP_MS);
    return () => clearTimeout(t);
  }, []);

  // Follow the spot every frame: cards slide and fade in, and screens resize.
  useEffect(() => {
    const stage = box.current!;
    if (!el) {
      stage.style.opacity = "0";
      return;
    }
    const radius = Math.max(0, parseFloat(getComputedStyle(el).borderTopLeftRadius) - el.clientTop);
    let raf = 0;
    let size = "";
    let hideFrames = 0;
    const follow = () => {
      const r = el.getBoundingClientRect();
      const s = stage.style;
      const w = el.clientWidth;
      const h = el.clientHeight;
      // A new box size (e.g. the small card box to the big Edit box): resize the 3D drawing now,
      // not a few frames later, and skip a frame so the old image is never shown stretched.
      if (`${w}x${h}` !== size) {
        size = `${w}x${h}`;
        three.current?.setSize(w, h);
        hideFrames = 1;
      }
      s.left = `${r.left + el.clientLeft}px`;
      s.top = `${r.top + el.clientTop}px`;
      s.width = `${w}px`;
      s.height = `${h}px`;
      s.borderRadius = `${radius}px`;
      s.opacity = hideFrames > 0 ? "0" : String(opacityOf(el));
      if (hideFrames > 0) hideFrames--;
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(raf);
  }, [el]);

  return (
    <div ref={box} className="avatar-float" aria-hidden>
      <Canvas
        frameloop={el || warming ? "always" : "never"}
        dpr={[1, 2]}
        camera={{ fov: 30, position: [0, 1.6, 5.2] }}
        onCreated={(state) => {
          state.camera.lookAt(0, 0.8, 0);
          three.current = state;
        }}
      >
        <hemisphereLight args={["#ffffff", "#b9a7c9", 1.8]} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <Turntable color={color} character={character} />
      </Canvas>
    </div>
  );
}

/** Your avatar slowly turning on the home screen (prd.md > Avatar Setup): marks the spot the live view floats over. */
export function AvatarPreview({ color, character }: { color: string; character: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    useSlot.setState({ el });
    return () => {
      if (useSlot.getState().el === el) useSlot.setState({ el: undefined });
    };
  }, []);

  useEffect(() => useSlot.setState({ color, character }), [color, character]);

  return <div ref={ref} className="avatar-preview" aria-hidden />;
}
