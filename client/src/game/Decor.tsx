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
