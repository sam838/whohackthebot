import { Canvas } from "@react-three/fiber";
import { SPAWN_SEATS } from "@whtb/shared/map";
import type { PublicPlayer } from "@whtb/shared/types";
import { FollowCamera } from "./FollowCamera";
import { LIGHTING } from "./lighting";
import { NearbyWatcher } from "./NearbyWatcher";
import { PLAYER_SCALE, Player } from "./Player";
import { RemotePlayer } from "./RemotePlayer";
import { SchoolMap } from "./SchoolMap";
import { Slips3D } from "./Slips3D";
import { Spots3D } from "./Spots3D";
import { useMovement } from "./useMovement";
import { VisionShade, shade } from "./Vision";

interface SceneProps {
  players: PublicPlayer[];
  myId: string;
}

function Scene({ players, myId }: SceneProps) {
  // The server seats players in join order, so the client can work out its own seat.
  const myIndex = Math.max(0, players.findIndex((p) => p.id === myId));
  const me = useMovement(SPAWN_SEATS[myIndex % SPAWN_SEATS.length]);
  const myColor = players[myIndex]?.color ?? "#f2c14e";
  const myCharacter = players[myIndex]?.character;

  return (
    <>
      {/* Early-afternoon daylight by default (game/lighting.ts). */}
      <color attach="background" args={[LIGHTING.sky]} />
      <fog attach="fog" args={[LIGHTING.sky, LIGHTING.fogNear, LIGHTING.fogFar]} />
      <hemisphereLight args={[LIGHTING.hemiSky, LIGHTING.hemiGround, LIGHTING.hemiIntensity]} />
      <directionalLight position={LIGHTING.sunPosition} intensity={LIGHTING.sunIntensity} color={LIGHTING.sunColor} />
      <ambientLight intensity={LIGHTING.ambientIntensity} color={LIGHTING.ambientColor} />
      <SchoolMap />
      <Player color={myColor} character={myCharacter} body={me} isYou ghost={!players[myIndex]?.alive} scale={PLAYER_SCALE} />
      {players
        .filter((p) => p.id !== myId && p.alive)
        .map((p) => (
          <RemotePlayer key={p.id} id={p.id} name={p.name} color={p.color} character={p.character} viewer={me} />
        ))}
      <FollowCamera target={me} />
      <NearbyWatcher me={me} />
      <VisionShade me={me} />
      <Spots3D me={me} />
      <Slips3D me={me} />
    </>
  );
}

export function GameView(props: SceneProps) {
  return (
    <div className="game">
      <Canvas dpr={[1, 2]} camera={{ fov: 40, position: [2, 14, 15] }}>
        <Scene {...props} />
      </Canvas>
      {/* Limited vision: darkness outside your circle, moved by VisionShade each frame. */}
      <div className="vision-shade" ref={(el) => void (shade.el = el)} aria-hidden />
    </div>
  );
}
