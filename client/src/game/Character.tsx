import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Group, Material, Mesh } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Body } from "./useMovement";

/** Kenney Mini Characters are about 0.67 units tall; this makes them match the school. */
const CHARACTER_SCALE = 2.4;

/**
 * An animated CC0 character (spec.md > School Scene). Plays "walk" while the
 * body moves and "idle" otherwise. Each instance gets its own skeleton and
 * materials, so ghosts can fade without fading everyone.
 */
export function Character({ file, body, ghost }: { file: string; body: React.RefObject<Body | null>; ghost?: boolean }) {
  const { scene, animations } = useGLTF(file);
  const model = useMemo(() => {
    const copy = cloneSkinned(scene) as Group;
    copy.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) mesh.material = (mesh.material as Material).clone();
    });
    return copy;
  }, [scene]);
  const root = useRef<Group>(null);
  const { actions } = useAnimations(animations, root);
  const playing = useRef<string | undefined>(undefined);

  useEffect(() => {
    model.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as Material;
      m.transparent = Boolean(ghost);
      m.opacity = ghost ? 0.35 : 1;
    });
  }, [model, ghost]);

  useFrame(() => {
    const want = body.current?.moving ? "walk" : "idle";
    if (want === playing.current) return;
    actions[playing.current ?? ""]?.fadeOut(0.15);
    actions[want]?.reset().fadeIn(0.15).play();
    playing.current = want;
  });

  return (
    <group ref={root} scale={CHARACTER_SCALE}>
      <primitive object={model} />
    </group>
  );
}
