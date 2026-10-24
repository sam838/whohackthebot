import { HIDING_SPOTS } from "@whtb/shared/pieces";
import { SEARCH_MS, useGame } from "../net/store";

/** While you examine something: "🔍 Searching inside the piano…" with a bar that fills. */
export function SearchProgress() {
  const searching = useGame((s) => s.searching);
  if (!searching) return null;
  const where = HIDING_SPOTS.find((s) => s.id === searching.spotId)?.label ?? "here";
  return (
    <div className="search-progress" role="status">
      <span>🔍 Searching {where}…</span>
      <div className="search-track" aria-hidden>
        <div key={searching.startedAt} className="search-fill" style={{ animationDuration: `${SEARCH_MS}ms` }} />
      </div>
    </div>
  );
}
