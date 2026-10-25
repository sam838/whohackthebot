import { TERMINAL_SIZE } from "@whtb/shared/map";
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";

let picture: string | undefined;

/**
 * The Study-Bot terminal exactly as it looks in the school (game/Terminal3D.tsx), with
 * its "you're close enough" ring, seen from the game's camera angle. Drawn once with a
 * renderer that is thrown away right after, so the role book shows a still image.
 */
export function terminalPicture(): string | undefined {
  if (picture) return picture;
  const scene = new Scene();
  const body = new Mesh(new BoxGeometry(TERMINAL_SIZE.w, 1.1, TERMINAL_SIZE.d), new MeshToonMaterial({ color: "#3b3550" }));
  body.position.y = 0.55;
  const screen = new Mesh(new BoxGeometry(0.8, 0.55, 0.08), new MeshBasicMaterial({ color: "#ffd84d" }));
  screen.position.set(0, 1.35, 0.05);
  screen.rotation.x = -0.35;
  const ring = new Mesh(new RingGeometry(0.95, 1.15, 40), new MeshBasicMaterial({ color: "#ffd84d" }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  const sun = new DirectionalLight("#ffffff", 1.4);
  sun.position.set(3, 5, 4);
  scene.add(body, screen, ring, new HemisphereLight("#ffffff", "#b9a7c9", 1.8), sun);
  // Like the game's camera (above and in front), a little lower so the yellow screen faces you.
  const camera = new PerspectiveCamera(34, 240 / 200, 0.1, 50);
  camera.position.set(0, 2.9, 4.2);
  camera.lookAt(0, 0.55, 0);

  let renderer: WebGLRenderer | undefined;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setSize(240, 200, false);
    renderer.render(scene, camera);
    picture = renderer.domElement.toDataURL("image/png");
  } catch {
    // No 3D available: the book just shows the caption.
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  return picture;
}
