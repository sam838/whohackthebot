import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { Player } from "../game/Player";
import type { Body } from "../game/useMovement";

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

/** Your avatar slowly turning on the home screen (prd.md > Avatar Setup). */
export function AvatarPreview({ color, character }: { color: string; character: string }) {
  return (
    <div className="avatar-preview" aria-hidden>
      <Canvas dpr={[1, 2]} camera={{ fov: 30, position: [0, 1.6, 5.2] }} onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}>
        <hemisphereLight args={["#ffffff", "#b9a7c9", 1.8]} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <Turntable color={color} character={character} />
      </Canvas>
    </div>
  );
}
