import { useFrame } from "@react-three/fiber";
import { BLUFFER_MAX_PIECES } from "@whtb/shared/constants";
import { distance } from "@whtb/shared/geometry";
import { PICKUP_RADIUS } from "@whtb/shared/pieces";
import type { PieceInfo } from "@whtb/shared/types";
import { useRef } from "react";
import type { Group } from "three";
import { socket } from "../net/socket";
import { amAlive, panelOpen, useGame } from "../net/store";
import type { Body } from "./useMovement";

/** A small number from a piece id, so each scrap lies at its own fixed angle. */
function tilt(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return (h / 997) * Math.PI * 2;
}

function Piece({ piece }: { piece: PieceInfo }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = 0.12 + Math.abs(Math.sin(clock.elapsedTime * 2.5 + tilt(piece.id))) * 0.12;
  });

  return (
    <group ref={group} position={[piece.x, 0.12, piece.z]} rotation-y={tilt(piece.id)}>
      {/* a folded scrap of exam paper */}
      <mesh rotation-x={-0.12}>
        <boxGeometry args={[0.55, 0.03, 0.42]} />
        <meshToonMaterial color="#fffdf4" />
      </mesh>
      <mesh position={[0, 0.02, -0.08]} rotation-x={-0.12}>
        <boxGeometry args={[0.4, 0.031, 0.04]} />
        <meshToonMaterial color="#6b4fd8" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.1}>
        <ringGeometry args={[0.42, 0.52, 28]} />
        <meshBasicMaterial color="#ffd84d" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

/**
 * Question pieces lying around the school (prd.md > Question Pieces). Nobody
 * owns them: walking over one picks it up (the Bluffer can carry only 2).
 */
export function Pieces3D({ me }: { me: React.RefObject<Body> }) {
  const pieces = useGame((s) => s.pieces);
  const requested = useRef(new Set<string>());

  useFrame(() => {
    const s = useGame.getState();
    if (panelOpen(s) || s.gameOver || s.game?.phase !== "playing" || !amAlive(s)) return;
    if (s.role === "bluffer" && s.bag.length >= BLUFFER_MAX_PIECES) return;
    for (const p of s.pieces) {
      if (requested.current.has(p.id)) continue;
      if (distance(me.current, p) <= PICKUP_RADIUS) {
        requested.current.add(p.id);
        socket.emit("piece:pickup", { pieceId: p.id });
        // If the server refuses (e.g. lag), allow another try shortly.
        setTimeout(() => requested.current.delete(p.id), 1500);
      }
    }
  });

  return (
    <>
      {pieces.map((p) => (
        <Piece key={p.id} piece={p} />
      ))}
    </>
  );
}
