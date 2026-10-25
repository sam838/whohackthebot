import { useEffect, useState } from "react";
import { isMuted, onMuteChange, setMuted, unlockAudio } from "../audio/sound";

/** Sound on or off (also the M key). Remembered on this device. */
export function SoundToggle({ floating = false }: { floating?: boolean }) {
  const [muted, setState] = useState(isMuted);
  useEffect(() => {
    const off = onMuteChange(setState);
    return () => {
      off();
    };
  }, []);
  return (
    <button
      className={`sound-toggle ${floating ? "floating" : ""}`}
      onClick={() => {
        unlockAudio();
        setMuted(!muted);
      }}
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      title={muted ? "Sound off (M)" : "Sound on (M)"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
