import { Canvas } from "@react-three/fiber";
import { FollowCamera } from "./FollowCamera";
import { Player } from "./Player";
import { SchoolMap } from "./SchoolMap";
import { useMovement } from "./useMovement";

function Scene() {
  const me = useMovement();
  return (
    <>
      <color attach="background" args={["#bfe3f2"]} />
      <hemisphereLight args={["#ffffff", "#b9a7c9", 1.6]} />
      <directionalLight position={[8, 20, 12]} intensity={1.4} />
      <SchoolMap />
      <Player color="#f2c14e" body={me} isYou />
      <FollowCamera target={me} />
    </>
  );
}

export function GameView() {
  return (
    <div className="game">
      <Canvas dpr={[1, 2]} camera={{ fov: 40, position: [2, 11, 13] }}>
        <Scene />
      </Canvas>
    </div>
  );
}
