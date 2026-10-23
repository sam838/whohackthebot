import { useFrame } from "@react-three/fiber";
import { distance } from "@whtb/shared/geometry";
import { PICKUP_RADIUS } from "@whtb/shared/pieces";
import type { PieceInfo } from "@whtb/shared/types";
import { useRef } from "react";
import type { Group } from "three";
import { socket } from "../net/socket";
import { useGame } from "../net/store";
import type { Body } from "./useMovement";

/** A small number from a piece id, so each scrap lies at its own fixed angle. */
function tilt(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return (h / 997) * Math.PI * 2;
}

function Piece({ piece, color, mine }: { piece: PieceInfo; color: string; mine: boolean }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (mine && group.current) group.current.position.y = 0.12 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.15;
  });

  return (
    <group ref={group} position={[piece.x, 0.06, piece.z]} rotation-y={tilt(piece.id)}>
      {/* a folded scrap of paper with a band in its owner's color */}
      <mesh rotation-x={-0.12}>
        <boxGeometry args={[0.55, 0.03, 0.42]} />
        <meshToonMaterial color="#fffdf4" />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation-x={-0.12}>
        <boxGeometry args={[0.55, 0.031, 0.12]} />
        <meshToonMaterial color={color} />
      </mesh>
      {mine && (
        <mesh rotation-x={-Math.PI / 2} position-y={-0.05}>
          <ringGeometry args={[0.42, 0.55, 28]} />
          <meshBasicMaterial color="#ffd84d" />
        </mesh>
      )}
    </group>
  );
}

/**
 * Question pieces lying around the school (prd.md > Question Pieces). Everyone
 * but the Bluffer sees them; walking over one of your own picks it up.
 */
export function Pieces3D({ me }: { me: React.RefObject<Body> }) {
  const pieces = useGame((s) => s.pieces);
  const players = useGame((s) => s.game?.players ?? []);
  const myId = useGame((s) => s.myId);
  const requested = useRef(new Set<string>());

  useFrame(() => {
    for (const p of useGame.getState().pieces) {
      if (p.ownerId !== myId || requested.current.has(p.id)) continue;
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
        <Piece
          key={p.id}
          piece={p}
          mine={p.ownerId === myId}
          color={players.find((pl) => pl.id === p.ownerId)?.color ?? "#999999"}
        />
      ))}
    </>
  );
}
