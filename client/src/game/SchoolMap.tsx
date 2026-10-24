import { Suspense } from "react";
import type { Texture } from "three";
import { Decor } from "./Decor";
import { FittedModel } from "./FittedModel";
import { ModelBoundary } from "./ModelBoundary";
import { Terminal3D } from "./Terminal3D";
import { chalkboard, checkerFloor, linoleumFloor, vendingFront, woodFloor } from "./textures";
import {
  FURNITURE,
  type Furniture,
  MEETING_BUTTON,
  ROOMS,
  TERMINALS,
  WALLS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  type Room,
} from "@whtb/shared/map";

const WALL_COLOR = "#a89bc0";
const WALL_BASE_COLOR = "#6f5f8c";
const WALL_CAP_COLOR = "#5a4a6b";
const WALL_BASE_HEIGHT = 0.45;

/** Each room's floor: wood, carpet, tiles, or hallway linoleum (one tile = 2×2 units). */
function floorTexture(r: Room): Texture {
  const repeat: [number, number] = [r.w / 2, r.d / 2];
  switch (r.id) {
    case "classroom":
      return woodFloor(repeat);
    case "library":
      return woodFloor(repeat, true);
    case "lab":
      return checkerFloor("#f4f6f8", "#d5dde3", repeat);
    case "canteen":
      return checkerFloor("#fff3e0", "#f7c59f", repeat);
    case "gym":
      return woodFloor(repeat);
    case "server":
      return checkerFloor("#9fb0c7", "#8697b0", repeat);
    case "music":
      return woodFloor(repeat, true);
    case "art":
      return checkerFloor("#f1f8e9", "#c8e6c9", repeat);
    default:
      return linoleumFloor([r.w / 4, 1]);
  }
}

function Floors() {
  return (
    <>
      {ROOMS.map((r) => (
        <mesh key={r.id} rotation-x={-Math.PI / 2} position={[r.x + r.w / 2, 0, r.z + r.d / 2]}>
          <planeGeometry args={[r.w, r.d]} />
          <meshToonMaterial map={floorTexture(r)} />
        </mesh>
      ))}
    </>
  );
}

/** Two-tone walls: a darker band along the bottom, a lighter wall, and a cap on top. */
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
        const upper = WALL_HEIGHT - WALL_BASE_HEIGHT;
        return (
          <group key={i} position={[cx, 0, cz]}>
            <mesh position-y={WALL_BASE_HEIGHT / 2}>
              <boxGeometry args={[sizeX + 0.02, WALL_BASE_HEIGHT, sizeZ + 0.02]} />
              <meshToonMaterial color={WALL_BASE_COLOR} />
            </mesh>
            <mesh position-y={WALL_BASE_HEIGHT + upper / 2}>
              <boxGeometry args={[sizeX, upper, sizeZ]} />
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

/** Kenney Furniture Kit models (CC0) for each kind; the board and vending machine are painted boxes. */
const MODEL_FOR: Partial<Record<Furniture["kind"], string>> = {
  desk: "/models/furniture/desk.glb",
  teacherDesk: "/models/furniture/desk.glb",
  sink: "/models/furniture/kitchenSink.glb",
  counter: "/models/furniture/kitchenBar.glb",
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

/** A box with a picture on the side facing the camera (the chalkboard, the vending machine). */
function PaintedBox({ f, front }: { f: Furniture; front: Texture }) {
  return (
    <mesh position={[f.x, (f.y ?? 0) + f.h / 2, f.z]}>
      <boxGeometry args={[f.w, f.h, f.d]} />
      {/* box faces: +x, -x, +y, -y, +z (front), -z */}
      <meshToonMaterial attach="material-0" color={f.color} />
      <meshToonMaterial attach="material-1" color={f.color} />
      <meshToonMaterial attach="material-2" color={f.color} />
      <meshToonMaterial attach="material-3" color={f.color} />
      <meshToonMaterial attach="material-4" map={front} />
      <meshToonMaterial attach="material-5" color={f.color} />
    </mesh>
  );
}

function FurnitureSet() {
  return (
    <>
      {FURNITURE.map((f, i) => {
        if (f.kind === "board") return <PaintedBox key={i} f={f} front={chalkboard()} />;
        if (f.kind === "vending") return <PaintedBox key={i} f={f} front={vendingFront()} />;
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
      <Decor />
    </>
  );
}
