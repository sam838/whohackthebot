import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Box3, MeshToonMaterial, Vector3, type Material, type Mesh } from "three";

export interface FitBox {
  x: number;
  z: number;
  /** Width (x), depth (z) and height of the space the model should fill. */
  w: number;
  d: number;
  h: number;
  y?: number;
  /** Turn the model before fitting (radians around the vertical axis). */
  turn?: number;
}

/**
 * A CC0 furniture model stretched to fill a box on the floor, so it lines up
 * with the collision boxes in shared/map.ts. Materials become toon-shaded to
 * match the cartoon look (spec.md > Look and Feel).
 */
export function FittedModel({ file, box }: { file: string; box: FitBox }) {
  const { scene } = useGLTF(file);
  const fitted = useMemo(() => {
    const copy = scene.clone(true);
    copy.rotation.y = box.turn ?? 0;
    copy.updateMatrixWorld(true);
    copy.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const old = mesh.material as Material & { color?: { getHex(): number } };
      mesh.material = new MeshToonMaterial({ color: old.color?.getHex() ?? 0xffffff });
    });
    const bounds = new Box3().setFromObject(copy);
    const size = bounds.getSize(new Vector3());
    const scale = new Vector3(box.w / size.x, box.h / size.y, box.d / size.z);
    const center = bounds.getCenter(new Vector3());
    return { copy, scale, offset: new Vector3(-center.x * scale.x, -bounds.min.y * scale.y, -center.z * scale.z) };
  }, [scene, box.w, box.d, box.h, box.turn]);

  return (
    <group position={[box.x, box.y ?? 0, box.z]}>
      <group position={fitted.offset} scale={fitted.scale}>
        <primitive object={fitted.copy} />
      </group>
    </group>
  );
}
