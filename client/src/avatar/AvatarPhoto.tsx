import { characterFile } from "@whtb/shared/avatars";
import type { Role } from "@whtb/shared/types";
import { useEffect, useState } from "react";
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { type GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

type Turn = [x: number, y: number, z: number];

/**
 * A photo pose: bone turns (radians) from the model's rest pose, plus an optional
 * prop. The Kenney rig rests in a T-pose (arms straight out) and has legs, torso,
 * two arms, and a head. Measured on the models: the right arm (photo left) lowers
 * with +z and rises with -z; the left arm is the mirror; y swings an arm forward
 * or back; the head turns with y and tilts with z.
 */
export interface Pose {
  bones: Partial<Record<"head" | "torso" | "arm-left" | "arm-right" | "leg-left" | "leg-right", Turn>>;
  /** Only worn props: the blocky hands can't hold anything convincingly. */
  prop?: "mask";
  /** Whole-body turn toward the camera. */
  facing?: number;
}

/** Each role poses differently for its book photo (learner's idea). */
export const ROLE_POSES: Record<Role, Pose> = {
  // Hand up by the face, head tilted, smiling.
  student: { bones: { "arm-right": [0, -0.25, -1.05], "arm-left": [0, 0, -1.12], head: [0, 0, 0.18] } },
  // A plain, friendly photo.
  factChecker: { bones: { "arm-right": [0, 0, 1.12], "arm-left": [0, 0, -1.12], head: [0, 0.15, -0.1] } },
  // Impostor: bandit mask and a shifty side-glance, arms at the sides (hands behind the back read as squatting).
  bluffer: { bones: { "arm-right": [0, 0, 1.12], "arm-left": [0, 0, -1.12], head: [0, -0.5, 0] }, prop: "mask" },
};

const ink = new MeshStandardMaterial({ color: "#2b2440", roughness: 0.6 });

/** A black bandit mask across the eyes, for the Bluffer. */
function mask(): Object3D {
  const g = new Group();
  const band = new Mesh(new BoxGeometry(0.36, 0.075, 0.03), ink);
  const tieL = new Mesh(new BoxGeometry(0.02, 0.05, 0.12), ink);
  tieL.position.set(0.17, 0, -0.06);
  const tieR = tieL.clone();
  tieR.position.x = -0.17;
  g.add(band, tieL, tieR);
  return g;
}

/** Where each prop sits on its bone (model units, in that bone's space). */
const PROP_MOUNT = {
  mask: { bone: "head", position: [0, 0.135, 0.165] as Turn, rotation: [0, 0, 0] as Turn },
} as const;

/** Photos already taken this session, so reopening the book needs no 3D at all. */
const photos = new Map<string, Promise<string>>();
const models = new Map<string, Promise<GLTF>>();
const loader = new GLTFLoader();

/** The photo's size in pixels (twice the size it shows in the book, for sharp screens). */
const PHOTO_W = 360;
const PHOTO_H = 420;

/**
 * Poses the character and draws it once, straight away, with a renderer that is
 * thrown away right after. It never waits for an animation frame, so it works in
 * background tabs too (browsers pause animation frames there).
 */
async function takePhoto(file: string, pose: Pose): Promise<string> {
  if (!models.has(file)) models.set(file, loader.loadAsync(file));
  const gltf = await models.get(file)!;
  const model = cloneSkinned(gltf.scene) as Group;
  for (const [name, [x, y, z]] of Object.entries(pose.bones)) model.getObjectByName(name)?.rotation.set(x, y, z);
  if (pose.prop) {
    const mount = PROP_MOUNT[pose.prop];
    const prop = mask();
    prop.position.set(...mount.position);
    prop.rotation.set(...mount.rotation);
    model.getObjectByName(mount.bone)?.add(prop);
  }
  model.scale.setScalar(2.4);
  model.rotation.y = pose.facing ?? 0;

  const scene = new Scene();
  scene.add(model, new HemisphereLight("#ffffff", "#b9a7c9", 1.8));
  const sun = new DirectionalLight("#ffffff", 1.4);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const camera = new PerspectiveCamera(28, PHOTO_W / PHOTO_H, 0.1, 50);
  camera.position.set(0, 1.05, 4.7);
  camera.lookAt(0, 0.82, 0);

  // Same look as the game's scenes (react-three-fiber's defaults).
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  try {
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setSize(PHOTO_W, PHOTO_H, false);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL("image/png");
  } finally {
    renderer.dispose();
    renderer.forceContextLoss(); // free the 3D context at once
  }
}

/**
 * Your character as a still school photo, posed for your role (prd.md > Role Reveal).
 * The 3D model is posed and drawn once into a plain image, so the book stays light
 * on phones and with several game windows open.
 */
export function AvatarPhoto({ character, role, pose = ROLE_POSES[role] }: { character: string; role: Role; pose?: Pose }) {
  const [src, setSrc] = useState<string>();
  const file = characterFile(character);

  useEffect(() => {
    if (!file) return;
    const key = `${file}|${JSON.stringify(pose)}`;
    if (!photos.has(key)) photos.set(key, takePhoto(file, pose));
    let live = true;
    photos.get(key)!.then(
      (url) => live && setSrc(url),
      () => photos.delete(key), // try again next time the book opens
    );
    return () => {
      live = false;
    };
  }, [file, pose]);

  return src ? <img className="avatar-photo" src={src} alt="" draggable={false} /> : <div className="avatar-photo" aria-hidden />;
}
