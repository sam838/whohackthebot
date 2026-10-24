// Small, code-built props that make rooms feel lived in. Decoration only:
// none of these block movement.

const BOOK_COLORS = ["#c0392b", "#2f6fb5", "#e0a526", "#3f8f5b", "#7b4fa8", "#d9643a", "#2b2440", "#f2ede0"];

/** A tiny repeatable random sequence, so the same shelf always looks the same. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Rows of books standing on a bookcase's shelves. */
export function ShelfBooks({ x, z, w, levels, seed }: { x: number; z: number; w: number; levels: number[]; seed: number }) {
  const rnd = seeded(seed);
  const books: { x: number; y: number; w: number; h: number; color: string; lean: number }[] = [];
  for (const y of levels) {
    let cursor = x - w / 2 + 0.08;
    while (cursor < x + w / 2 - 0.12) {
      const bw = 0.06 + rnd() * 0.05;
      const gap = rnd() < 0.12 ? 0.12 : 0.005; // the odd empty slot
      books.push({ x: cursor + bw / 2, y, w: bw, h: 0.2 + rnd() * 0.09, color: BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)], lean: rnd() < 0.08 ? 0.25 : 0 });
      cursor += bw + gap;
    }
  }
  return (
    <>
      {books.map((b, i) => (
        <mesh key={i} position={[b.x, b.y + b.h / 2, z]} rotation-z={b.lean}>
          <boxGeometry args={[b.w, b.h, 0.36]} />
          <meshToonMaterial color={b.color} />
        </mesh>
      ))}
    </>
  );
}

/** A simple school chair: seat, backrest, four legs. Faces -z (toward the board) by default. */
export function SchoolChair({ x, z, color = "#e5566b", turn = 0 }: { x: number; z: number; color?: string; turn?: number }) {
  const legs: [number, number][] = [
    [-0.2, -0.18],
    [0.2, -0.18],
    [-0.2, 0.18],
    [0.2, 0.18],
  ];
  return (
    <group position={[x, 0, z]} rotation-y={turn}>
      <mesh position-y={0.46}>
        <boxGeometry args={[0.5, 0.06, 0.46]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.74, 0.21]}>
        <boxGeometry args={[0.5, 0.42, 0.05]} />
        <meshToonMaterial color={color} />
      </mesh>
      {legs.map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.22, lz]}>
          <cylinderGeometry args={[0.025, 0.025, 0.44, 8]} />
          <meshToonMaterial color="#5a4a6b" />
        </mesh>
      ))}
    </group>
  );
}

/** An open notebook lying on a desk. */
export function Notebook({ x, y, z, color = "#2f6fb5", turn = 0 }: { x: number; y: number; z: number; color?: string; turn?: number }) {
  return (
    <group position={[x, y, z]} rotation-y={turn}>
      <mesh position-y={0.01}>
        <boxGeometry args={[0.42, 0.02, 0.3]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position-y={0.025}>
        <boxGeometry args={[0.38, 0.012, 0.26]} />
        <meshToonMaterial color="#fffdf4" />
      </mesh>
      <mesh position={[0.06, 0.035, 0]} rotation-y={0.4}>
        <cylinderGeometry args={[0.012, 0.012, 0.22, 6]} />
        <meshToonMaterial color="#e0a526" />
      </mesh>
    </group>
  );
}

/** A school backpack leaning on the floor. */
export function Backpack({ x, z, color, turn = 0 }: { x: number; z: number; color: string; turn?: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={turn}>
      <mesh position-y={0.22} rotation-x={-0.15}>
        <boxGeometry args={[0.34, 0.42, 0.2]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.17, 0.11]} rotation-x={-0.15}>
        <boxGeometry args={[0.26, 0.18, 0.06]} />
        <meshToonMaterial color="#2b2440" />
      </mesh>
    </group>
  );
}

/** A classroom globe on a little stand. */
export function Globe({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position-y={0.04}>
        <cylinderGeometry args={[0.1, 0.12, 0.06, 16]} />
        <meshToonMaterial color="#5a4a6b" />
      </mesh>
      <mesh position-y={0.32} rotation-z={0.4}>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshToonMaterial color="#5b8def" />
      </mesh>
      <mesh position-y={0.32} rotation-z={0.4}>
        <torusGeometry args={[0.23, 0.012, 6, 32, Math.PI]} />
        <meshToonMaterial color="#c9a227" />
      </mesh>
    </group>
  );
}

export function Apple({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position-y={0.07}>
        <sphereGeometry args={[0.07, 14, 10]} />
        <meshToonMaterial color="#d93a3a" />
      </mesh>
      <mesh position-y={0.15}>
        <cylinderGeometry args={[0.008, 0.008, 0.05, 5]} />
        <meshToonMaterial color="#5a3a1a" />
      </mesh>
    </group>
  );
}

/** A canteen tray with a bowl of rice and a glass of es teh. */
export function MealTray({ x, y, z, turn = 0 }: { x: number; y: number; z: number; turn?: number }) {
  return (
    <group position={[x, y, z]} rotation-y={turn}>
      <mesh position-y={0.01}>
        <boxGeometry args={[0.46, 0.02, 0.32]} />
        <meshToonMaterial color="#7fa7c9" />
      </mesh>
      <mesh position={[-0.08, 0.06, 0]}>
        <cylinderGeometry args={[0.1, 0.07, 0.08, 16]} />
        <meshToonMaterial color="#fffdf4" />
      </mesh>
      <mesh position={[-0.08, 0.1, 0]}>
        <sphereGeometry args={[0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshToonMaterial color="#e3b36a" />
      </mesh>
      <mesh position={[0.13, 0.08, 0]}>
        <cylinderGeometry args={[0.04, 0.035, 0.14, 12]} />
        <meshToonMaterial color="#b86b2a" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}
