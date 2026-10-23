import { useRef } from "react";
import { joystick } from "../game/input";

const MAX_DISTANCE = 44;

/** On-screen thumbstick. Writes its direction into the shared input object. */
export function Joystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);

  function update(clientX: number, clientY: number) {
    const base = baseRef.current!.getBoundingClientRect();
    let dx = clientX - (base.left + base.width / 2);
    let dy = clientY - (base.top + base.height / 2);
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_DISTANCE) {
      dx = (dx / dist) * MAX_DISTANCE;
      dy = (dy / dist) * MAX_DISTANCE;
    }
    knobRef.current!.style.transform = `translate(${dx}px, ${dy}px)`;
    joystick.x = dx / MAX_DISTANCE;
    joystick.z = dy / MAX_DISTANCE;
  }

  function release() {
    pointerId.current = null;
    knobRef.current!.style.transform = "";
    joystick.x = 0;
    joystick.z = 0;
  }

  return (
    <div
      ref={baseRef}
      className="joystick"
      onPointerDown={(e) => {
        pointerId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.pointerId === pointerId.current) update(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div ref={knobRef} className="joystick-knob" />
    </div>
  );
}
