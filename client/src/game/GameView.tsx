import { Canvas } from "@react-three/fiber";
import { SPAWN_SEATS } from "@whtb/shared/map";
import type { PublicPlayer } from "@whtb/shared/types";
import { FollowCamera } from "./FollowCamera";
import { NearbyWatcher } from "./NearbyWatcher";
import { Pieces3D } from "./Pieces3D";
import { Player } from "./Player";
import { RemotePlayer } from "./RemotePlayer";
import { SchoolMap } from "./SchoolMap";
import { useMovement } from "./useMovement";

interface SceneProps {
  players: PublicPlayer[];
  myId: string;
}

function Scene({ players, myId }: SceneProps) {
  // The server seats players in join order, so the client can work out its own seat.
  const myIndex = Math.max(0, players.findIndex((p) => p.id === myId));
  const me = useMovement(SPAWN_SEATS[myIndex % SPAWN_SEATS.length]);
  const myColor = players[myIndex]?.color ?? "#f2c14e";

  return (
    <>
      <color attach="background" args={["#bfe3f2"]} />
      <hemisphereLight args={["#ffffff", "#b9a7c9", 1.6]} />
      <directionalLight position={[8, 20, 12]} intensity={1.4} />
      <SchoolMap />
      <Player color={myColor} body={me} isYou />
      {players
        .filter((p) => p.id !== myId)
        .map((p) => (
          <RemotePlayer key={p.id} id={p.id} color={p.color} />
        ))}
      <FollowCamera target={me} />
      <NearbyWatcher me={me} />
      <Pieces3D me={me} />
    </>
  );
}

export function GameView(props: SceneProps) {
  return (
    <div className="game">
      <Canvas dpr={[1, 2]} camera={{ fov: 40, position: [2, 11, 13] }}>
        <Scene {...props} />
      </Canvas>
    </div>
  );
}
