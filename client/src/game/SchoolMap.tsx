import { Text } from "@react-three/drei";
import { Suspense } from "react";
import { FittedModel } from "./FittedModel";
import { ModelBoundary } from "./ModelBoundary";
import { Terminal3D } from "./Terminal3D";
import {
  FURNITURE,
  type Furniture,
  MEETING_BUTTON,
  ROOMS,
  TERMINALS,
  WALLS,
  WALL_HEIGHT,
  WALL_THICKNESS,
} from "@whtb/shared/map";

const WALL_COLOR = "#8c7aa3";
const WALL_CAP_COLOR = "#5a4a6b";

function Floors() {
  return (
    <>
      {ROOMS.map((r) => (
        <mesh key={r.id} rotation-x={-Math.PI / 2} position={[r.x + r.w / 2, 0, r.z + r.d / 2]}>
          <planeGeometry args={[r.w, r.d]} />
          <meshToonMaterial color={r.color} />
        </mesh>
      ))}
      {/* Labels load a font; give them their own Suspense so the map never waits on it. */}
      <Suspense fallback={null}>
      {ROOMS.filter((r) => r.id !== "hallway").map((r) => (
        <Text
          key={`${r.id}-label`}
          position={[r.x + 0.5, 0.02, r.z + r.d - 0.5]}
          rotation-x={-Math.PI / 2}
          anchorX="left"
          anchorY="bottom"
          fontSize={0.6}
          color="#2b2440"
          fillOpacity={0.4}
        >
          {r.name.toUpperCase()}
        </Text>
      ))}
      </Suspense>
    </>
  );
}

function Walls() {
  return (
    <>
      {WALLS.map(([x1, z1, x2, z2], i) => {
        const horizontal = z1 === z2;
        const length = Math.abs(horizontal ? x2 - x1 : z2 - z1) + WALL_THICKNESS;
        const sizeX = horizontal ? length : WALL_THICKNESS;
        const sizeZ = horizontal ? WALL_THICKNESS : length;
        const cx = (x1 + x2) / 2;
        const cz = (z1 + z2) / 2;
        return (
          <group key={i} position={[cx, 0, cz]}>
            <mesh position-y={WALL_HEIGHT / 2}>
              <boxGeometry args={[sizeX, WALL_HEIGHT, sizeZ]} />
              <meshToonMaterial color={WALL_COLOR} />
            </mesh>
            <mesh position-y={WALL_HEIGHT + 0.04}>
              <boxGeometry args={[sizeX + 0.04, 0.08, sizeZ + 0.04]} />
              <meshToonMaterial color={WALL_CAP_COLOR} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/** Kenney Furniture Kit models (CC0) for each kind; the board stays a simple box. */
const MODEL_FOR: Partial<Record<Furniture["kind"], string>> = {
  desk: "/models/furniture/desk.glb",
  shelf: "/models/furniture/bookcaseClosedWide.glb",
  table: "/models/furniture/table.glb",
  labTable: "/models/furniture/table.glb",
  canteenTable: "/models/furniture/table.glb",
  books: "/models/furniture/books.glb",
  plant: "/models/furniture/pottedPlant.glb",
  fridge: "/models/furniture/kitchenFridge.glb",
  trashcan: "/models/furniture/trashcan.glb",
};

function BoxPiece({ f }: { f: Furniture }) {
  return (
    <mesh position={[f.x, (f.y ?? 0) + f.h / 2, f.z]}>
      <boxGeometry args={[f.w, f.h, f.d]} />
      <meshToonMaterial color={f.color} />
    </mesh>
  );
}

function FurnitureSet() {
  return (
    <>
      {FURNITURE.map((f, i) => {
        const file = MODEL_FOR[f.kind];
        if (!file) return <BoxPiece key={i} f={f} />;
        // If a model fails to load, the plain box stands in for it.
        const box = <BoxPiece f={f} />;
        return (
          <ModelBoundary key={i} fallback={box}>
            <Suspense fallback={box}>
              <FittedModel file={file} box={f} />
            </Suspense>
          </ModelBoundary>
        );
      })}
    </>
  );
}

function Terminals() {
  return (
    <>
      {TERMINALS.map((t) => (
        <Terminal3D key={t.id} spot={t} />
      ))}
    </>
  );
}

function MeetingButton() {
  return (
    <group position={[MEETING_BUTTON.x, 0, MEETING_BUTTON.z]}>
      <mesh position-y={0.35}>
        <cylinderGeometry args={[0.5, 0.6, 0.7, 24]} />
        <meshToonMaterial color="#666070" />
      </mesh>
      <mesh position-y={0.78}>
        <cylinderGeometry args={[0.36, 0.36, 0.18, 24]} />
        <meshToonMaterial color="#e5484d" />
      </mesh>
    </group>
  );
}

export function SchoolMap() {
  return (
    <>
      <Floors />
      <Walls />
      <FurnitureSet />
      <Terminals />
      <MeetingButton />
    </>
  );
}
