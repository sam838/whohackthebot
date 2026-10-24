import { useFrame } from "@react-three/fiber";
import { SLIP_REPORT_RADIUS } from "@whtb/shared/constants";
import { distance } from "@whtb/shared/geometry";
import type { Slip } from "@whtb/shared/types";
import { useRef } from "react";
import type { Group } from "three";
import { socket } from "../net/socket";
import { useGame } from "../net/store";
import { slipTexture } from "./textures";
import type { Body } from "./useMovement";
import { isVisible, visionIsLimited } from "./Vision";

/** One expulsion slip on the floor; it reports itself when you walk onto it. */
function SlipPaper({ slip, name, me }: { slip: Slip; name: string; me: React.RefObject<Body> }) {
  const group = useRef<Group>(null);
  const sentAt = useRef(0);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.visible = isVisible(me.current, slip);
    g.position.y = 0.04 + Math.abs(Math.sin(clock.elapsedTime * 2)) * 0.02;
    // Living classmates report it by walking onto it (hall monitors can't).
    if (visionIsLimited() && distance(me.current, slip) <= SLIP_REPORT_RADIUS && performance.now() - sentAt.current > 2000) {
      sentAt.current = performance.now();
      socket.emit("slip:report", { slipId: slip.id });
    }
  });

  return (
    <group ref={group} position={[slip.x, 0.04, slip.z]} rotation-y={0.4}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.9, 0.6]} />
        <meshBasicMaterial map={slipTexture(name)} transparent />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02}>
        <ringGeometry args={[0.6, 0.72, 32]} />
        <meshBasicMaterial color="#e5484d" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

/** Expulsion slips left where the Bluffer expelled someone (prd.md > Expel). */
export function Slips3D({ me }: { me: React.RefObject<Body> }) {
  const slips = useGame((s) => s.game?.slips ?? []);
  const players = useGame((s) => s.game?.players ?? []);
  return (
    <>
      {slips.map((slip) => (
        <SlipPaper key={slip.id} slip={slip} name={players.find((p) => p.id === slip.victimId)?.name ?? "?"} me={me} />
      ))}
    </>
  );
}
