import { CHARACTERS, type Avatar } from "@whtb/shared/avatars";
import { NAME_MAX_LENGTH, PLAYER_COLORS } from "@whtb/shared/constants";
import { AvatarPreview } from "./AvatarPreview";

/** Pick a character, a color, and a name. Changes are saved by the caller. */
export function AvatarPicker({ avatar, onChange }: { avatar: Avatar; onChange: (a: Avatar) => void }) {
  const index = Math.max(0, CHARACTERS.findIndex((c) => c.id === avatar.character));
  const step = (d: number) => onChange({ ...avatar, character: CHARACTERS[(index + d + CHARACTERS.length) % CHARACTERS.length].id });

  return (
    <div className="avatar-picker">
      <div className="avatar-stage">
        <button className="arrow" onClick={() => step(-1)} aria-label="Previous character">
          ◀
        </button>
        <AvatarPreview color={avatar.color} character={avatar.character} />
        <button className="arrow" onClick={() => step(1)} aria-label="Next character">
          ▶
        </button>
      </div>
      <p className="avatar-label">{CHARACTERS[index].label}</p>
      <div className="swatches" role="radiogroup" aria-label="Your color">
        {PLAYER_COLORS.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={avatar.color === c}
            aria-label={`Color ${c}`}
            className={`swatch ${avatar.color === c ? "on" : ""}`}
            style={{ background: c }}
            onClick={() => onChange({ ...avatar, color: c })}
          />
        ))}
      </div>
      <label className="field">
        <span>Your name</span>
        <input
          id="player-name"
          value={avatar.name}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          placeholder="e.g. Rina"
          onChange={(e) => onChange({ ...avatar, name: e.target.value })}
        />
      </label>
    </div>
  );
}
