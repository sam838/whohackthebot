import { useFrame } from "@react-three/fiber";
import { HIDING_SPOTS, type HidingSpot } from "@whtb/shared/pieces";
import { useRef } from "react";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { useGame } from "../net/store";

/** A small floating diamond over something you can examine. */
function SpotMarker({ spot, index }: { spot: HidingSpot; index: number }) {
  const group = useRef<Group>(null);
  const gem = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const s = useGame.getState();
    const searched = s.searched.includes(spot.id);
    const near = s.nearSpot === spot.id;
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.position.y = 1.45 + Math.sin(t * 2.2 + index) * 0.07;
    g.rotation.y = t * 1.2 + index;
    // Bigger and brighter when you can examine it; small and grey once you've searched it.
    const scale = near ? 1.35 : searched ? 0.6 : 1;
    g.scale.setScalar(g.scale.x + (scale - g.scale.x) * 0.2);
    const m = gem.current?.material as MeshBasicMaterial | undefined;
    if (m) {
      m.color.set(searched ? "#9a93ad" : "#ffd84d");
      m.opacity = searched ? 0.45 : 0.95;
    }
  });

  return (
    <group ref={group} position={[spot.x, 1.45, spot.z]}>
      <mesh ref={gem}>
        <octahedronGeometry args={[0.13, 0]} />
        <meshBasicMaterial color="#ffd84d" transparent opacity={0.95} />
      </mesh>
    </group>
  );
}

/**
 * Things you can examine for hidden question pieces (prd.md > Question Pieces):
 * desks, posters, shelves, the fridge… Each has a little marker; the markers say
 * where you can search, never whether a piece is there.
 */
export function Spots3D() {
  return (
    <>
      {HIDING_SPOTS.map((s, i) => (
        <SpotMarker key={s.id} spot={s} index={i} />
      ))}
    </>
  );
}
