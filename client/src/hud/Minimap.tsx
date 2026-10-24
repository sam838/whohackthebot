import { MEETING_BUTTON, ROOMS, TERMINALS, WALLS, WORLD_DEPTH, WORLD_WIDTH } from "@whtb/shared/map";
import { useEffect, useRef, useState } from "react";
import { localPlayer } from "../game/positions";
import { useGame } from "../net/store";

/** Short labels that fit the small room shapes. */
const SHORT: Record<string, string> = {
  classroom: "7A",
  library: "Library",
  lab: "Lab",
  canteen: "Canteen",
  gym: "Gym",
  server: "Server",
  music: "Music",
  art: "Art",
};

/**
 * A small map of the school with you on it (prd.md > Moving Around the School).
 * It never shows other players, so limited vision and Expel stay fair. The
 * Bluffer also sees which terminals they've hacked.
 */
export function Minimap() {
  const myColor = useGame((s) => s.game?.players.find((p) => p.id === s.myId)?.color ?? "#f2c14e");
  const myHacks = useGame((s) => s.myHacks);
  const [open, setOpen] = useState(true);
  const dot = useRef<SVGCircleElement>(null);

  // Move your dot every frame without re-rendering the map.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const loop = () => {
      const b = localPlayer.body;
      if (b && dot.current) {
        dot.current.setAttribute("cx", b.x.toFixed(2));
        dot.current.setAttribute("cy", b.z.toFixed(2));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return (
    <div className={`minimap ${open ? "" : "closed"}`}>
      <button className="minimap-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        Map {open ? "▾" : "▸"}
      </button>
      {open && (
        <svg viewBox={`-0.5 -0.5 ${WORLD_WIDTH + 1} ${WORLD_DEPTH + 1}`} role="img" aria-label="School map with your position">
          {ROOMS.map((r) => (
            <rect key={r.id} x={r.x} y={r.z} width={r.w} height={r.d} fill={r.color} />
          ))}
          {WALLS.map(([x1, z1, x2, z2], i) => (
            <line key={i} x1={x1} y1={z1} x2={x2} y2={z2} stroke="#2b2440" strokeWidth={0.35} strokeLinecap="round" />
          ))}
          {ROOMS.filter((r) => SHORT[r.id]).map((r) => (
            <text key={r.id} x={r.x + r.w / 2} y={r.z + r.d / 2 + 0.7} textAnchor="middle" className="minimap-label">
              {SHORT[r.id]}
            </text>
          ))}
          {TERMINALS.map((t) => (
            <rect
              key={t.id}
              x={t.x - 0.45}
              y={t.z - 0.45}
              width={0.9}
              height={0.9}
              rx={0.15}
              fill={myHacks.includes(t.id) ? "#e5484d" : "#ffd84d"}
              stroke="#2b2440"
              strokeWidth={0.15}
            />
          ))}
          <circle cx={MEETING_BUTTON.x} cy={MEETING_BUTTON.z} r={0.5} fill="#e5484d" stroke="#2b2440" strokeWidth={0.15} />
          <circle ref={dot} r={0.75} fill={myColor} stroke="#ffffff" strokeWidth={0.3} />
        </svg>
      )}
      {open && (
        <p className="minimap-legend">
          <span className="key terminal" /> Study-Bot terminal
          <span className="key button" /> Meeting
          <span className="key you" style={{ background: myColor }} /> You
          {myHacks.length > 0 && (
            <>
              <span className="key hacked" /> Hacked
            </>
          )}
        </p>
      )}
    </div>
  );
}
