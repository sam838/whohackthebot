import { useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import type { Group, Texture } from "three";
import { FittedModel, type FitBox } from "./FittedModel";
import { LIGHTING } from "./lighting";
import { ModelBoundary } from "./ModelBoundary";
import { Apple, Backpack, Globe, MealTray, Notebook, SchoolChair, ShelfBooks } from "./Props";
import { lockerFront, poster, sign } from "./textures";

// Decoration only: nothing here blocks movement. Pictures sit on wall faces the
// fixed camera can see (the ones facing +z). Solid furniture lives in shared/map.ts.

/** A flat picture on a wall, facing the camera. */
function WallPicture({ x, y, z, w, h, map }: { x: number; y: number; z: number; w: number; h: number; map: Texture }) {
  return (
    <mesh position={[x, y, z]}>
      <planeGeometry args={[w, h]} />
      <meshToonMaterial map={map} />
    </mesh>
  );
}

function Window({ x, z, w }: { x: number; z: number; w: number }) {
  return (
    <group position={[x, 1.0, z]}>
      <mesh>
        <planeGeometry args={[w + 0.12, 0.92]} />
        <meshBasicMaterial color="#f4f1ea" />
      </mesh>
      <mesh position-z={0.005}>
        <planeGeometry args={[w, 0.8]} />
        <meshBasicMaterial color={LIGHTING.windowGlass} />
      </mesh>
      <mesh position-z={0.01}>
        <planeGeometry args={[0.05, 0.8]} />
        <meshBasicMaterial color="#f4f1ea" />
      </mesh>
      <mesh position-z={0.01}>
        <planeGeometry args={[w, 0.05]} />
        <meshBasicMaterial color="#f4f1ea" />
      </mesh>
    </group>
  );
}

function Clock({ x, y, z }: { x: number; y: number; z: number }) {
  const hand = useRef<Group>(null);
  useFrame((_, delta) => {
    if (hand.current) hand.current.rotation.z -= delta * 0.5;
  });
  return (
    <group position={[x, y, z]}>
      <mesh>
        <circleGeometry args={[0.24, 32]} />
        <meshBasicMaterial color="#2b2440" />
      </mesh>
      <mesh position-z={0.005}>
        <circleGeometry args={[0.2, 32]} />
        <meshBasicMaterial color="#fffdf4" />
      </mesh>
      <group ref={hand} position-z={0.01}>
        <mesh position-y={0.07}>
          <planeGeometry args={[0.025, 0.14]} />
          <meshBasicMaterial color="#e5484d" />
        </mesh>
      </group>
      <mesh position={[0.04, 0.02, 0.01]} rotation-z={-1}>
        <planeGeometry args={[0.03, 0.1]} />
        <meshBasicMaterial color="#2b2440" />
      </mesh>
    </group>
  );
}

/** A row of lockers along the hallway side of a wall, from x1 to x2. */
function Lockers({ x1, x2, z }: { x1: number; x2: number; z: number }) {
  const width = 0.5;
  const count = Math.floor((x2 - x1) / width);
  const map = lockerFront();
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[x1 + width / 2 + i * width, 0.72, z]}>
          <boxGeometry args={[width - 0.02, 1.4, 0.08]} />
          <meshToonMaterial map={map} />
        </mesh>
      ))}
    </>
  );
}

function DoorSign({ x, z, text }: { x: number; z: number; text: string }) {
  return <WallPicture x={x} y={1.85} z={z} w={1.9} h={0.42} map={sign(text)} />;
}

function Model({ file, box, fallbackColor }: { file: string; box: FitBox; fallbackColor: string }) {
  const fallback = (
    <mesh position={[box.x, (box.y ?? 0) + box.h / 2, box.z]}>
      <boxGeometry args={[box.w, box.h, box.d]} />
      <meshToonMaterial color={fallbackColor} />
    </mesh>
  );
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={null}>
        <FittedModel file={file} box={box} />
      </Suspense>
    </ModelBoundary>
  );
}

function Flask({ x, z, y, color }: { x: number; z: number; y: number; color: string }) {
  return (
    <group position={[x, y, z]}>
      <mesh position-y={0.12}>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshToonMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh position-y={0.28}>
        <cylinderGeometry args={[0.04, 0.04, 0.16, 10]} />
        <meshToonMaterial color="#e8f4ff" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

const WALL_FACE = 0.17; // just in front of a wall's surface
const CHAIR_COLORS = ["#e5566b", "#5b8def", "#4cbf87", "#e0a526", "#b07cf0", "#f2994a"];

/** A plain decorative box (doesn't block movement). */
function Block({ p, s, color, emissive }: { p: [number, number, number]; s: [number, number, number]; color: string; emissive?: boolean }) {
  return (
    <mesh position={p}>
      <boxGeometry args={s} />
      {emissive ? <meshBasicMaterial color={color} /> : <meshToonMaterial color={color} />}
    </mesh>
  );
}

/**
 * A basketball hoop on a gym side wall: backboard on the wall, a flat ring sticking
 * out over the court (`into` is +1 or -1 along x), and a net. Kept below the
 * 1.6-unit walls so it never floats.
 */
function Hoop({ x, into }: { x: number; into: 1 | -1 }) {
  return (
    <group position={[x, 0, 4]}>
      <Block p={[0, 1.2, 0]} s={[0.06, 0.6, 1.0]} color="#ffffff" />
      <Block p={[into * 0.035, 1.12, 0]} s={[0.01, 0.26, 0.36]} color="#e5484d" />
      <Block p={[into * 0.035, 1.12, 0]} s={[0.012, 0.18, 0.28]} color="#ffffff" />
      <Block p={[into * 0.15, 0.98, 0]} s={[0.3, 0.04, 0.05]} color="#9aa3b5" />
      <mesh position={[into * 0.4, 0.98, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.22, 0.025, 8, 28]} />
        <meshToonMaterial color="#e5484d" />
      </mesh>
      <mesh position={[into * 0.4, 0.82, 0]}>
        <cylinderGeometry args={[0.21, 0.13, 0.3, 14, 1, true]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

/** A flat strip on the floor (court lines, cable trays, rugs). */
function FloorPatch({ x, z, w, d, color, y = 0.012 }: { x: number; z: number; w: number; d: number; color: string; y?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[x, y, z]}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/** A traffic cone for gym drills. */
function Cone({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.2}>
        <coneGeometry args={[0.13, 0.4, 14]} />
        <meshToonMaterial color="#f2994a" />
      </mesh>
      <Block p={[0, 0.02, 0]} s={[0.3, 0.04, 0.3]} color="#f2994a" />
    </group>
  );
}

/** A folding music stand in front of a chair. */
function MusicStand({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Block p={[0, 0.5, 0]} s={[0.04, 1.0, 0.04]} color="#33303d" />
      <mesh position={[0, 1.05, 0.02]} rotation-x={-0.5}>
        <boxGeometry args={[0.5, 0.36, 0.03]} />
        <meshToonMaterial color="#33303d" />
      </mesh>
      <mesh position={[0, 1.06, 0.045]} rotation-x={-0.5}>
        <planeGeometry args={[0.4, 0.28]} />
        <meshToonMaterial color="#fffaf0" />
      </mesh>
    </group>
  );
}

/** A framed painting hanging on a wall that faces the camera. */
function Painting({ x, y, z, w, h, colors }: { x: number; y: number; z: number; w: number; h: number; colors: string[] }) {
  return (
    <group position={[x, y, z]}>
      <Block p={[0, 0, 0]} s={[w + 0.12, h + 0.12, 0.04]} color="#8a5a2b" />
      <Block p={[0, 0, 0.025]} s={[w, h, 0.01]} color={colors[0]} />
      {colors.slice(1).map((c, i) => (
        <mesh key={c} position={[(i - (colors.length - 2) / 2) * (w / colors.length), -h * 0.1 + (i % 2) * h * 0.2, 0.035]}>
          <circleGeometry args={[Math.min(w, h) * 0.18, 18]} />
          <meshBasicMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

/** The new wing: Gym, Server Room, Music Room, Art Room (slice 8). */
function NewWing() {
  return (
    <>
      <Lockers x1={24.4} x2={29.6} z={8 + WALL_FACE} />
      <Lockers x1={32.4} x2={40.6} z={8 + WALL_FACE} />
      <DoorSign x={31} z={8.2} text="GYM" />
      <DoorSign x={42} z={8.2} text="SERVER ROOM" />
      <DoorSign x={29.5} z={10.2} text="MUSIC" />
      <DoorSign x={40.5} z={10.2} text="ART" />

      {/* Gym: scoreboard, trophy case, a hoop, balls in the cart, court circle */}
      <WallPicture x={25.5} y={1.3} z={WALL_FACE} w={1.5} h={0.7} map={sign("HOME 3 : 2 AWAY")} />
      <Block p={[36.5, 0.75, 0.4]} s={[1.4, 1.5, 0.45]} color="#bfe3f5" />
      {[36.1, 36.5, 36.9].map((x) => (
        <Block key={x} p={[x, 1.1, 0.45]} s={[0.18, 0.3, 0.18]} color="#ffd84d" />
      ))}
      <Hoop x={37.85} into={-1} />
      {[-0.25, 0, 0.25].map((dx) => (
        <mesh key={dx} position={[36.6 + dx, 0.85, 6.6]}>
          <sphereGeometry args={[0.15, 14, 10]} />
          <meshToonMaterial color="#f2994a" />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[31, 0.02, 5]}>
        <ringGeometry args={[1.1, 1.2, 40]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Server Room: blinking lights on the racks, the router box, a Study-Bot sign */}
      {[40, 42, 44].flatMap((x) =>
        [0.6, 0.95, 1.3, 1.65].map((y, i) => (
          <Block key={`${x}-${y}`} p={[x - 0.3 + (i % 2) * 0.2, y, 1.21]} s={[0.12, 0.05, 0.02]} color={i % 2 ? "#4cbf87" : "#5b8def"} emissive />
        )),
      )}
      <Block p={[38.25, 1.2, 5]} s={[0.2, 0.35, 0.6]} color="#33303d" />
      <Block p={[38.3, 1.5, 4.85]} s={[0.03, 0.3, 0.03]} color="#33303d" />
      <Block p={[38.3, 1.5, 5.15]} s={[0.03, 0.3, 0.03]} color="#33303d" />
      <WallPicture x={42} y={2.0} z={WALL_FACE} w={1.8} h={0.42} map={sign("STUDY-BOT v2")} />

      {/* Music Room: piano keys, a drum kit, a guitar, the sheet-music board */}
      <Block p={[26.5, 1.12, 11.45]} s={[2.2, 0.04, 0.22]} color="#ffffff" />
      {Array.from({ length: 9 }, (_, i) => (
        <Block key={i} p={[25.6 + i * 0.22, 1.15, 11.4]} s={[0.08, 0.04, 0.12]} color="#1f1d2b" />
      ))}
      <mesh position={[32, 0.65, 13.7]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.4, 0.4, 0.35, 20]} />
        <meshToonMaterial color="#e5484d" />
      </mesh>
      <mesh position={[31.4, 0.6, 13.1]}>
        <cylinderGeometry args={[0.2, 0.2, 0.15, 16]} />
        <meshToonMaterial color="#f4f4f4" />
      </mesh>
      <mesh position={[32.6, 1.0, 13.1]}>
        <cylinderGeometry args={[0.28, 0.28, 0.02, 20]} />
        <meshToonMaterial color="#ffd84d" />
      </mesh>
      <mesh position={[25.2, 0.45, 16.9]} scale={[1, 1.25, 0.4]}>
        <sphereGeometry args={[0.28, 14, 10]} />
        <meshToonMaterial color="#c0763a" />
      </mesh>
      <Block p={[25.2, 1.0, 16.9]} s={[0.07, 0.8, 0.05]} color="#5a3a22" />
      <WallPicture x={33.7} y={1.0} z={10 + WALL_FACE} w={1.3} h={0.6} map={sign("CHOIR ♪ FRI")} />

      {/* Art Room: canvases on the easels, paint pots, the drying rack */}
      {[
        [38, "#9cc9f5"],
        [41, "#f7c59f"],
      ].map(([x, color]) => (
        <Block key={x as number} p={[x as number, 1.25, 14.17]} s={[0.85, 0.65, 0.04]} color={color as string} />
      ))}
      {["#e5484d", "#ffd84d", "#5b8def", "#4cbf87", "#b07cf0"].map((color, i) => (
        <mesh key={color} position={[36.2 + i * 0.4, 1.47, 10.6]}>
          <cylinderGeometry args={[0.1, 0.1, 0.16, 12]} />
          <meshToonMaterial color={color} />
        </mesh>
      ))}
      <Block p={[44, 0.6, 17.4]} s={[1.6, 1.2, 0.4]} color="#d9c7a7" />
      {[43.5, 44, 44.5].map((x, i) => (
        <Block key={x} p={[x, 0.8, 17.18]} s={[0.4, 0.3, 0.02]} color={["#f7c59f", "#cdbbe8", "#b8e0d2"][i]} />
      ))}

      {/* --- Filling the new wing --- */}
      {/* Gym: court lines, a second hoop, banners, benches, cones, a mat stack, a water cooler */}
      <FloorPatch x={31} z={2.6} w={11.6} d={0.07} color="#ffffff" />
      <FloorPatch x={31} z={7.4} w={11.6} d={0.07} color="#ffffff" />
      <FloorPatch x={25.2} z={5} w={0.07} d={4.8} color="#ffffff" />
      <FloorPatch x={36.8} z={5} w={0.07} d={4.8} color="#ffffff" />
      <FloorPatch x={31} z={5} w={0.07} d={4.8} color="#ffffff" />
      <Hoop x={24.15} into={1} />
      <WallPicture x={29} y={1.35} z={WALL_FACE} w={2.2} h={0.42} map={sign("GO TIGERS!")} />
      <WallPicture x={33.2} y={1.35} z={WALL_FACE} w={1.8} h={0.42} map={sign("CHAMPIONS")} />
      {[27.6, 33].map((x) => (
        <group key={x}>
          <Block p={[x, 0.32, 7.6]} s={[2, 0.08, 0.36]} color="#c98f5a" />
          <Block p={[x - 0.85, 0.15, 7.6]} s={[0.08, 0.3, 0.3]} color="#6f5f8c" />
          <Block p={[x + 0.85, 0.15, 7.6]} s={[0.08, 0.3, 0.3]} color="#6f5f8c" />
        </group>
      ))}
      <Cone x={33.6} z={3.4} />
      <Cone x={34.6} z={3.4} />
      <Cone x={35.6} z={3.4} />
      <Block p={[25.0, 0.12, 7.1]} s={[1.2, 0.24, 0.8]} color="#3d7dd8" />
      <Block p={[25.0, 0.36, 7.1]} s={[1.2, 0.24, 0.8]} color="#e5484d" />
      <mesh position={[37.5, 0.75, 7.4]}>
        <cylinderGeometry args={[0.18, 0.18, 0.5, 14]} />
        <meshToonMaterial color="#9cc9f5" transparent opacity={0.85} />
      </mesh>
      <Block p={[37.5, 0.25, 7.4]} s={[0.4, 0.5, 0.4]} color="#ffffff" />

      {/* Server Room: monitor with Study-Bot's face, chair, AC unit, cable trays, floor vent, warning sign */}
      <Block p={[44.5, 0.98, 5.3]} s={[0.62, 0.42, 0.05]} color="#2b2440" />
      <Block p={[44.4, 1.02, 5.33]} s={[0.07, 0.07, 0.01]} color="#7fe3ff" emissive />
      <Block p={[44.6, 1.02, 5.33]} s={[0.07, 0.07, 0.01]} color="#7fe3ff" emissive />
      <Block p={[44.5, 0.92, 5.33]} s={[0.16, 0.03, 0.01]} color="#7fe3ff" emissive />
      <Block p={[44.5, 0.8, 5.33]} s={[0.06, 0.12, 0.04]} color="#2b2440" />
      <SchoolChair x={44.5} z={6.05} color="#33303d" turn={Math.PI} />
      <Block p={[38.45, 0.6, 1.6]} s={[0.55, 1.2, 1.0]} color="#e8e8e8" />
      {[0.45, 0.65, 0.85].map((y) => (
        <Block key={y} p={[38.74, y, 1.6]} s={[0.02, 0.05, 0.8]} color="#9aa3b5" />
      ))}
      <FloorPatch x={42} z={2.55} w={5.2} d={0.18} color="#3a3d4f" />
      <FloorPatch x={44.95} z={3.9} w={0.18} d={2.7} color="#3a3d4f" />
      <FloorPatch x={41.2} z={5} w={1.2} d={1.2} color="#7d8aa0" />
      {[-0.4, -0.2, 0, 0.2, 0.4].map((d) => (
        <FloorPatch key={d} x={41.2 + d} z={5} w={0.05} d={1.1} color="#5c6880" y={0.014} />
      ))}
      <WallPicture x={45.35} y={1.2} z={WALL_FACE} w={0.85} h={0.5} map={sign("STAFF ONLY")} />

      {/* Music Room: rug, chairs with music stands, xylophone, amp and mic, a poster */}
      <FloorPatch x={29.2} z={15.4} w={5.2} d={3.2} color="#8e3b52" />
      <FloorPatch x={29.2} z={15.4} w={4.8} d={2.8} color="#c76d7e" y={0.014} />
      {[27.6, 29.2, 30.8].flatMap((x) =>
        [14.6, 16.4].map((z) => (
          <group key={`${x}-${z}`}>
            <SchoolChair x={x} z={z + 0.25} color="#6b4fd8" turn={Math.PI} />
            <MusicStand x={x} z={z - 0.45} />
          </group>
        )),
      )}
      <Block p={[29.4, 0.45, 11.2]} s={[1.4, 0.08, 0.5]} color="#8a5a2b" />
      {["#e5484d", "#f2994a", "#ffd84d", "#4cbf87", "#5b8def", "#b07cf0", "#e5566b"].map((c, i) => (
        <Block key={c} p={[28.85 + i * 0.18, 0.52, 11.2]} s={[0.14, 0.04, 0.42 - i * 0.03]} color={c} />
      ))}
      <Block p={[29.4, 0.2, 11.2]} s={[0.06, 0.4, 0.06]} color="#5a3a22" />
      <Block p={[33.8, 0.35, 12.6]} s={[0.6, 0.7, 0.4]} color="#2b2440" />
      <Block p={[33.8, 0.4, 12.81]} s={[0.45, 0.4, 0.01]} color="#6f5f8c" />
      <Block p={[30.6, 0.75, 12.2]} s={[0.04, 1.5, 0.04]} color="#33303d" />
      <mesh position={[30.6, 1.55, 12.2]}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshToonMaterial color="#9aa3b5" />
      </mesh>
      <WallPicture x={31.6} y={1.0} z={10 + WALL_FACE} w={1.6} h={0.42} map={sign("MUSIC IS LIFE")} />

      {/* Art Room: stools, a sculpture, clay pots, a splattered rug, paintings, aprons */}
      {[
        [38.7, 14.9],
        [41.7, 14.9],
        [40.6, 17.35],
        [42.4, 17.35],
      ].map(([x, z]) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh position-y={0.55}>
            <cylinderGeometry args={[0.2, 0.2, 0.06, 16]} />
            <meshToonMaterial color="#e07a5f" />
          </mesh>
          <Block p={[0, 0.27, 0]} s={[0.05, 0.54, 0.05]} color="#5a3a22" />
        </group>
      ))}
      <Block p={[36.1, 0.45, 16.9]} s={[0.55, 0.9, 0.55]} color="#f4f4f4" />
      <mesh position={[36.1, 1.12, 16.9]}>
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshToonMaterial color="#d5dde3" />
      </mesh>
      <Block p={[36.1, 0.98, 16.9]} s={[0.26, 0.18, 0.16]} color="#d5dde3" />
      {[40.9, 41.5, 42.2].map((x, i) => (
        <mesh key={x} position={[x, 0.86, 16.2 + (i % 2) * 0.2]}>
          <cylinderGeometry args={[0.1 + i * 0.02, 0.07, 0.22, 14]} />
          <meshToonMaterial color={["#c0763a", "#a8744f", "#d08a52"][i]} />
        </mesh>
      ))}
      <FloorPatch x={39.4} z={12.7} w={3} d={1.6} color="#f3eadb" />
      {(
        [
          [38.5, 12.3, "#e5484d"],
          [39.2, 13.1, "#5b8def"],
          [40.1, 12.5, "#ffd84d"],
          [40.6, 13.2, "#4cbf87"],
          [38.9, 12.9, "#b07cf0"],
        ] as const
      ).map(([x, z, c]) => (
        <mesh key={c} rotation-x={-Math.PI / 2} position={[x, 0.016, z]}>
          <circleGeometry args={[0.13, 14]} />
          <meshBasicMaterial color={c} />
        </mesh>
      ))}
      <Painting x={43.3} y={1.05} z={10 + WALL_FACE} w={0.8} h={0.6} colors={["#9cc9f5", "#ffd84d", "#4cbf87"]} />
      <Painting x={44.7} y={1.05} z={10 + WALL_FACE} w={0.6} h={0.75} colors={["#f7c59f", "#e5484d", "#6b4fd8"]} />
      {["#e5566b", "#5b8def", "#4cbf87"].map((c, i) => (
        <Block key={c} p={[38.55 + i * 0.32, 0.95, 10 + WALL_FACE + 0.02]} s={[0.26, 0.45, 0.02]} color={c} />
      ))}

      {/* East hallway: a water fountain and a bulletin board */}
      <Block p={[44.6, 0.45, 8.35]} s={[0.5, 0.9, 0.35]} color="#dfe6ea" />
      <Block p={[44.6, 0.92, 8.4]} s={[0.4, 0.06, 0.28]} color="#9cc9f5" />
      <WallPicture x={35} y={1.3} z={8 + WALL_FACE} w={1.2} h={0.7} map={sign("NEWS")} />
    </>
  );
}

export function Decor() {
  const deskSpots = [2, 5, 8].flatMap((x) => [3, 5.2].map((z) => ({ x, z })));

  return (
    <>
      {/* Classroom 7A */}
      <Window x={1.6} z={WALL_FACE} w={1.8} />
      <WallPicture x={9.25} y={0.95} z={WALL_FACE} w={0.62} h={0.78} map={poster("think")} />
      <Clock x={10.4} y={1.25} z={WALL_FACE} />
      {deskSpots.map((d, i) => (
        <SchoolChair key={i} x={d.x} z={d.z + 0.62} color={CHAIR_COLORS[i % CHAIR_COLORS.length]} />
      ))}
      {deskSpots.map((d, i) =>
        i % 3 === 2 ? null : (
          <Notebook key={i} x={d.x + (i % 2 ? 0.25 : -0.2)} y={0.75} z={d.z} color={CHAIR_COLORS[(i + 2) % CHAIR_COLORS.length]} turn={i * 0.3 - 0.4} />
        ),
      )}
      <Backpack x={2.8} z={3.75} color="#5b8def" turn={0.3} />
      <Backpack x={8.8} z={5.95} color="#4cbf87" turn={-0.4} />
      <Backpack x={5.8} z={5.95} color="#e0a526" turn={0.1} />
      {/* Teacher's desk */}
      <Globe x={9.5} y={0.8} z={1.6} />
      <Notebook x={10.15} y={0.8} z={1.75} color="#c0392b" turn={0.2} />
      <Apple x={10.6} y={0.8} z={1.55} />

      {/* Hallway: lockers and door signs */}
      <Lockers x1={0.4} x2={4.6} z={8 + WALL_FACE} />
      <Lockers x1={7.4} x2={16.6} z={8 + WALL_FACE} />
      <Lockers x1={19.4} x2={23.6} z={8 + WALL_FACE} />
      <DoorSign x={6} z={8.2} text="CLASS 7A" />
      <DoorSign x={18} z={8.2} text="LIBRARY" />
      <DoorSign x={6} z={10.2} text="SCIENCE LAB" />
      <DoorSign x={18} z={10.2} text="CANTEEN" />

      {/* Library: full shelves */}
      {[0, 1, 2, 3].map((i) => (
        <ShelfBooks key={i} x={14.2 + i * 2.6} z={0.75} w={1.8} levels={[0.08, 0.43, 0.78]} seed={i * 17 + 3} />
      ))}
      <Model file="/models/furniture/rugRectangle.glb" box={{ x: 17.5, z: 4.6, w: 4, d: 2.2, h: 0.02 }} fallbackColor="#cdbbe8" />
      <Model file="/models/furniture/lampRoundTable.glb" box={{ x: 16.3, z: 4.5, y: 0.75, w: 0.25, d: 0.25, h: 0.45 }} fallbackColor="#ffd84d" />
      <Model file="/models/furniture/lampRoundTable.glb" box={{ x: 18.8, z: 4.5, y: 0.75, w: 0.25, d: 0.25, h: 0.45 }} fallbackColor="#ffd84d" />
      <Model file="/models/furniture/plantSmall2.glb" box={{ x: 13, z: 7.4, w: 0.45, d: 0.45, h: 0.6 }} fallbackColor="#4cbf87" />

      {/* Science Lab */}
      <WallPicture x={2.2} y={0.9} z={10 + WALL_FACE} w={0.9} h={1.1} map={poster("periodic")} />
      <WallPicture x={3.6} y={0.95} z={10 + WALL_FACE} w={0.6} h={0.75} map={poster("goggles")} />
      <WallPicture x={10.6} y={0.95} z={10 + WALL_FACE} w={0.6} h={0.75} map={poster("map")} />
      {[
        [3, 13, "#4cbf87"],
        [3.7, 13, "#e5566b"],
        [5, 13.1, "#5b8def"],
        [6.6, 15.6, "#ffd84d"],
        [7.4, 15.5, "#b07cf0"],
        [8.6, 15.6, "#4cbf87"],
      ].map(([x, z, color], i) => (
        <Flask key={i} x={x as number} z={z as number} y={0.9} color={color as string} />
      ))}

      <NewWing />

      {/* Canteen: lunch on the tables */}
      <MealTray x={15.3} y={0.75} z={12.75} turn={0.1} />
      <MealTray x={17.7} y={0.75} z={13.25} turn={Math.PI - 0.2} />
      <MealTray x={16.4} y={0.75} z={15.55} turn={-0.15} />
      <MealTray x={18} y={0.75} z={16.05} turn={Math.PI + 0.1} />
      <WallPicture x={15.4} y={0.9} z={10 + WALL_FACE} w={1.1} h={1.3} map={poster("menu")} />
      <Window x={23.2} z={10 + WALL_FACE} w={0.9} />
      {[15.2, 16.5, 17.8].flatMap((x) => [12.25, 13.75, 15.05, 16.55].map((z) => ({ x, z }))).map((s, i) => (
        <Model
          key={i}
          file="/models/furniture/stoolBar.glb"
          box={{ x: s.x, z: s.z, w: 0.38, d: 0.38, h: 0.62 }}
          fallbackColor="#c98f5a"
        />
      ))}
    </>
  );
}
