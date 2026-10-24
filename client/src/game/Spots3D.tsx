import { useFrame } from "@react-three/fiber";
import { distance } from "@whtb/shared/geometry";
import { HIDING_SPOTS, type HidingSpot } from "@whtb/shared/pieces";
import { canSee } from "@whtb/shared/vision";
import { useRef } from "react";
import type { Mesh, MeshBasicMaterial } from "three";
import { useGame } from "../net/store";
import type { Body } from "./useMovement";

/** Rings show only within this distance, so the school looks clean from afar. */
const SHOW_WITHIN = 3.2;

/** A soft ring on the floor in front of something you can examine. */
function SpotRing({ spot, index, me }: { spot: HidingSpot; index: number; me: React.RefObject<Body> }) {
  const ring = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const r = ring.current;
    if (!r) return;
    const d = distance(me.current, spot);
    // Close by, and not behind a wall (same vision rule as classmates).
    r.visible = d < SHOW_WITHIN && canSee(me.current, spot);
    if (!r.visible) return;
    const s = useGame.getState();
    const searched = s.searched.includes(spot.id);
    const near = s.nearSpot === spot.id;
    const m = r.material as MeshBasicMaterial;
    // Fades in as you approach; pulses gently when you can examine it; grey once searched.
    const fade = Math.min(1, (SHOW_WITHIN - d) / 1.2);
    const pulse = near ? 0.75 + Math.sin(clock.elapsedTime * 4 + index) * 0.2 : 0.45;
    m.color.set(searched ? "#9a93ad" : "#ffd84d");
    m.opacity = fade * (searched ? 0.35 : pulse);
    r.scale.setScalar(near ? 1.1 : 1);
  });

  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2} position={[spot.x, 0.025, spot.z]} visible={false}>
      <ringGeometry args={[0.32, 0.44, 32]} />
      <meshBasicMaterial color="#ffd84d" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

/**
 * Things you can examine for hidden question pieces (prd.md > Question Pieces):
 * desks, posters, shelves, the fridge… A ring shows on the floor in front of each
 * one only when you're close; it says where you can search, never whether a piece is there.
 */
export function Spots3D({ me }: { me: React.RefObject<Body> }) {
  return (
    <>
      {HIDING_SPOTS.map((s, i) => (
        <SpotRing key={s.id} spot={s} index={i} me={me} />
      ))}
    </>
  );
}
